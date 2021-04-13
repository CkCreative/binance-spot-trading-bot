const fs = require('fs')
const express = require('express')
const http = require('http');

const app = express()
const server = http.createServer(app);
const io = require('socket.io')(server);

import { trade } from './index'
import { clearInterval } from 'timers'
import { logger, profitTracker } from './functions/utils'
import { exchangeInfo } from './functions/info'

io.on('connection', (socket) => {
    logger.info('a user connected');
});

app.set('view engine', 'pug');
app.set('views', './views');
app.use(express.urlencoded({ extended: true }));

let obj = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
let info = {
    minOrder: 0,
    minQty: 0,
    baseAsset: '',
    quoteAsset: '',
    quoteAssetPrecision: 0
}

const port = obj.PORT

let draft
    ; (async () => {
        info = { ...await exchangeInfo(obj) }
        obj.info = info
        draft = setInterval(() => {
            if (obj.STATE == 'ON') {
                trade(obj, io)
            } else {
                return
            }
        }, obj.INTERVAL);
    })();

// initialize profit tracker
; (async () => {
    await profitTracker(io, obj)
})();

app.get('/', (req, res) => {
    res.render('form', { data: obj });
})

app.post('/start', (req, res) => {
    let { pin, action } = req.body
    logger.info(action)
    if (pin == obj.PIN && action == 'START') {
        obj.STATE = 'ON'
        fs.writeFileSync('settings.json', JSON.stringify(obj, null, 2));
        clearInterval(draft)
        draft = setInterval(() => {
            if (obj.STATE == 'ON') {
                trade(obj, io)
            } else {
                return
            }
        }, obj.INTERVAL);
        res.redirect('/');
    } else {
        res.send("gHOST!");
    }
})

app.post('/stop', (req, res) => {
    let { pin, action } = req.body

    if (pin == obj.PIN && action == 'STOP') {
        obj.STATE = 'OFF'
        fs.writeFileSync('settings.json', JSON.stringify(obj, null, 2));
        logger.info(action)
        clearInterval(draft)
        res.redirect('/');
    } else {
        res.send("gHOST!");
    }
})

app.post('/', (req, res) => {
    let { pin,
        interval_value,
        market,
        room,
        asset_pct,
        fiat_or_quote_pct,
        after,
        instance,
        divider
    } = req.body

    if (pin == obj.PIN) {

        obj.INTERVAL = interval_value
        obj.MAIN_MARKET = market
        obj.CANCEL_AFTER = after
        obj.WIGGLE_ROOM = room
        obj.ASSET_PERCENT = asset_pct
        obj.FIAT_OR_QUOTE_PERCENT = fiat_or_quote_pct
        obj.INSTANCE_NAME = instance
        obj.BUYING_PRICE_DIVIDER = divider

        fs.writeFileSync('settings.json', JSON.stringify(obj, null, 2));

        obj = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
        ; (async () => {
            info = { ...await exchangeInfo(obj) }
            obj.info = info

            clearInterval(draft)
            draft = setInterval(() => {
                if (obj.STATE == 'ON') {
                    trade(obj, io)
                } else {
                    return
                }
            }, obj.INTERVAL);
        })();

        res.redirect('/');
    } else {
        res.send("gHOST!");
    }

});

server.listen(port, '0.0.0.0', () => {
    logger.info(`Binance bot listening at http://localhost:${port}`)
})