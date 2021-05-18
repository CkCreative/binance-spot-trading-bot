const fs = require("fs");
const express = require("express");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = require("socket.io")(server);

import { trade } from "./index";
import { clearInterval } from "timers";
import { logger, profitTracker, check } from "./functions/utils";
import { exchangeInfo, accountBalances } from "./functions/info";
const cron = require("node-cron");

io.on("connection", (socket) => {
  logger.info("a user connected");
});

app.set("view engine", "pug");
app.set("views", "./views");
app.use(
  express.urlencoded({
    extended: true,
  })
);

let obj = JSON.parse(fs.readFileSync("settings.json", "utf8"));
let info = {
  minOrder: 0,
  minQty: 0,
  baseAsset: "",
  quoteAsset: "",
  quoteAssetPrecision: 0,
};

let portfolio = {
  balances: {},
  pairs: {},
};

obj.MONITOR_MARKETS.forEach((element) => {
  portfolio.pairs[element] = {
    pairName: element,
    tradeEnabled: false,
  };
});
const port = obj.PORT;

let mainLoop;
(async () => {
  info = {
    ...(await exchangeInfo(obj)),
  };
  obj.info = info;
  if (obj.info.baseAsset == "") {
    logger.error(
      `No information retreived. Probably the trading pair does not exist`
    );
    process.exit();
  }

  mainLoop = setInterval(async () => {
    info = {
      ...(await exchangeInfo(obj)),
    };
    console.log("inf", info);
    const { balances } = await accountBalances(obj);
    balances.forEach((element) => {
      if (element.free != 0 || element.locked != 0) {
        portfolio.balances[element.asset] = element;
      }
    });
    io.emit("portfolio", portfolio);
    for (let p in portfolio.pairs) {
      if (true || p.tradeEnabled) {
        trade(obj, io, p);
      }
    }
  }, obj.INTERVAL);
})();

let draft;
(async () => {
  info = {
    ...(await exchangeInfo(obj)),
  };
  obj.info = info;
  if (obj.info.baseAsset == "") {
    logger.error(
      `No information retreived. Probably the trading pair does not exist`
    );
    process.exit();
  }

  draft = setInterval(() => {
    if (obj.STATE == "ON") {
      trade(obj, io);
    } else {
      return;
    }
  }, obj.INTERVAL);
})();

// initialize profit tracker
// initial check
console.log(portfolio);
check(io, obj, portfolio.pairs);

cron.schedule("* * * * *", async () => {
  console.log("profit check");
  // subsequent checks by the minute
  check(io, obj, portfolio.pairs);
});

app.get("/", (req, res) => {
  res.render("form", {
    data: obj,
  });
});

app.post("/start", (req, res) => {
  let { pin, action } = req.body;
  logger.info(action);
  if (pin == obj.PIN && action == "START") {
    obj.STATE = "ON";
    fs.writeFileSync("settings.json", JSON.stringify(obj, null, 2));
    clearInterval(draft);
    draft = setInterval(() => {
      if (obj.STATE == "ON") {
        trade(obj, io);
      } else {
        return;
      }
    }, obj.INTERVAL);
    res.redirect("/");
  } else {
    res.send("gHOST!");
  }
});

app.post("/stop", (req, res) => {
  let { pin, action } = req.body;

  if (pin == obj.PIN && action == "STOP") {
    obj.STATE = "OFF";
    fs.writeFileSync("settings.json", JSON.stringify(obj, null, 2));
    logger.info(action);
    clearInterval(draft);
    res.redirect("/");
  } else {
    res.send("gHOST!");
  }
});

app.post("/", (req, res) => {
  let {
    pin,
    interval_value,
    market,
    room,
    asset_pct,
    fiat_or_quote_pct,
    after,
    instance,
    divider,
  } = req.body;

  if (pin == obj.PIN) {
    obj.INTERVAL = interval_value;
    obj.MAIN_MARKET = market;
    obj.CANCEL_AFTER = after;
    obj.WIGGLE_ROOM = room;
    obj.ASSET_PERCENT = asset_pct;
    obj.FIAT_OR_QUOTE_PERCENT = fiat_or_quote_pct;
    obj.INSTANCE_NAME = instance;
    obj.BUYING_PRICE_DIVIDER = divider;

    fs.writeFileSync("settings.json", JSON.stringify(obj, null, 2));

    obj = JSON.parse(fs.readFileSync("settings.json", "utf8"));
    (async () => {
      info = {
        ...(await exchangeInfo(obj)),
      };
      obj.info = info;
      if (obj.info.baseAsset == "") {
        logger.error(
          `No information retreived. Probably the trading pair does not exist`
        );
        process.exit();
      }
      clearInterval(draft);
      draft = setInterval(async () => {
        if (obj.STATE == "ON") {
          trade(obj, io);
        } else {
          return;
        }
      }, obj.INTERVAL);
    })();

    res.redirect("/");
  } else {
    res.send("gHOST!");
  }
});

server.listen(port, "0.0.0.0", () => {
  logger.info(`Binance bot listening at http://localhost:${port}`);
});
