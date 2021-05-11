import {
    openOrder,
    allOrder,
    checkPrice,
    accountBalances
} from './functions/info'
import { sendNotification, getRSI, sendErrors, logger } from './functions/utils'
import {
    cancelStaleOrder,
    placeBuy,
    placeInitialBuy,
    placeInitialSell,
    placeLowSell,
    placeSell
} from './functions/actions'

import { telegramresponder }  from './functions/telegram_responder'

let openOrders = []
let latestOrder = [{
    side: 'BUY'
}]
let acbl = {
    FIAT: 0,
    MAIN_ASSET: 0
}

telegramresponder()

// The loop is set to poll the APIs in X milliseconds.
export const trade = async (settings, socket) => {
    // Calculate the highest and lowest percentage multipliers according to the set WIGGLE_ROOM
    const width = Number(settings.WIGGLE_ROOM / 100)
    const divider = Number(settings.BUYING_PRICE_DIVIDER)
    const fullMultiplier = (settings.WIGGLE_ROOM / 100) + 1
    let bottomBorder = 1 - (width / divider)

    let cancelAfter = Number(settings.CANCEL_AFTER)

    const openOptions = {
        symbol: `${settings.MAIN_MARKET}`,
        timestamp: Date.now()
    };

    const RSI = await getRSI(settings)

        //Check and set account balances
        ; (async () => {
            const { balances } = await accountBalances(settings)

            if (balances) {
                for (let i in balances) {
                    if (balances[i].asset == `${settings.info.baseAsset}`) {
                        acbl.MAIN_ASSET = balances[i].free
                    }
                    if (balances[i].asset == `${settings.info.quoteAsset}`) {
                        acbl.FIAT = balances[i].free
                    }
                }
            } else {
                const { assets } = await accountBalances(settings)
                for (let i in assets) {
                    if (assets[i].asset == `${settings.info.baseAsset}`) {
                        acbl.MAIN_ASSET = assets[i].availableBalance
                    }
                    if (assets[i].asset == `${settings.info.quoteAsset}`) {
                        acbl.FIAT = assets[i].availableBalance
                    }
                }
            }
        })();

    // Get the current price and also the latest two candle sticks
    const price = await checkPrice(`${settings.MAIN_MARKET}`, settings)
    const current_price = price.price

    logger.info(`Ticker: ${price.price}`)
    price.price = Number(price.price).toFixed(`${settings.info.quoteAssetPrecision}`)

    // Check for open orders and if it is a BUY order and has not been filled within X minutes, cancel it
    // so that you can place another BUY order
    openOrders = await openOrder(openOptions, settings)

    // Guard against errors
    if (openOrders.msg) {
        logger.error(openOrders.msg)
        const openOptions = {
            symbol: `${settings.MAIN_MARKET}`,
            timestamp: Date.now()
        };
        openOrders = await openOrder(openOptions, settings)

    }
    try {
        if (openOrders.length > 0
            && ((Date.now() - Number(openOrders[0].clientOrderId)) / 1000) > cancelAfter
            && openOrders[0].side == 'BUY') {
            await cancelStaleOrder(openOrders, current_price, fullMultiplier, settings)
        }

    } catch (error) {
        logger.error(error)
    }

    // Check if there is no open order, get the latest order and see if it was filed or cancelled and whether it is a 
    // buy order or a sell order.
    if (openOrders.length < 1) {

        // Check if there are existing orders, if any, then pick the top as the current order.
        let topOrder = await allOrder(openOptions, settings)

        // Guard against errors
        if (topOrder.msg) {
            logger.error(topOrder.msg)

            const openOptions = {
                symbol: `${settings.MAIN_MARKET}`,
                timestamp: Date.now()
            };
            topOrder = await allOrder(openOptions, settings)
        }
        if (topOrder.length > 0) {
            latestOrder = topOrder

            if ((latestOrder[0].side == 'SELL' && latestOrder[0].status == 'FILLED')
                || (latestOrder[0].status == 'CANCELED' && latestOrder[0].side == 'BUY')) {
                logger.info(`Placing normal BUY..`)
                latestOrder[0] = await placeBuy(acbl, latestOrder, bottomBorder, price, RSI, settings)
                return
            }

            // Sell at a possible loss if the sell was cancelled

            if (latestOrder[0].status == 'CANCELED'
                && latestOrder[0].side == 'SELL') {
                logger.info(`Placing LOW SELL..`)
                latestOrder[0] = await placeLowSell(acbl, latestOrder, fullMultiplier, current_price, settings)
                return
            }

            // If the last order is BUY and is FILLED, we can now SELL, also RESELL if it was cancelled SELL
            if ((latestOrder[0].status == 'FILLED' && latestOrder[0].side == 'BUY')
                || (latestOrder[0].status == 'CANCELED' && latestOrder[0].side == 'SELL')) {
                logger.info(`Placing normal SELL..`)
                latestOrder[0] = await placeSell(acbl, latestOrder, fullMultiplier, current_price, settings)
                return
            }

        } else {
            sendNotification(`There is no open order currently. Deciding which side to start with...`, settings)

            if (acbl.FIAT > Number(settings.info.minOrder)) {
                logger.info(`Placing initial BUY..`)
                latestOrder[0] = await placeInitialBuy(acbl, RSI, bottomBorder, price, settings)
                return

            } else if (acbl.MAIN_ASSET * price.price > Number(settings.info.minOrder)) {
                // Initialize order options
                logger.info(`Placing initial SELL..`)
                latestOrder[0] = await placeInitialSell(acbl, fullMultiplier, settings)
                return

            } else {
                logger.error(`Insufficient funds..`)
                sendErrors(`Please add money to your account. You currently have only: $${acbl.FIAT} and ${acbl.MAIN_ASSET}${settings.MAIN_ASSET}, which is insufficient.`, settings)
            }

        }

    } else {

        // If there is still an open order, just set that open order as the latest order
        latestOrder = openOrders
    }

    // Log information in the console about the pending order
    try {
        if (latestOrder.length > 0) {
            socket.emit('pending', latestOrder[0]);
            socket.emit('ticker', current_price);
            logger.info(`Latest Order: | ${latestOrder[0].origQty}@${latestOrder[0].price} | ${latestOrder[0].side} | ${latestOrder[0].status}`)
        }
    } catch (error) {
        logger.error("There was an error..", error)
    }

};
