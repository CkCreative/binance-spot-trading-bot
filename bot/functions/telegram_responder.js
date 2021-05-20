const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

let obj = JSON.parse(fs.readFileSync("settings.json", "utf8"));
let latestorder="There was a error retrieving the lates order"

const token = `${obj.TELEGRAM_TOKEN}`;
const bot = new TelegramBot(token, { polling: true });

import { ControlBot } from "../server.js";

export const telegramresponder = function () {
	(async () => {
		// Listener (handler) for showcasing different keyboard layout
		bot.onText(/keyboard/, (msg) => {
			bot.sendMessage(
				msg.chat.id,
				"Alternative keyboard layout",
				{
					reply_markup: {
						keyboard: [
							["latest order"],
							[
								"start the bot",
								"stop the bot",
							],
							["current status"],
						],
						resize_keyboard: true,
						one_time_keyboard: false,
						force_reply: true,
					},
				}
			);
		});

		bot.onText(/start the bot/, function onBoton(msg, match) {
			if (msg.from.id == `${obj.TELEGRAM_CHATID}`) {
				obj.STATE = "ON";
				const resp = `The bot is starting up`;
				ControlBot(obj, resp);
				bot.sendMessage(msg.chat.id, resp);
			}
		});

		// Matches /botoff
		bot.onText(/stop the bot/, function onBotoff(msg, match) {
			if (msg.from.id == `${obj.TELEGRAM_CHATID}`) {
				obj.STATE = "OFF";
				const resp = `The bot is shutting down`;
				ControlBot(obj, resp);
				bot.sendMessage(msg.chat.id, resp);
			}
		});

		// Matches /status
		bot.onText(/current status/, function onStatus(msg, match) {
			if (msg.from.id == `${obj.TELEGRAM_CHATID}`) {
				let resp;
				//const resp =`the current status is ${obj.STATE}`
				resp = `The binance spot trading bot is stopped`;
				if (`${obj.STATE}` == `ON`) {
					resp = `The binance spot trading bot is running`;
				}
				bot.sendMessage(msg.chat.id, resp);
			}
		});

		bot.onText(/latest order/, function onOrder(msg, match) {
			debugger;
			if (msg.from.id == `${obj.TELEGRAM_CHATID}`) {
				const resp = latestorder
				bot.sendMessage(msg.chat.id, resp);
			}
		});

		// Matches /settings
		bot.onText(/\/settings/, function onSettings(msg, match) {
			if (msg.from.id == `${obj.TELEGRAM_CHATID}`) {
				const resp = `Instance Name: ${obj.INSTANCE_NAME}\r\nMain Market    : ${obj.MAIN_MARKET}\r\nWiggle Room   : ${obj.WIGGLE_ROOM}`;
				bot.sendMessage(msg.chat.id, resp);
			}
		});

		bot.onText(/\/setvalue (.+)/, function onSetvalue(msg, match) {
			if (msg.from.id == `${obj.TELEGRAM_CHATID}`) {
				const parameters = match[1].split(" ");
				logger.info(`setvalue hit`);
				//console.log(obj)
				if (parameters[0] == `Name`) {
					const resp = `modifying value ${parameters[0]} to ${parameters[1]}`;
					obj.UPDATE = `TRUE`;
					obj.INSTANCE_NAME = parameters[1];
					ControlBot(obj, resp);
					bot.sendMessage(msg.chat.id, resp);
				} else if (parameters[0] == `Market`) {
					const resp = `modifying value ${parameters[0]} to ${parameters[1]}`;
					obj.UPDATE = `TRUE`;
					obj.MAIN_MARKET = parameters[1];
					ControlBot(obj, resp);
					bot.sendMessage(msg.chat.id, resp);
				}
			}
		});
	})();
};

export const telegraminfo = function (tinfo) {
	debugger;
	latestorder=`Latest Order: | ${tinfo.origQty}@${tinfo.price} | ${tinfo.side} | ${tinfo.status}`
};
