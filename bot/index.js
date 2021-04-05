import {
    openOrder,
    allOrder,
    checkPrice,
    accountBalances
} from './functions/info'
import settings from './settings.json'
import { sendDiscord, getRSI, sendErrors, logger } from './functions/utils'
import {
    cancelStaleOrder,
    placeBuy,
    placeInitialBuy,
    placeInitialSell,
    placeLowSell,
    placeSell
} from './functions/actions'

// Calculate the highest and lowest percentage multipliers according to the set WIGGLE_ROOM
const width = settings.WIGGLE_ROOM / 100
const fullMultiplier = settings.WIGGLE_ROOM / 100 + 1
let bottomBorder = 1 - Number(width)
let cancelAfter = Number(settings.CANCEL_AFTER) * 60 * 60

let openOrders = []
let latestOrder = [{
    side: 'BUY'
}]
let acbl = {
    FIAT: 0,
    MAIN_ASSET: 0
}

// The loop is set to poll the APIs in X milliseconds.
setInterval(async () => {
    const openOptions = {
        symbol: `${settings.MAIN_MARKET}`,
        timestamp: Date.now()
    };

    const RSI = await getRSI().catch((e) => {
        logger.error(e)
    });

    //Check and set account balances
    ; (async () => {
        const { balances } = await accountBalances()
            .catch((e) => {
                logger.error(e)
            });

        if (balances) {
            for (let i in balances) {
                if (balances[i].asset == `${settings.MAIN_ASSET}`) {
                    acbl.MAIN_ASSET = balances[i].free
                }
                if (balances[i].asset == `${settings.FIAT}`) {
                    acbl.FIAT = balances[i].free
                }
            }
        } else {
            const { assets } = await accountBalances()
            for (let i in assets) {
                if (assets[i].asset == `${settings.MAIN_ASSET}`) {
                    acbl.MAIN_ASSET = assets[i].availableBalance
                }
                if (assets[i].asset == `${settings.FIAT}`) {
                    acbl.FIAT = assets[i].availableBalance
                }
            }
        }
    })();
    // logger.info(acbl)

    // Get the current price and also the latest two candle sticks
    const price = await checkPrice(`${settings.MAIN_MARKET}`)
        .catch((e) => {
            logger.error(e)
        });
    const current_price = price.price

    logger.info(`Ticker: ${price.price}`)
    price.price = Number(price.price).toFixed(`${settings.PRECISION}`)

    // Check for open orders and if it is a BUY order and has not been filled within X minutes, cancel it
    // so that you can place another BUY order
    openOrders = await openOrder(openOptions).catch((e) => {
        logger.error(e)
    });

    // Guard against errors
    if (openOrders.msg) {
        logger.error(openOrders.msg)
        const openOptions = {
            symbol: `${settings.MAIN_MARKET}`,
            timestamp: Date.now()
        };
        openOrders = await openOrder(openOptions).catch((e) => {
            logger.error(e)
        });

    }
    try {
        if (openOrders.length > 0
            && ((Date.now() - Number(openOrders[0].clientOrderId)) / 1000) > cancelAfter
            && openOrders[0].side == 'BUY') {
            await cancelStaleOrder(openOrders, current_price, fullMultiplier).catch((e) => {
                logger.error(e)
            });
        }

    } catch (error) {
        logger.error(error)
    }

    // Check if there is no open order, get the latest order and see if it was filed or cancelled and whether it is a 
    // buy order or a sell order.
    if (openOrders.length < 1) {

        // Check if there are existing orders, if any, then pick the top as the current order.
        let topOrder = await allOrder(openOptions).catch((e) => {
            logger.error(e)
        });

        // Guard against errors
        if (topOrder.msg) {
            logger.error(topOrder.msg)

            const openOptions = {
                symbol: `${settings.MAIN_MARKET}`,
                timestamp: Date.now()
            };
            topOrder = await allOrder(openOptions).catch((e) => {
                logger.error(e)
            });
        }
        if (topOrder.length > 0) {
            latestOrder = topOrder

            if ((latestOrder[0].side == 'SELL' && latestOrder[0].status == 'FILLED')
                || (latestOrder[0].status == 'CANCELED' && latestOrder[0].side == 'BUY')) {
                logger.info(`Placing normal BUY..`)
                latestOrder[0] = await placeBuy(acbl, latestOrder, bottomBorder, price, RSI).catch((e) => {
                    logger.error(e)
                });
                return
            }

            // Sell at a possible loss if the sell was cancelled

            if (latestOrder[0].status == 'CANCELED'
                && latestOrder[0].side == 'SELL') {
                logger.info(`Placing LOW SELL..`)
                latestOrder[0] = await placeLowSell(acbl, latestOrder, fullMultiplier, current_price).catch((e) => {
                    logger.error(e)
                });
                return
            }

            // If the last order is BUY and is FILLED, we can now SELL, also RESELL if it was cancelled SELL
            if ((latestOrder[0].status == 'FILLED' && latestOrder[0].side == 'BUY')
                || (latestOrder[0].status == 'CANCELED' && latestOrder[0].side == 'SELL')) {
                logger.info(`Placing normal SELL..`)
                latestOrder[0] = await placeSell(acbl, latestOrder, fullMultiplier, current_price).catch((e) => {
                    logger.error(e)
                });
                return
            }

        } else {
            sendDiscord(`There is no open order currently. Deciding which side to start with...`)

            if (acbl.FIAT > 11) {
                logger.info(`Placing initial BUY..`)
                latestOrder[0] = await placeInitialBuy(acbl, RSI, bottomBorder, price).catch((e) => {
                    logger.error(e)
                });
                return

            } else if (acbl.MAIN_ASSET * price.price > 11) {
                // Initialize order options
                logger.info(`Placing initial SELL..`)
                latestOrder[0] = await placeInitialSell(acbl, fullMultiplier).catch((e) => {
                    logger.error(e)
                });
                return

            } else {
                logger.error(`Insufficient funds..`)
                sendErrors(`Please add money to your account. You currently have only: $${acbl.FIAT} and ${acbl.MAIN_ASSET}${settings.MAIN_ASSET}, which is insufficient.`)
            }

        }

    } else {

        // If there is still an open order, just set that open order as the latest order
        latestOrder = openOrders
    }

    // Log information in the console about the pending order
    try {
        if (latestOrder.length > 0) {
            logger.info(`Latest Order: | ${latestOrder[0].origQty}@${latestOrder[0].price} | ${latestOrder[0].side} | ${latestOrder[0].status}`)
        }
    } catch (error) {
        logger.error("There was an error..", error)
    }

}, 3000);
