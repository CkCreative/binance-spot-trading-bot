const fetch = require('node-fetch');
const crypto = require('crypto')

import { logger } from './utils'

// Check the status of a given order function
export const checkOrder = function (o, st) {
    const to_sign = `symbol=${o.symbol}&recvWindow=60000&orderId=${o.orderId}&origClientOrderId=${o.originalClientOrderId}&timestamp=${o.timestamp}`

    const hmac = crypto.createHmac('sha256', st.API_SECRET)
        .update(to_sign)
        .digest('hex')

    fetch(`${st.URL}/order?${to_sign}&signature=${hmac}`, {
        method: 'GET',
        headers: {
            'X-MBX-APIKEY': `${st.API_KEY}`,
            'Content-Type': 'application/json'
        }
    })
        .then(res => res.json())
        .then(json => logger.info(json));
}

// Check for any open orders function, return the result asynchronously
export const openOrder = async function (o, st) {
    const to_sign = `symbol=${o.symbol}&recvWindow=60000&timestamp=${o.timestamp}`

    const hmac = crypto.createHmac('sha256', st.API_SECRET)
        .update(to_sign)
        .digest('hex')

    const res = await fetch(`${st.URL}/openOrders?${to_sign}&signature=${hmac}`, {
        method: 'GET',
        headers: {
            'X-MBX-APIKEY': `${st.API_KEY}`,
            'Content-Type': 'application/json'
        }
    })
    const json = await res.json()
    return json
}

// Check all the orders function, but then only gets the top order
export const allOrder = async function (o, st) {
    const to_sign = `symbol=${o.symbol}&recvWindow=60000&limit=1&timestamp=${o.timestamp}`

    const hmac = crypto.createHmac('sha256', st.API_SECRET)
        .update(to_sign)
        .digest('hex')

    const res = await fetch(`${st.URL}/allOrders?${to_sign}&signature=${hmac}`, {
        method: 'GET',
        headers: {
            'X-MBX-APIKEY': `${st.API_KEY}`,
            'Content-Type': 'application/json'
        }
    })
    const json = await res.json()
    // if (json.msg) {
    //     console.error(json)
    //     return []
    // }
    return json
}

// Check all the orders function, but then only gets the top order
export const getAllOrders = async function (o, st) {
    const to_sign = `symbol=${o.symbol}&recvWindow=60000&startTime=${o.startTime}&timestamp=${o.timestamp}`

    const hmac = crypto.createHmac('sha256', st.API_SECRET)
        .update(to_sign)
        .digest('hex')

    const res = await fetch(`${st.URL}/allOrders?${to_sign}&signature=${hmac}`, {
        method: 'GET',
        headers: {
            'X-MBX-APIKEY': `${st.API_KEY}`,
            'Content-Type': 'application/json'
        }
    })
    const json = await res.json()
    // if (json.msg) {
    //     console.error(json)
    //     return []
    // }
    return json
}

// Check the price of a given symbol
export const checkPrice = async (symbol, st) => {
    const res = await fetch(`${st.URL}/ticker/price?symbol=${symbol}`, { method: 'GET' })
    const json = await res.json()
    // console.log(json)
    return json
}

// Get the average price of a given symbol at a given interval
export const avgPrice = async (symbol, st) => {
    const res = await fetch(`${st.URL}/klines?symbol=${symbol}&interval=5m&limit=5`, { method: 'GET' })
    // console.log(res)
    const json = await res.json()
    // console.log(json)
    return json
}

// Get the average price of a given symbol at a given interval
export const avgPrice30 = async (symbol, st) => {
    const res = await fetch(`${st.URL}/klines?symbol=${symbol}&interval=1m&limit=30`, { method: 'GET' })
    // console.log(res)
    const json = await res.json()
    // console.log(json)
    return json
}


// Get the account balances of all the tokens
export const accountBalances = async (st) => {
    const to_sign = `timestamp=${Date.now()}`

    const hmac = crypto.createHmac('sha256', st.API_SECRET)
        .update(to_sign)
        .digest('hex')

    const res = await fetch(`${st.URL}/account?${to_sign}&signature=${hmac}`, {
        method: 'GET',
        headers: {
            'X-MBX-APIKEY': `${st.API_KEY}`,
            'Content-Type': 'application/json'
        }
    })
    const json = await res.json()
    return json
}

// Get the account balances of all the tokens
export const exchangeInfo = async (st) => {

    const res = await fetch(`${st.URL}/exchangeInfo`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    const json = await res.json()
    let info = {
        minOrder: 0,
        minQty: 0,
        baseAsset: '',
        quoteAsset: '',
        quoteAssetPrecision: 0
    }
    json.symbols.forEach(market => {
        // get the exchange info for the current market
        if (market.symbol == st.MAIN_MARKET) {

            info.quoteAsset = market.quoteAsset
            info.baseAsset = market.baseAsset

            // obtain filter values from the exchange
            market.filters.forEach(filter => {
                if (filter.filterType == 'LOT_SIZE') {
                    if (filter.minQty >= `1.00`) {
                        info.minQty = Math.floor(Math.log10(filter.minQty));
                    } else {
                        info.minQty = -Math.floor(Math.log10(filter.minQty));
                    }
                }

                if (filter.filterType == 'PRICE_FILTER') {
                    if (filter.minPrice >= `1.00`) {
                        info.quoteAssetPrecision = Math.floor(Math.log10(filter.minPrice));
                    } else {
                        info.quoteAssetPrecision = -Math.floor(Math.log10(filter.minPrice));
                    }
                }

                if (filter.filterType == 'MIN_NOTIONAL') {
                    info.minOrder = filter.minNotional
                }
            });
        }
    });
    return info
}