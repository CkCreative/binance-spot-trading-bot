import fs from 'fs'
import {placeOrder, cancelOrder, openOrder, allOrder} from './bot/order'
import {checkPrice, accountBalances, avgPrice} from './bot/poll'
import settings from './settings.json'
import {sendDiscord} from './bot/utils'

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

    // Check for open orders and if it is a buy order and has not been filled within X minutes, cancel it
    // so that you can place another order
    openOrders = await openOrder(openOptions)
    try {
        const cancelOptions = {
            symbol: `${settings.MAIN_MARKET}`,
            orderId: '',
            originalClientOrderId: 'node_something_4',
            newClientOrderId: 'node_something_4',
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
        let topOrder = await allOrder(openOptions)
        if (topOrder.length > 0) {
            latestOrder = topOrder
            if (latestOrder[0].status != 'FILLED' && latestOrder[0].side == 'BUY') {
                // Make it so the buy keeps getting placed after being cancelled, but only buy.
                latestOrder[0].side = 'SELL'
            }
            if (topOrder[0].status == 'FILLED') {
                sendDiscord(`Order filled!`)
            }
        }

        // Initialize order options
        const orderOptions = {
            symbol: `${settings.MAIN_MARKET}`,
            side: latestOrder[0].side == 'SELL' ? 'BUY' : 'SELL',
            type: 'LIMIT',
            timeInForce: 'GTC',
            timestamp: Date.now(),
            quantity: `${settings.MAX_AMOUNT}`,
            price: latestOrder[0].side == 'BUY' ? Number(price.price*topBorder).toFixed(`${settings.PRECISION}`) : Number(price.price*bottomBorder).toFixed(`${settings.PRECISION}`),
            newClientOrderId: Date.now()
        }

        // If the order options indicate a BUY, save the details of the order, this is to help when 
        // setting the selling price later
        if (orderOptions.side == 'BUY') {
            const max_number = ((acbl.USDT-2)/orderOptions.price).toFixed()
            orderOptions.quantity = max_number
            try {
                fs.writeFileSync('./price.json', JSON.stringify({
                    action: orderOptions.side,
                    price: orderOptions.price,
                    time: Date.now()
                }))
              } catch (err) {
                console.error(err)
              }
        }

        // If the order options indicate a SELL, get the price at which the BUY was made so as to
        // calculate the correct SELL position to make the profit as per the pre-set percentage
        // The section also makes sure to sell 95% of the main asset. This will mean that it automatically
        // takes care of compounding.
        if (orderOptions.side == 'SELL') {
            let data = {}
            try {
                data = JSON.parse(fs.readFileSync('./price.json', 'utf8'))
                orderOptions.price = Number(data.price*fullMultiplier).toFixed(`${settings.PRECISION}`)
                orderOptions.quantity = (acbl.MAIN_ASSET*0.98).toFixed()
              } catch (err) {
                console.error(err)
              }
            
            if (orderOptions.price < price.price ) {
                orderOptions.price = price.price
            }
        }

        // Go ahead and place and order and send out appropriate notifications
        if (orderOptions.quantity != -0 || orderOptions.quantity != 0 ) {
            placeOrder(orderOptions).then(order => {
                if (order.msg) {
                    console.error(order)
                    sendDiscord(`Order could not be placed. Reason: \`\`\`${order.msg}\`\`\` when ordering for ${orderOptions.quantity}`)
                    return
                }
                sendDiscord(`New order placed for ${orderOptions.quantity}@${orderOptions.price} | ${orderOptions.side}`)
                latestOrder[0] = order
            });
        }
        
    } else {

        // If there is still an open order, just set that open order as the latest order
        latestOrder = openOrders
    }

    // Log information in the console about the pending order
    if (latestOrder.length > 0) {
        console.log(`Pending: OrderId: ${latestOrder[0].orderId} | ${latestOrder[0].origQty}@${latestOrder[0].price} | ${latestOrder[0].side} | ${latestOrder[0].status}`)
    }
}, 3000);
