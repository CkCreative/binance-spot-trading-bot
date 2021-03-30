import {placeOrder, cancelOrder, openOrder, allOrder} from './functions/order'
import {checkPrice, accountBalances, avgPrice} from './functions/poll'
import settings from './settings.json'
import {sendDiscord} from './functions/utils'

// Calculate the highest and lowest percentage multipliers according to the set WIGGLE_ROOM
const width = settings.WIGGLE_ROOM/100
const fullMultiplier = settings.WIGGLE_ROOM/100+1
const topBorder = 1+Number(width)/2
const bottomBorder = 1-Number(width)/2

let openOrders = []
let latestOrder = [{
    side: 'BUY'
}]
let acbl = {
    USDT: 0,
    MAIN_ASSET: 0
}

// The loop is set to poll the APIs in X milliseconds.
setInterval(async() => {
    const openOptions = {
        symbol: `${settings.MAIN_MARKET}`,
        timestamp: Date.now()
    };

    //Check and set account balances
    (async() => {
        const {balances} = await accountBalances()
    
        for (let i in balances) {
            if (balances[i].asset==`${settings.MAIN_ASSET}`) {
                acbl.MAIN_ASSET = balances[i].free
            }
            if (balances[i].asset=='USDT') {
                acbl.USDT = balances[i].free
            }
        }
    })();
    
    // Get the current price and also the latest two candle sticks
    const price = await checkPrice(`${settings.MAIN_MARKET}`)
    const current_price = price.price
    const avgP = await avgPrice(`${settings.MAIN_MARKET}`)
    const avg1 = (Number(avgP[0][1]) + Number(avgP[0][4]))/2
    const avg2 = (Number(avgP[1][1]) + Number(avgP[1][4]))/2
    const avg = Number((avg1+avg2)/2).toFixed(`${settings.PRECISION}`)
    console.log(`Ticker: ${price.price} | Average: ${avg}`)

    // Choose the lowest price between the average of the candle sticks and the current price 
    // This is so that you don't accidentally buy at the top (Current price) instead of somewhere
    // in between.
    if (avg < price.price) {
        price.price = avg
    }
    price.price = Number(price.price).toFixed(`${settings.PRECISION}`)
    console.log(`Chosen price: ${price.price}`)

    // Check for open orders and if it is a BUY order and has not been filled within X minutes, cancel it
    // so that you can place another BUY order
    openOrders = await openOrder(openOptions)
    
    // Guard against errors
    if (openOrders.msg) {
        console.log('Error: ', openOrders.msg)
        const openOptions = {
            symbol: `${settings.MAIN_MARKET}`,
            timestamp: Date.now()
        };
        openOrders = await openOrder(openOptions) 
        
    }
    try {
        const cancelOptions = {
            symbol: `${settings.MAIN_MARKET}`,
            orderId: '',
            timestamp: Date.now()
        }
        if (openOrders.length > 0 && ((Date.now() - Number(openOrders[0].clientOrderId))/1000)>5*60 && openOrders[0].side == 'BUY') {
            cancelOptions.orderId = openOrders[0].orderId
            console.log("The order is stale. \n Cancelling...")
            console.log(`Time difference is ${(Date.now() - Number(openOrders[0].clientOrderId))/1000}s`)
            cancelOrder(cancelOptions)
            sendDiscord(`Order number ${cancelOptions.orderId} was stale and thus cancelled!`)
            openOrders = []
        }
    } catch (error) {
        console.log(error)
    }

    // Check if there is no open order, get the latest order and see if it was filed or cancelled and whether it is a 
    // buy order or a sell order.
    if (openOrders.length < 1) {

        // Check if there are existing orders, if any, then pick the top as the current order.
        let topOrder = await allOrder(openOptions)

        // Guard against errors
        if (topOrder.msg) {
            console.log('Error: ', topOrder.msg)

            const openOptions = {
                symbol: `${settings.MAIN_MARKET}`,
                timestamp: Date.now()
            };
            topOrder = await allOrder(openOptions) 
        }
        if (topOrder.length > 0) {
            latestOrder = topOrder
            
            // If the latest order is filled and it is a BUY order
            if (topOrder[0].status == 'FILLED' && topOrder[0].side == 'BUY') {
                sendDiscord(`Bought. Placing a new order...`)
            }

            // If the latest order is filled and it is a SELL order
            if (topOrder[0].status == 'FILLED' && topOrder[0].side == 'SELL') {
                sendDiscord(`Sold. Placing a new order...`)
            }

            if (latestOrder[0].side == 'SELL' || (latestOrder[0].status == 'CANCELED' && latestOrder[0].side == 'BUY')) {
                const buyingPrice = Number(price.price*bottomBorder).toFixed(`${settings.PRECISION}`)
                const quantityToBuy = ((acbl.USDT-2)/buyingPrice).toFixed(`${settings.MAIN_ASSET_DECIMALS}`)
                // Initialize order options
                const orderOptions = {
                    symbol: `${settings.MAIN_MARKET}`,
                    side:  'BUY',
                    type: 'LIMIT',
                    timeInForce: 'GTC',
                    timestamp: Date.now(),
                    quantity: quantityToBuy,
                    price: buyingPrice,
                    newClientOrderId: Date.now()
                }
                if ((orderOptions.quantity != -0 || orderOptions.quantity != 0) && quantityToBuy*buyingPrice >= 15) {
                    placeOrder(orderOptions).then(order => {
                        if (order.msg) {
                            console.error(order)
                            sendDiscord(`Order could not be placed. Reason: \`\`\`${order.msg}\`\`\` when ordering for ${orderOptions.quantity}`)
                            return
                        }
                        sendDiscord(`New order placed for ${orderOptions.quantity}@${orderOptions.price} | ${orderOptions.side}`)
                        latestOrder[0] = order
                        return
                    });
                } else {
                    console.log('There was an error placing BUY order.')
                }
            }
    
            // Get the last buy price from the API, and if it less than the current price,
            // use the current price instead.
            // If the last order is BUY and is FILLED, we can now SELL
            if (latestOrder[0].status == 'FILLED' && latestOrder[0].side == 'BUY') {
                let sellingPrice = Number(latestOrder[0].price*topBorder).toFixed(`${settings.PRECISION}`)
                sellingPrice = sellingPrice < current_price ? (current_price*topBorder).toFixed(`${settings.PRECISION}`) : sellingPrice
                const sellingQuantity = (acbl.MAIN_ASSET*0.98).toFixed(`${settings.MAIN_ASSET_DECIMALS}`)
                const sellingOptions = {
                    symbol: `${settings.MAIN_MARKET}`,
                    side: 'SELL',
                    type: 'LIMIT',
                    timeInForce: 'GTC',
                    timestamp: Date.now(),
                    quantity: sellingQuantity,
                    price: sellingPrice,
                    newClientOrderId: Date.now()
                }
    
                if ((sellingOptions.quantity != -0 || sellingOptions.quantity != 0) && acbl.MAIN_ASSET*sellingPrice >= 15) {
                    placeOrder(sellingOptions).then(order => {
                        if (order.msg) {
                            console.error(order)
                            sendDiscord(`Order could not be placed. Reason: \`\`\`${order.msg}\`\`\` when ordering for ${sellingOptions.quantity}`)
                            return
                        }
                        sendDiscord(`New order placed for ${sellingOptions.quantity}@${sellingOptions.price} | ${sellingOptions.side}`)
                        latestOrder[0] = order
                        return
                    });
                } else {
                    console.log('There was an error placing SELL order.')
                }
            }
        } else {
            sendDiscord(`There is no open order currently. Deciding which side to start with...`)

            if (acbl.USDT > 15) {
                // Initialize order options
                sendDiscord(`There is $${acbl.USDT} in the account. => BUY order will be placed.`)
                const buyPrice = Number(price.price*bottomBorder).toFixed(`${settings.PRECISION}`)
                const buyQuantity = ((acbl.USDT-2)/buyPrice).toFixed(`${settings.MAIN_ASSET_DECIMALS}`)
                const buyOptions = {
                    symbol: `${settings.MAIN_MARKET}`,
                    side: 'BUY',
                    type: 'LIMIT',
                    timeInForce: 'GTC',
                    timestamp: Date.now(),
                    quantity: buyQuantity,
                    price: buyPrice,
                    newClientOrderId: Date.now()
                }

                if (buyOptions.quantity != -0 || buyOptions.quantity != 0) {
                    placeOrder(buyOptions).then(order => {
                        if (order.msg) {
                            console.error(order)
                            sendDiscord(`Order could not be placed. Reason: \`\`\`${order.msg}\`\`\` when ordering for ${buyOptions.quantity}`)
                            return
                        }
                        sendDiscord(`New order placed for ${buyOptions.quantity}@${buyOptions.price} | ${buyOptions.side}`)
                        latestOrder[0] = order
                        return
                    });
                }
 
            } else if (acbl.MAIN_ASSET*price.price > 15) {
                // Initialize order options
                sendDiscord(`There is ${acbl.MAIN_ASSET} ${settings.MAIN_ASSET} in the account. => SELL order will be placed.`)
                const sellPrice = Number(price.price*topBorder).toFixed(`${settings.PRECISION}`)
                const sellQuantity = (acbl.MAIN_ASSET*0.98).toFixed(`${settings.MAIN_ASSET_DECIMALS}`)
                const sellOptions = {
                    symbol: `${settings.MAIN_MARKET}`,
                    side: 'SELL',
                    type: 'LIMIT',
                    timeInForce: 'GTC',
                    timestamp: Date.now(),
                    quantity: sellQuantity,
                    price: sellPrice,
                    newClientOrderId: Date.now()
                }

                if (sellOptions.quantity != -0 || sellOptions.quantity != 0) {
                    placeOrder(sellOptions).then(order => {
                        if (order.msg) {
                            console.error(order)
                            sendDiscord(`Order could not be placed. Reason: \`\`\`${order.msg}\`\`\` when ordering for ${sellOptions.quantity}`)
                            return
                        }
                        sendDiscord(`New order placed for ${sellOptions.quantity}@${sellOptions.price} | ${sellOptions.side}`)
                        latestOrder[0] = order
                        return
                    });
                }
 
            } else {
                sendDiscord(`Please add money to your account. You currently have only: $${acbl.USDT} and ${acbl.MAIN_ASSET}${settings.MAIN_ASSET}, which is insufficient.`)
            }

        }

        // If the order options indicate a BUY, save the details of the order, this is to help when 
        // setting the selling price later
        // If we sold the last time, the we now need to BUY
        
        
    } else {

        // If there is still an open order, just set that open order as the latest order
        latestOrder = openOrders
    }

    // Log information in the console about the pending order
    if (latestOrder.length > 0) {
        console.log(`Latest Order: | ${latestOrder[0].origQty}@${latestOrder[0].price} | ${latestOrder[0].side} | ${latestOrder[0].status}`)
    }
}, 3000);
