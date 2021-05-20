import {
  openOrder,
  allOrder,
  checkPrice,
  accountBalances,
} from "./functions/info";
import {
  sendNotification,
  getRSI,
  sendErrors,
  logger,
} from "./functions/utils";
import {
  cancelStaleOrder,
  placeBuy,
  placeInitialBuy,
  placeInitialSell,
  placeLowSell,
  placeSell,
} from "./functions/actions";

let openOrders = [];
let latestOrder = [];

// The loop is set to poll the APIs in X milliseconds.

export const newtrade = async (
  settings,
  pairInfo,
  socket,
  tradingPair,
  acbl,
  current_price,
  topOrder,
  tradeDetails
) => {
  let newOrder = false;
  if (tradeDetails.side == "BUY") {
    if (tradeDetails.type == "normal") {
      logger.info(`Placing normal BUY..`);
      if (tradeDetails.RSI > pairInfo.settings.HIGHEST_RSI) {
        let message = `Exiting, RSI is ${tradeDetails.RSI}, which is above ${pairInfo.settings.HIGHEST_RSI}`;
        logger.error(message);
        sendErrors(message, settings);
        return;
      }
      newOrder = await placeBuy(
        tradingPair,
        acbl,
        latestOrder[tradingPair],
        tradeDetails.bottomBorder,
        tradeDetails.price,
        tradeDetails.RSI,
        settings
      );
    }
    if (tradeDetails.type == "initial") {
      logger.info(`Placing initial BUY..`);
      let possibleOrder = await placeInitialBuy(
        tradingPair,
        acbl,
        tradeDetails.RSI,
        tradeDetails.bottomBorder,
        tradeDetails.price,
        settings
      );
      if (possibleOrder) {
        newOrder = possibleOrder;
      }
    }
  }
  if (tradeDetails.side == "SELL") {
    if (tradeDetails.type == "low") {
      logger.info(`Placing LOW SELL..`);
      newOrder = await placeLowSell(
        tradingPair,
        acbl,
        latestOrder[tradingPair],
        tradeDetails.fullMultiplier,
        current_price,
        settings
      );
    }
    if (tradeDetails.type == "normal") {
      logger.info(`Placing normal SELL..`);
      console.log(latestOrder[tradingPair]);
      newOrder = await placeSell(
        tradingPair,
        acbl,
        latestOrder[tradingPair][0],
        tradeDetails.fullMultiplier,
        current_price,
        settings
      );
      console.log(latestOrder[tradingPair]);
    }
    if (tradeDetails.type == "initial") {
      logger.info(`Placing initial SELL..`);
      let possibleOrder = await placeInitialSell(
        tradingPair,
        acbl,
        tradeDetails.fullMultiplier,
        settings
      );
      if (possibleOrder) {
        newOrder = possibleOrder;
      }
    }
  }
  return newOrder;
};

export const makeDecision = async (
  settings,
  pairInfo,
  tradingPair,
  acbl,
  RSI,
  price,
  current_price,
  fullMultiplier,
  topOrder
) => {
  // Calculate the highest and lowest percentage multipliers according to the set WIGGLE_ROOM
  const width = Number(pairInfo.settings.WIGGLE_ROOM / 100);
  const divider = Number(pairInfo.settings.BUYING_PRICE_DIVIDER);

  let bottomBorder = 1 - width / divider;

  // Check if there is no open order, get the latest order and see if it was filed or cancelled and whether it is a
  // buy order or a sell order.
  if (openOrders[tradingPair].length > 0) {
    // If there is still an open order, just set that open order as the latest order
    //latestOrder[tradingPair] = openOrders[tradingPair];
    if (pairInfo.tradeEnabled) {
      //     console.log("Order Already Open:", tradingPair, openOrders[tradingPair]);
    }
    return false;
  }

  if (latestOrder[tradingPair]) {
    let lastOrder = latestOrder[tradingPair][0];
    if (
      (lastOrder.side == "SELL" && lastOrder.status == "FILLED") ||
      (lastOrder.status == "CANCELED" && lastOrder.side == "BUY")
    ) {
      return {
        side: "BUY",
        type: "normal",
        bottomBorder: bottomBorder,
        price: price,
        RSI: RSI,
        fullMultiplier: fullMultiplier,
      };
    }

    // Sell at a possible loss if the sell was cancelled

    if (lastOrder.status == "CANCELED" && lastOrder.side == "SELL") {
      return {
        side: "SELL",
        type: "low",
        bottomBorder: bottomBorder,
        price: price,
        RSI: RSI,
        fullMultiplier: fullMultiplier,
      };
    }
    if (
      (lastOrder.status == "FILLED" && lastOrder.side == "BUY") ||
      (lastOrder.status == "CANCELED" && lastOrder.side == "SELL")
    ) {
      return {
        side: "SELL",
        type: "normal",
        bottomBorder: bottomBorder,
        price: price,
        RSI: RSI,
        fullMultiplier: fullMultiplier,
      };
    }
  } else {
    sendNotification(
      `There is no open order currently. Deciding which side to start with...`,
      settings
    );

    if (acbl.FIAT > Number(settings.info.minOrder)) {
      return {
        side: "BUY",
        type: "initial",
        bottomBorder: bottomBorder,
        price: price,
        RSI: RSI,
        fullMultiplier: fullMultiplier,
      };
    } else if (acbl.MAIN_ASSET * price.price > Number(settings.info.minOrder)) {
      return {
        side: "SELL",
        type: "initial",
        bottomBorder: bottomBorder,
        price: price,
        RSI: RSI,
        fullMultiplier: fullMultiplier,
      };
    } else {
      logger.error(`Insufficient funds..`);
      console.log(`Insufficient funds..`);
      sendErrors(
        `Please add money to your account. You currently have only: $${acbl.FIAT} and ${acbl.MAIN_ASSET}${settings.MAIN_ASSET}, which is insufficient.`,
        settings
      );
      return false;
    }
  }
  console.log("no descision made!!!!");
};

