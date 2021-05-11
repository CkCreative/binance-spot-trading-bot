const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs')

let obj = JSON.parse(fs.readFileSync('settings.json', 'utf8'));

const token = `${obj.TELEGRAM_TOKEN}`
const bot = new TelegramBot(token, {polling: true});

import { ControlBot } from '../server.js'


export const telegramresponder = function() {
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
}

