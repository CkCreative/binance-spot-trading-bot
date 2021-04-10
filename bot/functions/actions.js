const fetch = require('node-fetch');
const crypto = require('crypto')

import { sendNotification, sendErrors, logger } from './utils'

// Place order function, it takes order options, places and order and returns the response, asyncronously
export const placeOrder = async function (o, st) {
    const to_sign = `symbol=${o.symbol}&side=${o.side}&type=${o.type}&timeInForce=${o.timeInForce}&quantity=${o.quantity}&price=${o.price}&newClientOrderId=${o.newClientOrderId}&timestamp=${o.timestamp}`

    const hmac = crypto.createHmac('sha256', st.API_SECRET)
        .update(to_sign)
        .digest('hex')

    try {
        const res = await fetch(`${st.URL}/order?${to_sign}&signature=${hmac}`, {
            method: 'POST',
            headers: {
                'X-MBX-APIKEY': `${st.API_KEY}`,
                'Content-Type': 'application/json'
            }
        })
        const json = await res.json()
        return json
    } catch (error) {
        logger.error(error)
    }

}

// Function to cancel the order defined by the options presented
export const cancelOrder = function (o, st) {
    const to_sign = `symbol=${o.symbol}&orderId=${o.orderId}&timestamp=${o.timestamp}`

    const hmac = crypto.createHmac('sha256', st.API_SECRET)
        .update(to_sign)
        .digest('hex')

    fetch(`${st.URL}/order?${to_sign}&signature=${hmac}`, {
        method: 'DELETE',
        headers: {
            'X-MBX-APIKEY': `${st.API_KEY}`,
            'Content-Type': 'application/json'
        }
    })
        .then(res => res.json())
        .then(json => logger.info('Order cancelled...'))
        .catch(e => logger.error(e));
}

export const cancelStaleOrder = async function (openOrders, current_price, fullMultiplier, st) {
    const cancelOptions = {
        symbol: `${st.MAIN_MARKET}`,
        orderId: '',
        timestamp: Date.now()
    }
    const previousSellingPrice = openOrders[0].price
    const newSellingPrice = current_price * fullMultiplier
    const possibleLoss = Number(((previousSellingPrice - newSellingPrice) / previousSellingPrice) * 100).toFixed(2)

    cancelOptions.orderId = openOrders[0].orderId
    logger.info("The order is stale. \n Cancelling...")
    logger.info(`Time difference is ${(Date.now() - Number(openOrders[0].clientOrderId)) / 1000}s`)

    if (openOrders[0].side == 'BUY') {
        cancelOrder(cancelOptions, st)
        sendNotification(`Order number ${cancelOptions.orderId} was stale and thus cancelled!`)
        return
    }

    if (openOrders[0].side == 'SELL' && possibleLoss > st.ACCEPTABLE_LOSS) {
        sendErrors(`Possible loss ${possibleLoss}% if sold at ${Number(current_price * fullMultiplier).toFixed(`${st.info.quoteAssetPrecision} => Order not cancelled.`)}`)
        return
    } else {
        cancelOrder(cancelOptions, st)
        sendNotification(`Order number ${cancelOptions.orderId} was stale and thus cancelled!`)
        return
    }

}

export const placeBuy = async function (acbl, latestOrder, bottomBorder, price, RSI, st) {

    if (RSI > st.HIGHEST_RSI) {
        logger.error(`Exiting, RSI is ${RSI}, which is above ${st.HIGHEST_RSI}`)
        sendErrors(`Exiting, RSI is ${RSI}, which is above ${st.HIGHEST_RSI}`)
        return
    }
    const buyingPrice = Number(price.price * bottomBorder).toFixed(`${st.info.quoteAssetPrecision}`)
    const quantityToBuy = ((acbl.FIAT * 0.99) / buyingPrice).toFixed(`${st.info.minQty}`)
    // Initialize order options
    const orderOptions = {
        symbol: `${st.MAIN_MARKET}`,
        side: 'BUY',
        type: 'LIMIT',
        timeInForce: 'GTC',
        timestamp: Date.now(),
        quantity: quantityToBuy,
        price: buyingPrice,
        newClientOrderId: Date.now()
    }
    if ((orderOptions.quantity != -0 || orderOptions.quantity != 0) && (quantityToBuy * buyingPrice) >= Number(st.info.minOrder)) {
        placeOrder(orderOptions, st).then(order => {
            if (order.msg) {
                logger.error(order)
                sendErrors(`Order could not be placed. Reason: \`\`\`${order.msg}\`\`\` when ordering for ${orderOptions.quantity}`)
                return
            }
            sendNotification(`New order placed for ${orderOptions.quantity}@${orderOptions.price} | ${orderOptions.side}`)
            return order
        }).catch((e) => {
            logger.error(e)
        });
    } else if ((quantityToBuy * buyingPrice) <= Number(st.info.minOrder)) {
        logger.error(`You cannot place a buy order for less than ${Number(st.info.minOrder)} ${st.quoteAsset}`)
    } else {
        logger.error('There was an error placing BUY order.')
        return latestOrder[0]
    }
}

