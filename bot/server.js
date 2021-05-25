const fs = require("fs");
const express = require("express");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = require("socket.io")(server);

const Binance = require("node-binance-api");

import { pretrade, updateAnalytics } from "./index";
import { clearInterval } from "timers";
import {
  logger,
  profitTracker,
  check,
  sendNotification,
} from "./functions/utils";
import {
  exchangeInfo,
  accountBalances,
  parseExchangeInfo,
} from "./functions/info";
import { Console } from "console";
const cron = require("node-cron");

function startTime() {
  return new Date();
}
function stopTime(time) {
  return startTime() - time;
}
io.on("connection", (socket) => {
  logger.info("a user connected");
});

app.set("view engine", "pug");
app.set("views", "./views");
app.use(
  express.urlencoded({
    extended: true,
  })
);

let obj = require("./settings.json");

const binance = new Binance().options({
  APIKEY: obj.API_KEY,
  APISECRET: obj.API_SECRET,
});

let info = {
  minOrder: 0,
  minQty: 0,
  baseAsset: "",
  quoteAsset: "",
  quoteAssetPrecision: 0,
};

let portfolio = {
  balances: {},
  pairs: {},
  info: {},
  orders: {
    all: {},
  },
};

let exchange = {
  timeOffset: 0,
  info: {},
};
let canMonitor = {};

obj.MONITOR_MARKETS.forEach((tradePair) => {
  let tradeEnabled = false;
  if (obj.ENABLED_MARKETS.indexOf(tradePair) != -1) {
    logger.warn(`Trading enabled for ${tradePair}`);
    tradeEnabled = true;
  }
  portfolio.pairs[tradePair] = {
    pairName: tradePair,
    tradeEnabled: tradeEnabled,
    monitorEnabled: true,
    settings: {},
    tradeHistory: {},
    candlesticks: {},
  };
  binance.trades(tradePair, (error, trades, symbol) => {
    // binance don't guarantee the order. 
    if(error) return console.error(error);
    console.log(trades);
    
    trades.sort((a, b) => {
      // or is it updateTime??
      return a.time - b.time;
    });
    portfolio.pairs[symbol].tradeHistory = trades;
    //console.info(symbol + " trade history", trades);
    io.emit("portfolio", portfolio);
  });
});
binance.websockets.chart(
  obj.MONITOR_MARKETS,
  "1m",
  (symbol, interval, chart) => {
    let tick = binance.last(chart);
    if (!tick) return console.error(chart);
    const last = chart[tick].close;
    // Optionally convert 'chart' object to array:
    // let ohlc = binance.ohlc(chart);
    //console.info(symbol, ohlc);
    io.emit("chartUpdate", symbol, chart);
    io.emit("priceUpdate", symbol, last);
    if (symbol == "ETHBUSD") {
      if (last < 2050 || last > 2800) {
        sendNotification(`${symbol} is at ${last}`, obj);
      }
    }

    //updateAnalytics();
    //console.log(binance.subscriptions);
    //console.log(`chartupdate: ${symbol} is at ${last}`);
  }
);
binance.websockets.candlesticks(obj.MONITOR_MARKETS, "1m", (candlesticks) => {
  let { e:eventType, E:eventTime, s:symbol, k:ticks } = candlesticks;
  let { o:open, h:high, l:low, c:close, v:volume, n:trades, i:interval, x:isFinal, q:quoteVolume, V:buyVolume, Q:quoteBuyVolume } = ticks;
   //console.info(symbol+" "+interval+" candlestick update");
/*  console.info("open: "+open);
  console.info("high: "+high);
  console.info("low: "+low);
  console.info("close: "+close);
  console.info("volume: "+volume);
  console.info("isFinal: "+isFinal); */
  let candleTime = new Date(candlesticks.E ).setSeconds(0,0);
  if(!portfolio.pairs[symbol].candlesticks[candleTime]||
    candlesticks.E > portfolio.pairs[symbol].candlesticks[candleTime].E ){
    portfolio.pairs[symbol].candlesticks[candleTime] = candlesticks;
    console.log(`${symbol} .. ${candlesticks.E}`);
  } 

  //updateAnalytics();
});

function balance_update(data) {
  console.log("Balance Update");
  if (data.B) {
    console.log("Balance Update 3");
    for (let obj of data.B) {
      let { a: asset, f: available, l: onOrder } = obj;
      if (available + onOrder == "0.00000000") continue;
      portfolio.balances[asset] = {
        asset: asset,
        available: available,
        onOrder: onOrder,
      };
    }
  } else {
    console.log("Balance Update 2");
    for (let symbol in data) {
      let asset = data[symbol];
      asset.asset = symbol;
      if (parseFloat(asset.available) + parseFloat(asset.onOrder) == 0)
        continue;
      portfolio.balances[symbol] = asset;
    }
  }
  io.emit("portfolio", portfolio);
}