export const processStaleOrders = async (
  current_price,
  fullMultiplier,
  settings,
  pairInfo
) => {
  // Check for open orders and if it is a BUY order and has not been filled within X minutes, cancel it
  // so that you can place another BUY order
  let cancelAfter = Number(pairInfo.settings.CANCEL_AFTER);
  console.log(openOrders[pairInfo.pairName]);
  try {
    if (
      openOrders[pairInfo.pairName].length > 0 &&
      (Date.now() - Number(openOrders[0].clientOrderId)) / 1000 > cancelAfter &&
      openOrders[pairInfo.pairName][0].side == "BUY"
    ) {
      await cancelStaleOrder(
        pairInfo.pairName,
        openOrders[pairInfo.pairName],
        current_price,
        fullMultiplier,
        settings
      );
      return true;
    }
  } catch (error) {
    logger.error("Processing stale error:", error);
  }
  return false;
};
// The loop is set to poll the APIs in X milliseconds.
export const pretrade = async (
  settings,
  pairInfo,
  socket,
  tradingPair,
  portfolio
) => {
  let pairSettings = pairInfo.settings;
  const fullMultiplier = pairInfo.settings.WIGGLE_ROOM / 100 + 1;
  // Calculate the highest and lowest percentage multipliers according to the set WIGGLE_ROOM
  const openOptions = {
    symbol: tradingPair,
    timestamp: Date.now(),
  };

  const RSI = await getRSI(tradingPair, settings);

  //Check and set account balances
  let acbl = {
    FIAT: 0,
    MAIN_ASSET: 0,
  };
  if (portfolio.balances[settings.info[tradingPair].baseAsset]) {
    acbl.MAIN_ASSET =
      portfolio.balances[settings.info[tradingPair].baseAsset].free;
  }
  if (portfolio.balances[settings.info[tradingPair].quoteAsset]) {
    acbl.FIAT = portfolio.balances[settings.info[tradingPair].quoteAsset].free;
  }
  // Get the current price and also the latest two candle sticks
  const price = await checkPrice(tradingPair, settings);
  price.price = Number(price.price).toFixed(
    settings.info[tradingPair].quoteAssetPrecision
  );
  const current_price = price.price;
  socket.emit("priceUpdate", tradingPair, current_price);
  logger.info(`Ticker: ${tradingPair}: ${price.price}`);

  if (latestOrder[tradingPair] == undefined) {
    latestOrder[tradingPair] = {
      side: "BUY",
    };
  }
  // Check for open orders and if it is a BUY order and has not been filled within X minutes, cancel it
  // so that you can place another BUY order
  openOrders[tradingPair] = await openOrder(openOptions, settings);

  let topOrder = [];

  if (openOrders[tradingPair].length < 1) {
    // Check if there are existing orders, if any, then pick the top as the current order.
    topOrder = await allOrder(openOptions, settings);
    //   console.log("topOrder", topOrder);
    if (topOrder.length > 0) {
      latestOrder[tradingPair] = topOrder;
    }
  } else {
    latestOrder[tradingPair] = openOrders[tradingPair];
    topOrder = latestOrder[tradingPair];
  }

  /*   if (pairInfo.tradeEnabled) {
    const restart = await processStaleOrders(
      current_price,
      settings,
      pairInfo
    );
    if (restart) {
      await pretrade(settings, socket, tradingPair);
      return;
    }
  } */
  const tradeDetails = await makeDecision(
    settings,
    pairInfo,
    tradingPair,
    acbl,
    RSI,
    price,
    current_price,
    fullMultiplier,
    topOrder
  );

  if (tradeDetails) {
    socket.emit("wouldTrade", tradingPair, tradeDetails);
    if (pairInfo.tradeEnabled) {
      console.log(pairInfo.tradeEnabled, "should:", tradeDetails);
      const result = await newtrade(
        settings,
        pairInfo,
        socket,
        tradingPair,
        acbl,
        current_price,
        topOrder,
        tradeDetails
      );
      console.log("+++", latestOrder[tradingPair]);
      socket.emit("pending", tradingPair, latestOrder[tradingPair][0]);
    }
  }

  // Log information in the console about the pending order

  try {
    if (latestOrder[tradingPair] && latestOrder[tradingPair].length > 0) {
      socket.emit("ticker", tradingPair, current_price);
      let askDifference =
        latestOrder[tradingPair][0].origQty * current_price -
        latestOrder[tradingPair][0].origQty * latestOrder[tradingPair][0].price;
      logger.info(
        `Latest Order (${tradingPair}): | ${latestOrder[tradingPair][0].origQty}@${latestOrder[tradingPair][0].price} | ${latestOrder[tradingPair][0].side} | ${latestOrder[tradingPair][0].status}`
      );
      logger.info(
        `Asset Worth: | Ask: ${(
          latestOrder[tradingPair][0].origQty *
          latestOrder[tradingPair][0].price
        ).toFixed(6)} | Current: ${(
          latestOrder[tradingPair][0].origQty * current_price
        ).toFixed(6)} | diff: ${askDifference.toFixed(4)} (${(
          (latestOrder[tradingPair][0].price / current_price / current_price) *
          100
        ).toFixed(2)}%)`
      );
    }
  } catch (error) {
    logger.error("There was an error..", error);
  }
};
