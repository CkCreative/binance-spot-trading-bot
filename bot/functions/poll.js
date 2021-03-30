const fetch = require('node-fetch');
const crypto = require('crypto')
import settings from '../settings.json'


const key = `${settings.API_SECRET}`

// Check the price of a given symbol
export const checkPrice = async(symbol) => {
    const res = await fetch(`${settings.URL}/ticker/price?symbol=${symbol}`,{method: 'GET'})
    const json = await res.json()
    // console.log(json)
    return json
}

// Get the average price of a given symbol at a given interval
export const avgPrice = async(symbol) => {
    const res = await fetch(`${settings.URL}/klines?symbol=${symbol}&interval=3m&limit=5`,{method: 'GET'})
    // console.log(res)
    const json = await res.json()
    // console.log(json)
    return json
}

// Get the account balances of all the tokens
export const accountBalances = async() => {
    const to_sign = `timestamp=${Date.now()}`

    const hmac = crypto.createHmac('sha256', key)
        .update(to_sign)
        .digest('hex')

    const res = await fetch(`${settings.URL}/account?${to_sign}&signature=${hmac}`,{
        method: 'GET', 
        headers: {
            'X-MBX-APIKEY': `${settings.API_KEY}`,
            'Content-Type': 'application/json' 
        }
    })
    const json = await res.json()
    return json
}