function execution_update(data) {
  let {
    x: executionType,
    s: symbol,
    p: price,
    q: quantity,
    S: side,
    o: orderType,
    i: orderId,
    X: orderStatus,
  } = data;
  if (executionType == "NEW") {
    if (orderStatus == "REJECTED") {
      console.log("Order Failed! Reason: " + data.r);
    }
    console.log(
      symbol +
        " " +
        side +
        " " +
        orderType +
        " ORDER #" +
        orderId +
        " (" +
        orderStatus +
        ")"
    );
    console.log("..price: " + price + ", quantity: " + quantity);
    return;
  }
  //NEW, CANCELED, REPLACED, REJECTED, TRADE, EXPIRED
  console.log(
    symbol +
      "\t" +
      side +
      " " +
      executionType +
      " " +
      orderType +
      " ORDER #" +
      orderId
  );
  pretrade(obj, portfolio.pairs[symbol], io, symbol, portfolio,false, binance);
}
binance.websockets.userData(balance_update, execution_update);
logger.start_log("init-exchangeInfo", "info");
let tmr = new Date();
binance.balance((error, balances) => {
  if (error) return console.error(error);
  balance_update(balances);
});
binance.exchangeInfo(async function (error, response) {
  console.log("time:", stopTime(tmr));
  if (error) return console.error(error);
  logger.stop_log("init-exchangeInfo", "warn");
  exchange.info = response;
  //console.log("exc",response);
  portfolio.info = await parseExchangeInfo(response, obj.MONITOR_MARKETS);
  if (Object.keys(portfolio.info).length == 0) {
    logger.error(
      `No information retreived. Probably the trading pair does not exist`
    );
    process.exit();
  }
  obj.info = portfolio.info;
  exchange.timeOffset = tmr.getTime() - exchange.info.serverTime;
  console.log(tmr.getTime(), exchange.info.serverTime, exchange.timeOffset);
});
const port = obj.PORT;

let mainLoop;
(async () => {
  // Wait for the initial load of balances and exchange info before starting the main loop
  let startupLoop = setInterval(() => {
    console.log("Waiting...");
    if (
      Object.keys(portfolio.info).length &&
      Object.keys(portfolio.balances).length
    ) {
      clearInterval(startupLoop);
      console.log("Got the basics, let's go!!");
      //console.log(exchange);

      mainLoop = setInterval(async () => {
        /*         const { balances } = await accountBalances(obj);
         */
        io.emit("portfolio", portfolio);
        for (let p in portfolio.pairs) {
          portfolio.pairs[p].settings = {
            ...portfolio.pairs[p].settings,
            ...obj.defaults,
          };
          //  logger.info(`Processing ${p}`);
          if (
            portfolio.pairs[p].monitorEnabled ||
            portfolio.pairs[p].tradeEnabled
          ) {
           pretrade(obj, portfolio.pairs[p], io, p, portfolio,false, binance);
          }
          if (portfolio.pairs[p].tradeEnabled) {
            //   pretrade(obj, io, p, portfolio);
          }
        }
      }, obj.INTERVAL);
    }
  
  }, 1000);
})();

let draft;
(async () => {
  info = {
    ...(await exchangeInfo(obj)),
  };
  obj.info = info;
  if (obj.info.baseAsset == "") {
    logger.error(
      `No information retreived. Probably the trading pair does not exist`
    );
    process.exit();
  }

  draft = setInterval(() => {
    if (obj.STATE == "ON") {
      //   trade(obj, io);
    } else {
      return;
    }
  }, obj.INTERVAL);
})();

// initialize profit tracker
// initial check
check(io, obj, portfolio.pairs);

cron.schedule("* * * * *", async () => {
  // subsequent checks by the minute
  check(io, obj, portfolio.pairs);
});

app.use(express.static('public'))

app.get("/", (req, res) => {
  res.render("form", {
    data: obj,
  });
});


app.post("/start", (req, res) => {
  let { pin, action } = req.body;
  logger.info(action);
  if (pin == obj.PIN && action == "START") {
    obj.STATE = "ON";
    fs.writeFileSync("settings.json", JSON.stringify(obj, null, 2));
    clearInterval(draft);
    draft = setInterval(() => {
      if (obj.STATE == "ON") {
        //    trade(obj, io);
      } else {
        return;
      }
    }, obj.INTERVAL);
    res.redirect("/");
  } else {
    res.send("gHOST!");
  }
});

app.post("/stop", (req, res) => {
  let { pin, action } = req.body;

  if (pin == obj.PIN && action == "STOP") {
    obj.STATE = "OFF";
    fs.writeFileSync("settings.json", JSON.stringify(obj, null, 2));
    logger.info(action);
    clearInterval(draft);
    res.redirect("/");
  } else {
    res.send("gHOST!");
  }
});

app.post("/", (req, res) => {
  let {
    pin,
    interval_value,
    market,
    room,
    asset_pct,
    fiat_or_quote_pct,
    after,
    instance,
    divider,
  } = req.body;

  if (pin == obj.PIN) {
    obj.INTERVAL = interval_value;
    obj.MAIN_MARKET = market;
    obj.CANCEL_AFTER = after;
    obj.WIGGLE_ROOM = room;
    obj.ASSET_PERCENT = asset_pct;
    obj.FIAT_OR_QUOTE_PERCENT = fiat_or_quote_pct;
    obj.INSTANCE_NAME = instance;
    obj.BUYING_PRICE_DIVIDER = divider;

    fs.writeFileSync("settings.json", JSON.stringify(obj, null, 2));

    obj = JSON.parse(fs.readFileSync("settings.json", "utf8"));
    (async () => {
      info = {
        ...(await exchangeInfo(obj)),
      };
      obj.info = info;
      if (obj.info.baseAsset == "") {
        logger.error(
          `No information retreived. Probably the trading pair does not exist`
        );
        process.exit();
      }
      clearInterval(draft);
      draft = setInterval(async () => {
        if (obj.STATE == "ON") {
          //  trade(obj, io);
        } else {
          return;
        }
      }, obj.INTERVAL);
    })();

    res.redirect("/");
  } else {
    res.send("gHOST!");
  }
});

server.listen(port, "0.0.0.0", () => {
  logger.info(`Binance bot listening at http://localhost:${port}`);
});
