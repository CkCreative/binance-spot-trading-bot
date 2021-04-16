const fs = require('fs')
const express = require('express')
const http = require('http');

const app = express()
const server = http.createServer(app);
const io = require('socket.io')(server);
const TelegramBot = require('node-telegram-bot-api');

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

obj.UPDATE == `FALSE`

const token = `${obj.TELEGRAM_TOKEN}`
const bot = new TelegramBot(token, {polling: true});

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
        ControlBot(obj, action)
        res.redirect('/');
    } else {
        res.send("gHOST!");
    }
})

app.post('/stop', (req, res) => {
    let { pin, action } = req.body

    if (pin == obj.PIN && action == 'STOP') {
        obj.STATE = 'OFF'
        ControlBot(obj, action)
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

        obj.UPDATE = `TRUE`
        obj.INTERVAL = interval_value
        obj.MAIN_MARKET = market
        obj.CANCEL_AFTER = after
        obj.WIGGLE_ROOM = room
        obj.ASSET_PERCENT = asset_pct
        obj.FIAT_OR_QUOTE_PERCENT = fiat_or_quote_pct
        obj.INSTANCE_NAME = instance
        obj.BUYING_PRICE_DIVIDER = divider
        const action = `update`
        ControlBot(obj,action)
        res.redirect('/');
    } else {
        res.send("gHOST!");
    }

});

//Telegram Bot responses
; (async () => {
        bot.onText(/\/boton/, function onBoton(msg, match) {
            if (msg.from.id == `${obj.TELEGRAM_CHATID}`) {
               obj.STATE = 'ON'
               const resp = `The bot is starting up`;
               ControlBot(obj, resp)
               bot.sendMessage(msg.chat.id, resp);
            }
        });


     // Matches /botoff
        bot.onText(/\/botoff/, function onBotoff(msg, match) {
            if (msg.from.id == `${obj.TELEGRAM_CHATID}`) {
               obj.STATE = 'OFF'
               const resp = `The bot is shutting down`;
               ControlBot(obj, resp)
               bot.sendMessage(msg.chat.id, resp);
            }
        });

     // Matches /status
        bot.onText(/\/status/, function onStatus(msg, match) {
            if (msg.from.id == `${obj.TELEGRAM_CHATID}`) {
               const resp =`the current status is ${obj.STATE}`
               bot.sendMessage(msg.chat.id, resp);
            }
        });

     // Matches /settings
        bot.onText(/\/settings/, function onSettings(msg, match) {
            if (msg.from.id == `${obj.TELEGRAM_CHATID}`) {
               const resp =`Instance Name: ${obj. INSTANCE_NAME}\r\nMain Market    : ${obj.MAIN_MARKET}\r\nWiggle Room   : ${obj.WIGGLE_ROOM}`;
               bot.sendMessage(msg.chat.id, resp);
            }
        });

        bot.onText(/\/setvalue (.+)/, function onSetvalue(msg, match) {
            if (msg.from.id == `${obj.TELEGRAM_CHATID}`) {
               const parameters = match[1].split(' ')
               logger.info(`setvalue hit`)
               //console.log(obj)
               if (parameters[0] == `Name`) {
                  const resp = `modifying value ${parameters[0]} to ${parameters[1]}`
                  obj.UPDATE = `TRUE`
                  obj.INSTANCE_NAME = parameters[1]
                  ControlBot(obj,resp)
                  bot.sendMessage(msg.chat.id, resp);
               } else if (parameters[0] == `Market`) {
                  const resp = `modifying value ${parameters[0]} to ${parameters[1]}`
                  obj.UPDATE = `TRUE`
                  obj.MAIN_MARKET = parameters[1]
                  ControlBot(obj,resp)
                  bot.sendMessage(msg.chat.id, resp);
               }
            }

        });
})();

const ControlBot =(obj,action) => {
     if (obj.STATE == `OFF`) {
         fs.writeFileSync('settings.json', JSON.stringify(obj, null, 2));
         logger.info(action)
         clearInterval(draft)
     } else if (obj.STATE == `ON` && obj.UPDATE == `FALSE`) {
         fs.writeFileSync('settings.json', JSON.stringify(obj, null, 2));
         logger.info(action)
         clearInterval(draft)
         draft = setInterval(() => {
              if (obj.STATE == 'ON') {
                 trade(obj, io)
              } else {
                 return
              }
         }, obj.INTERVAL);
     } else if (obj.UPDATE = `TRUE`) {
         fs.writeFileSync('settings.json', JSON.stringify(obj, null, 2));

         obj.UPDATE = `FALSE`
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
     }
}

server.listen(port, '0.0.0.0', () => {
    logger.info(`Binance bot listening at http://localhost:${port}`)
})
