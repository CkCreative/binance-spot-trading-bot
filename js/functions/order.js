const fetch = require('node-fetch');
const crypto = require('crypto')
import settings from '../settings.json'

const key = `${settings.API_SECRET}`

// Place order function, it takes order options, places and order and returns the response, asyncronously
export const placeOrder = async function(o){
    const to_sign = `symbol=${o.symbol}&side=${o.side}&type=${o.type}&timeInForce=${o.timeInForce}&quantity=${o.quantity}&price=${o.price}&newClientOrderId=${o.newClientOrderId}&timestamp=${o.timestamp}`

    const hmac = crypto.createHmac('sha256', key)
        .update(to_sign)
        .digest('hex')
    
    const res = await fetch(`${settings.URL}/order?${to_sign}&signature=${hmac}`, { 
        method: 'POST', 
        headers: {
            'X-MBX-APIKEY': `${settings.API_KEY}`,
            'Content-Type': 'application/json' } 
        })
    const json = await res.json()
    return json
}

// Function to cancel the order defined by the options presented
export const cancelOrder = function(o){
    const to_sign = `symbol=${o.symbol}&orderId=${o.orderId}&timestamp=${o.timestamp}`

    const hmac = crypto.createHmac('sha256', key)
        .update(to_sign)
        .digest('hex')

    fetch(`${settings.URL}/order?${to_sign}&signature=${hmac}`, { 
        method: 'DELETE', 
        headers: {
            'X-MBX-APIKEY': `${settings.API_KEY}`,
            'Content-Type': 'application/json' } 
        })
        .then(res => res.json())
        .then(json => console.log(json));
}

// Check the status of a given order function
export const checkOrder = function(o){
    const to_sign = `symbol=${o.symbol}&orderId=${o.orderId}&origClientOrderId=${o.originalClientOrderId}&timestamp=${o.timestamp}`

    const hmac = crypto.createHmac('sha256', key)
        .update(to_sign)
        .digest('hex')

    fetch(`${settings.URL}/order?${to_sign}&signature=${hmac}`, { 
        method: 'GET', 
        headers: {
            'X-MBX-APIKEY': `${settings.API_KEY}`,
            'Content-Type': 'application/json' } 
        })
        .then(res => res.json())
        .then(json => console.log(json));
}

// Check for any open orders function, return the result asynchronously
export const openOrder = async function(o){
    const to_sign = `symbol=${o.symbol}&timestamp=${o.timestamp}`

    const hmac = crypto.createHmac('sha256', key)
        .update(to_sign)
        .digest('hex')

    const res = await fetch(`${settings.URL}/openOrders?${to_sign}&signature=${hmac}`, { 
        method: 'GET', 
        headers: {
            'X-MBX-APIKEY': `${settings.API_KEY}`,
            'Content-Type': 'application/json' } 
        })
    const json = await res.json()
    return json
}

// Check all the orders function, but then only gets the top order
export const allOrder = async function(o){
    const to_sign = `symbol=${o.symbol}&limit=1&timestamp=${o.timestamp}`

    const hmac = crypto.createHmac('sha256', key)
        .update(to_sign)
        .digest('hex')

    const res = await fetch(`${settings.URL}/allOrders?${to_sign}&signature=${hmac}`, { 
        method: 'GET', 
        headers: {
            'X-MBX-APIKEY': `${settings.API_KEY}`,
            'Content-Type': 'application/json' } 
        })
    const json = await res.json()
    if (json.msg) {
        console.error(json)
        return []
    }
    return json
}

