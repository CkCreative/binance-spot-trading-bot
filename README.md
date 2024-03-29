# Binance Trading App (Bot)

![Sample UI](ui.png)

This is a Node.js binance trading bot that takes advantage of crypto's volatile prices.

**NB: You will need a Binance account. [Register Here](https://accounts.binance.cc/en/register?ref=77939580)**

## Get Support

Join Discord channel to ask questions, or create an issue.

Discord Invite: [Join](https://discord.gg/GTfs6pQmXe)

## Caution

⚠️ This is still alpha stuff under active development. Some things might not work as described yet. Also, a lot of changes happening all over the place.

## Future Improvements

- Ability to trade multiple pairs.
- Ability to automatically determine the WIGGLE_ROOM for any given asset at any given time since the curves are not always just small fluctuations but giant leaps at times.
- Ability to take short term losses by selling low so as to keep following the curve. ✔️
- Ability to calculate and report profits at different times of the day depending on all the successful trades. ✔️
- Make it more configurable, everything should be configured even through an API, not necessarily through the settings file. ✔️ (UI now available)
- Ability to send notifications to many other channels, e.g. Telegram, Slack ✔️ Telegram now available
- Ability to consider TA indicators - partially - considering rough RSI for now.

## Running the Bot

Just edit the `settings.json` file to include your own preferences and your preferred market, your preferred market should have money, then `docker-compose up` or `docker-compose up -d` depending on your kind of medicine.

To run without Docker, edit the `settings.json` file accordingly and then run `npm install` inside the `/bot` folder then `npm run dev`.

Add your suitable settings:

```json
{
    "URL": "https://api.binance.com/api/v3",
    "API_SECRET": "YOUR BINANCE API SECRET", // STRING
    "API_KEY": "YOUR BINANCE API KEY", // STRING
    "WIGGLE_ROOM": 0.5, // FLOAT - THE PERCENTAGE MARGIN YOU ARE WILLING TO PLAY WITH
    "MAIN_MARKET": "BTCUSDT", // STRING - THE MARKET, E.G. BTCUSDT
    "CANCEL_AFTER": 300, // After how long in seconds should you cancel an order?
    "INSTANCE_NAME": "BTC", // If you are using the same Discord server to receive notifications from multiple instances, this makes it easy to know which instance is sending you a notification.
    "INTERVAL": 3000, // How long before loop repeats in milliseconds
    "ACCEPTABLE_LOSS": 2, // this is not yet used in the logic
    "HIGHEST_RSI": 70, // INTEGER - HIGHEST RSI VALUE YOU WANT TO AVOID BUY
    "DISCORD": "DISCORD_WEBHOOK_URL", // WHERE TO SEND BUY/SELL NOTIFICATIONS
    "DISCORD_ERRORS": "DISCORD_WEBHOOK_URL_FOR_ERRORS", // WHERE TO SEND ERRORS
    "ASSET_PERCENT": 99, // the percentage of main asset to sell. Max value = 99
    "FIAT_OR_QUOTE_PERCENT": 99, // percentage of the bridge/fiat/quote coin to use when buying. Max value = 99
    "TELEGRAM_TOKEN": "", // TELEGRAM TOKEN
    "TELEGRAM_CHATID": "", // TELEGRAM CHATID
    "BUYING_PRICE_DIVIDER": 1, // This default value means the buying price is the current price minus the wiggle room. If you want to buy a little closer to the current price, increase this value. 
    "PIN": 12345, // This is used in the UI. When you change this, you need to restart the bot.
    "PORT": "3000", // This is the default port of the frontend server.
    "STATE": "ON" // "ON" or "OFF". This is useful if you are using a remote server and you want that when you have stopped from the frontend, the bot does not auto resume trading when server restarts.
}
```

 :warning: CAUTION for `BUYING_PRICE_DIVIDER`:warning:: YOU WILL ENCOUNTER ISSUES IF YOU SET A VALUE LESS THAN 1.

## Detailed Installation Instructions

You can run this bot anywhere. This includes on PC, Mac or Linux provided you have node.js (v14) installed if you want to run without Docker.

### Running without docker

- **Step 1**: Install Node.js (tested on v14 LTS)

- **Step 2**: clone the repository and then `cd` into the cloned directory, `cd` into the `/bot` directory and run `npm install`

- **Step 3**: Go to binance and obtain your settings i.e. The `API KEY` and the `API SECRET`. Remember that if you are going to be using Binance testnet, you need to use the testnet `API_KEY` and `SECRET` associated with your testing account at [https://testnet.binancefuture.com](https://testnet.binancefuture.com). If you use the main Binance site, use the `API_KEY` and `SECRET` associated with your trading account.

- **Step 4**: Decide whether to use Binance backtesting API (`https://testnet.binancefuture.com/fapi/v1`, recommended) or the main site to use real money (`https://api.binance.com/api/v3`, only when sure should you do this). If you are going to use testnet, the URL value of the `settings.json` file should be: `"https://testnet.binancefuture.com/fapi/v1"`. Else use `"https://api.binance.com/api/v3"` for main account. NB: rename the `settings_example.json` file to `settings.json`.

- **Step 5**: Edit other settings accordingly.

- **Step 6**: Run `npm run dev`

## Known Issues

When you configure the bot to a new market, sometimes it fails to pick up buyin or selling. In this case, simply place an order that won't be filled instantly, for example, a very low buy order or a very high sell order, then, start up the bot and cancel the order thereafter. The bot should pick up from there.

## Contributors

### Owners

<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/CkCreative"><img src="https://avatars.githubusercontent.com/u/15129817?v=4" width="100px;" alt=""/><br /><sub><b>Mike CK</b></sub></a><br />Creator</td>
  </tr>
</table>

## Feature contributors
<!-- prettier-ignore-start -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/lownoise2"><img src="https://avatars.githubusercontent.com/u/2761812?v=4" width="100px;" alt=""/><br /><sub><b>Lownoise</b></sub></a><br />Telegram Integration and more</td>
  </tr>
</table>
<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->

## License

[MIT](license.md)
