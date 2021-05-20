const fetch = require("node-fetch");
const winston = require("winston");
const fs = require("fs");
const cron = require("node-cron");

import { avgPrice30, getAllOrders } from "./info";

const logDir = "logs";
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

export const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      level: "error",
      filename: `${logDir}/logs.log`,
    }),
  ],
});

export const sendNotification = (message, st) => {
  sendDiscord(`${message}`, st);
  sendTelegram(`${message}`, st);
};
// Send discord messages, no fancy formatting, just the content of the message.
export const sendDiscord = (message, st) => {
  fetch(`${st.DISCORD}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: `${st.INSTANCE_NAME}: ${message}`,
    }),
  })
    .then((data) => {
      // console.log(data)
    })
    .catch((e) => {
      logger.error(e);
      // console.log(e)
    });
};
// Send telegram messages, no fancy formatting, just the content of the message.
const sendTelegram = (message, st) => {
  fetch(
    `https://api.telegram.org/bot${st.TELEGRAM_TOKEN}/sendMessage?chat_id=${st.TELEGRAM_CHATID}&text=${st.INSTANCE_NAME}: ${message}`,
    {
      method: "POST",
    }
  )
    .then((data) => {
      // console.log(data)
    })
    .catch((e) => {
      logger.error(e);
      // console.log(e)
    });
};

export const sendErrors = (message, st) => {
  fetch(`${st.DISCORD_ERRORS}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: `${st.INSTANCE_NAME}: ${message}`,
    }),
  })
    .then((data) => {
      // console.log(data)
    })
    .catch((e) => {
      logger.error(e);
      // console.log(e)
    });
};

export const getRSI = async function (tradingPair, st) {
  let upMoves = 0;
  let downMoves = 0;
  const averagePrice = await avgPrice30(tradingPair, st);
  averagePrice.forEach((element, index) => {
    if (element[1] < element[4]) {
      upMoves += 1;
    }
    if (element[1] > element[4]) {
      downMoves += 1;
    }
  });
  const avgU = (upMoves / 30).toFixed(8);
  const avgD = (downMoves / 30).toFixed(8);
  const RS = avgU / avgD;
  const RSI = 100 - 100 / (1 + RS);
  return RSI;
};

// profit checking function
export const check = async function (io, obj, pairs) {
  let quantities = {};
  for (let p in pairs) {
    let pair = pairs[p];
    try {
      const orders = await getAllOrders(
        {
          symbol: `${pair.pairName}`,
          timestamp: Date.now(),
          startTime: Date.now() - 3600 * 1000 * 48,
        },
        obj
      );

      orders.forEach((element) => {
        if (element.status == "FILLED" && element.side == "SELL") {
          if (!quantities[pair.pairName]) {
            quantities[pair.pairName] = [];
          }
          quantities[pair.pairName].push({
            y: Number(element.origQty),
            x: element.time,
          });
        }
      });
    } catch (error) {
      logger.error(error);
    }
  }
  io.emit("quantities", quantities);
};

// check profit utility, check initially, and then schedule a check every one minute
export const profitTracker = async (io, obj) => {
  // initial check
  await check(io, obj);

  cron.schedule("* * * * *", async () => {
    // subsequent checks by the minute
    await check(io, obj);
  });
};
