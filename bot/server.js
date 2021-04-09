const fs = require('fs')
const express = require('express')
const http = require('http');

const app = express()
const server = http.createServer(app);
const io = require('socket.io')(server);

import { trade } from './index'
import { clearInterval } from 'timers'
import { logger, profitTracker } from './functions/utils'

const port = 3000

io.on('connection', (socket) => {
    logger.info('a user connected');
});

app.set('view engine', 'pug');
app.set('views', './views');
app.use(express.urlencoded({ extended: true }));

let obj = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
let draft = setInterval(() => {
    trade(obj, io)
}, obj.INTERVAL);

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
        clearInterval(draft)
        draft = setInterval(() => {
            trade(obj, io)
        }, obj.INTERVAL);
        res.redirect('/');
    } else {
        res.send("gHOST!");
    }
})

app.post('/stop', (req, res) => {
    let { pin, action } = req.body
    if (pin == obj.PIN && action == 'STOP') {
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
        main,
        fiat,
        room,
        after,
        precision,
        main_asset_decimals,
        instance,
        divider
    } = req.body

    obj.INTERVAL = interval_value
    obj.MAIN_MARKET = market
    obj.MAIN_ASSET = main
    obj.FIAT = fiat
    obj.CANCEL_AFTER = after
    obj.PRECISION = precision
    obj.WIGGLE_ROOM = room
    obj.MAIN_ASSET_DECIMALS = main_asset_decimals
    obj.INSTANCE_NAME = instance
    obj.BUYING_PRICE_DIVIDER = divider

    if (pin == obj.PIN) {
        fs.writeFileSync('settings.json', JSON.stringify(obj, null, 2));

        obj = JSON.parse(fs.readFileSync('settings.json', 'utf8'));

        clearInterval(draft)
        draft = setInterval(() => {
            trade(obj, io)
        }, obj.INTERVAL);

        res.redirect('/');
    } else {
        res.send("gHOST!");
    }

});

server.listen(port, () => {
    logger.info(`Binance bot listening at http://localhost:${port}`)
})