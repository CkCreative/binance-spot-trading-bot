const fetch = require('node-fetch');
const winston = require('winston');
const fs = require('fs');
const cron = require('node-cron');

import { avgPrice30, getAllOrders } from './info'
import settings from '../settings.json'

const logDir = 'logs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

export const logger = winston.createLogger({
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            level: 'error',
            filename: `${logDir}/logs.log`,
        })
    ]
});

export const sendNotification = (message) => {
    sendDiscord(`${message}`)
    sendTelegram(`${message}`)
}
// Send discord messages, no fancy formatting, just the content of the message.
export const sendDiscord = (message) => {
    fetch(`${settings.DISCORD}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            content: `${settings.INSTANCE_NAME}: ${message}`
        })
    }).then(data => {
        // console.log(data)
    }).catch(e => {
        logger.error(e)
        // console.log(e)
    })
}
// Send telegram messages, no fancy formatting, just the content of the message.
const sendTelegram = (message) => {
    fetch(`https://api.telegram.org/bot${settings.TELEGRAM_TOKEN}/sendMessage?chat_id=${settings.TELEGRAM_CHATID}&text=${settings.INSTANCE_NAME}: ${message}`, {
        method: 'POST',

    }).then(data => {
        // console.log(data)
    }).catch(e => {
        logger.error(e)
        // console.log(e)
    })
}

export const sendErrors = (message) => {
    fetch(`${settings.DISCORD_ERRORS}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            content: `${settings.INSTANCE_NAME}: ${message}`
        })
    }).then(data => {
        // console.log(data)
    }).catch(e => {
        logger.error(e)
        // console.log(e)
    })
}

export const getRSI = async function () {
    let upMoves = 0
    let downMoves = 0
    const averagePrice = await avgPrice30(`${settings.MAIN_MARKET}`)
    averagePrice.forEach((element, index) => {
        if (element[1] < element[4]) {
            upMoves += 1
        }
        if (element[1] > element[4]) {
            downMoves += 1
        }
    });
    const avgU = (upMoves / 30).toFixed(8)
    const avgD = (downMoves / 30).toFixed(8)
    const RS = avgU / avgD
    const RSI = 100 - (100 / (1 + RS))
    return RSI
}

export const profitTracker = async (io, obj) => {
    cron.schedule('* * * * *', async () => {

        const orders = await getAllOrders({
            symbol: `${obj.MAIN_MARKET}`,
            timestamp: Date.now(),
            startTime: Date.now() - (3600 * 1000 * 24)
        }).catch((e) => {
            logger.error(e)
        });

        let quantities = []
        orders.forEach(element => {
            if (element.status == 'FILLED' && element.side == 'SELL') {
                quantities.push({
                    y: Number(element.origQty),
                    x: element.time
                })
            }
        });

        io.emit('quantities', quantities);
    });
}
