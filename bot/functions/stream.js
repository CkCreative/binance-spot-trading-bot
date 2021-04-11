const WebSocket = require('ws');
import { logger } from './utils'


// Stream the price of the symbol
export const coinPrice = function (symbol, st) {
    let highest_price = 0
    let lowest_price = 0
    let percentage = 0
    const ws = new WebSocket(`${st.STREAM_URL}/${symbol}@ticker`);
    ws.on('message', function incoming(data) {
        const price = JSON.parse(data).c

        lowest_price = lowest_price == 0 ? price : lowest_price
        highest_price = price > highest_price ? price : highest_price
        lowest_price = price < lowest_price ? price : lowest_price

        logger.info(`Lowest: ${lowest_price}, Highest: ${highest_price}\t`);

        percentage = ((highest_price - lowest_price) / lowest_price) * 100
        logger.info(`${percentage}%\n`);
    });

    return {
        get: function () {
            return [lowest_price, highest_price, percentage];
        },
        reset: function () {
            lowest_price = 0;
            highest_price = 0;
            percentage = 0;
        }
    }
}