export const placeSell = async function (acbl, latestOrder, fullMultiplier, current_price, st) {
    // Get the last buy price from the API, and if it less than the current price,
    // use the current price instead.
    // If the last order is BUY and is FILLED, we can now SELL, also RESELL if it was cancelled SELL

    let sellingPrice = Number(latestOrder[0].price * fullMultiplier).toFixed(`${st.info.quoteAssetPrecision}`)
    sellingPrice = sellingPrice < current_price ? (current_price * fullMultiplier).toFixed(`${st.info.quoteAssetPrecision}`) : sellingPrice
    const sellingQuantity = (acbl.MAIN_ASSET * 0.98).toFixed(`${st.info.minQty}`)
    const sellingOptions = {
        symbol: `${st.MAIN_MARKET}`,
        side: 'SELL',
        type: 'LIMIT',
        timeInForce: 'GTC',
        timestamp: Date.now(),
        quantity: sellingQuantity,
        price: sellingPrice,
        newClientOrderId: Date.now()
    }

    if ((sellingOptions.quantity != -0 || sellingOptions.quantity != 0) && acbl.MAIN_ASSET * sellingPrice >= Number(st.info.minOrder)) {
        placeOrder(sellingOptions, st).then(order => {
            if (order.msg) {
                logger.error(order)
                sendErrors(`Order could not be placed. Reason: \`\`\`${order.msg}\`\`\` when ordering for ${sellingOptions.quantity}`)
                return
            }
            sendNotification(`New order placed for ${sellingOptions.quantity}@${sellingOptions.price} | ${sellingOptions.side}`)
            return order
        }).catch((e) => {
            logger.error(e)
        });
    } else {
        logger.error('There was an error placing SELL order.')
        return latestOrder[0]
    }
}

export const placeLowSell = async function (acbl, latestOrder, fullMultiplier, current_price, st) {
    // Sell at a small loss.
    let sellingPrice = Number(current_price * fullMultiplier).toFixed(`${st.info.quoteAssetPrecision}`)
    //sellingPrice = sellingPrice < current_price ? (current_price*fullMultiplier).toFixed(`${st.info.quoteAssetPrecision}`) : sellingPrice
    const sellingQuantity = (acbl.MAIN_ASSET * 0.98).toFixed(`${st.info.minQty}`)
    const sellingOptions = {
        symbol: `${st.MAIN_MARKET}`,
        side: 'SELL',
        type: 'LIMIT',
        timeInForce: 'GTC',
        timestamp: Date.now(),
        quantity: sellingQuantity,
        price: sellingPrice,
        newClientOrderId: Date.now()
    }

    if ((sellingOptions.quantity != -0 || sellingOptions.quantity != 0) && acbl.MAIN_ASSET * sellingPrice >= Number(st.info.minOrder)) {
        placeOrder(sellingOptions, st).then(order => {
            if (order.msg) {
                logger.error(order)
                sendErrors(`Order could not be placed. Reason: \`\`\`${order.msg}\`\`\` when ordering for ${sellingOptions.quantity}`)
                return
            }
            sendNotification(`New order placed for ${sellingOptions.quantity}@${sellingOptions.price} | ${sellingOptions.side} - a possible loss`)
            return order
        }).catch((e) => {
            logger.error(e)
        });
    } else {
        logger.error('There was an error placing SELL order.')
        return latestOrder[0]
    }
}

export const placeInitialBuy = async function (acbl, RSI, bottomBorder, price, st) {
    if (RSI > st.HIGHEST_RSI) {
        logger.error(`Exiting, RSI is ${RSI}, which is above ${st.HIGHEST_RSI}`)
        sendErrors(`Exiting, RSI is ${RSI}, which is above ${st.HIGHEST_RSI}`)
        return
    }
    // Initialize order options
    sendNotification(`There is $${acbl.FIAT} in the account. => BUY order will be placed.`)
    const buyPrice = Number(price.price * bottomBorder).toFixed(`${st.info.quoteAssetPrecision}`)
    const buyQuantity = ((acbl.FIAT * 0.99) / buyPrice).toFixed(`${st.info.minQty}`)
    const buyOptions = {
        symbol: `${st.MAIN_MARKET}`,
        side: 'BUY',
        type: 'LIMIT',
        timeInForce: 'GTC',
        timestamp: Date.now(),
        quantity: buyQuantity,
        price: buyPrice,
        newClientOrderId: Date.now()
    }

    if (buyOptions.quantity != -0 || buyOptions.quantity != 0) {
        placeOrder(buyOptions, st).then(order => {
            if (order.msg) {
                logger.error(order)
                sendErrors(`Order could not be placed. Reason: \`\`\`${order.msg}\`\`\` when ordering for ${buyOptions.quantity}`)
                return
            }
            sendNotification(`New order placed for ${buyOptions.quantity}@${buyOptions.price} | ${buyOptions.side}`)
            return order
        }).catch((e) => {
            logger.error(e)
        });
    }
}

export const placeInitialSell = async function (acbl, fullMultiplier, st) {
    sendNotification(`There is ${acbl.MAIN_ASSET} ${st.info.baseAsset} in the account. => SELL order will be placed.`)
    const sellPrice = Number(price.price * fullMultiplier).toFixed(`${st.info.quoteAssetPrecision}`)
    const sellQuantity = (acbl.MAIN_ASSET * 0.98).toFixed(`${st.info.minQty}`)
    const sellOptions = {
        symbol: `${st.MAIN_MARKET}`,
        side: 'SELL',
        type: 'LIMIT',
        timeInForce: 'GTC',
        timestamp: Date.now(),
        quantity: sellQuantity,
        price: sellPrice,
        newClientOrderId: Date.now()
    }

    if (sellOptions.quantity != -0 || sellOptions.quantity != 0) {
        placeOrder(sellOptions, st).then(order => {
            if (order.msg) {
                logger.error(order)
                sendErrors(`Order could not be placed. Reason: \`\`\`${order.msg}\`\`\` when ordering for ${sellOptions.quantity}`)
                return
            }
            sendNotification(`New order placed for ${sellOptions.quantity}@${sellOptions.price} | ${sellOptions.side}`)
            return order
        }).catch((e) => {
            logger.error(e)
        });
    }
}
