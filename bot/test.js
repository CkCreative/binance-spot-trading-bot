import {checkPrice, accountBalances, avgPrice} from './bot/poll'
import settings from './settings.json'

// setInterval(async() => {
//     const price = await avgPrice('BTCUSDT')
//     const ticker = await checkPrice('BTCUSDT')
//     const avg1 = (Number(price[0][1]) + Number(price[0][4]))/2
//     const avg2 = (Number(price[1][1]) + Number(price[1][4]))/2
//     const avg = (avg1+avg2)/2
//     console.log(`Ticker: ${ticker.price} | Average: ${avg}`)
// },2000)
// ;(async function(){
//     const {balances} = await accountBalances()
//     // console.log(balances)

//     for (let i in balances) {
//         if (balances[i].asset==`${settings.MAIN_ASSET}`) {
//             console.log(balances[i])
//         }
//         if (balances[i].asset=='USDT') {
//             console.log(balances[i])
//         }
//     }
// }());

const width = settings.WIGGLE_ROOM/100
const topBorder = 1+Number(width)/2
const bottomBorder = 1-Number(width)/2
const fullMultiplier = settings.WIGGLE_ROOM/100+1

console.log(fullMultiplier)
console.log(topBorder)
console.log(bottomBorder)

