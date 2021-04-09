const fetch = require('node-fetch');
const crypto = require('crypto')

import { logger } from './utils'

import settings from '../settings.json'

const key = `${settings.API_SECRET}`

// Check the status of a given order function
export const checkOrder = function (o) {
    const to_sign = `symbol=${o.symbol}&recvWindow=60000&orderId=${o.orderId}&origClientOrderId=${o.originalClientOrderId}&timestamp=${o.timestamp}`

    const hmac = crypto.createHmac('sha256', key)
        .update(to_sign)
        .digest('hex')

    fetch(`${settings.URL}/order?${to_sign}&signature=${hmac}`, {
        method: 'GET',
        headers: {
            'X-MBX-APIKEY': `${settings.API_KEY}`,
            'Content-Type': 'application/json'
        }
    })
        .then(res => res.json())
        .then(json => logger.info(json));
}

// Check for any open orders function, return the result asynchronously
export const openOrder = async function (o) {
    const to_sign = `symbol=${o.symbol}&recvWindow=60000&timestamp=${o.timestamp}`

    const hmac = crypto.createHmac('sha256', key)
        .update(to_sign)
        .digest('hex')

    const res = await fetch(`${settings.URL}/openOrders?${to_sign}&signature=${hmac}`, {
        method: 'GET',
        headers: {
            'X-MBX-APIKEY': `${settings.API_KEY}`,
            'Content-Type': 'application/json'
        }
    })
    const json = await res.json()
    return json
}

// Check all the orders function, but then only gets the top order
export const allOrder = async function (o) {
    const to_sign = `symbol=${o.symbol}&recvWindow=60000&limit=1&timestamp=${o.timestamp}`

    const hmac = crypto.createHmac('sha256', key)
        .update(to_sign)
        .digest('hex')

    const res = await fetch(`${settings.URL}/allOrders?${to_sign}&signature=${hmac}`, {
        method: 'GET',
        headers: {
            'X-MBX-APIKEY': `${settings.API_KEY}`,
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
export const getAllOrders = async function (o) {
    const to_sign = `symbol=${o.symbol}&recvWindow=60000&startTime=${o.startTime}&timestamp=${o.timestamp}`

    const hmac = crypto.createHmac('sha256', key)
        .update(to_sign)
        .digest('hex')

    const res = await fetch(`${settings.URL}/allOrders?${to_sign}&signature=${hmac}`, {
        method: 'GET',
        headers: {
            'X-MBX-APIKEY': `${settings.API_KEY}`,
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
export const checkPrice = async (symbol) => {
    const res = await fetch(`${settings.URL}/ticker/price?symbol=${symbol}`, { method: 'GET' })
    const json = await res.json()
    // console.log(json)
    return json
}

// Get the average price of a given symbol at a given interval
export const avgPrice = async (symbol) => {
    const res = await fetch(`${settings.URL}/klines?symbol=${symbol}&interval=5m&limit=5`, { method: 'GET' })
    // console.log(res)
    const json = await res.json()
    // console.log(json)
    return json
}

// Get the average price of a given symbol at a given interval
export const avgPrice30 = async (symbol) => {
    const res = await fetch(`${settings.URL}/klines?symbol=${symbol}&interval=1m&limit=30`, { method: 'GET' })
    // console.log(res)
    const json = await res.json()
    // console.log(json)
    return json
}


// Get the account balances of all the tokens
export const accountBalances = async () => {
    const to_sign = `timestamp=${Date.now()}`

    const hmac = crypto.createHmac('sha256', key)
        .update(to_sign)
        .digest('hex')

    const res = await fetch(`${settings.URL}/account?${to_sign}&signature=${hmac}`, {
        method: 'GET',
        headers: {
            'X-MBX-APIKEY': `${settings.API_KEY}`,
            'Content-Type': 'application/json'
        }
    })
    const json = await res.json()
    return json
}