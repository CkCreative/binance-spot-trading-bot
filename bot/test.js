import { exchangeInfo } from './functions/info'
import { getRSI } from './functions/utils'
import settings from './settings.json'

    // setInterval(async() => {
    //     let upMoves = 0
    //     let downMoves = 0
    //     const averagePrice = await avgPrice30('BTCUSDT')
    //     averagePrice.forEach((element, index) => {
    //         if(element[1] < element[4]) {
    //             upMoves+=1
    //         }
    //         if (element[1] > element[4]) {
    //             downMoves+=1
    //         }
    //     });
    //     const avgU = (upMoves/30).toFixed(8)
    //     const avgD = (downMoves/30).toFixed(8)
    //     const RS = avgU/avgD
    //     const RSI = 100 - (100/(1+RS))
    //     // console.log(`RSI: ${RSI}`)
    //     // const avg1 = (Number(price[0][1]) + Number(price[0][4]))/2
    //     // const avg2 = (Number(price[1][1]) + Number(price[1][4]))/2
    //     // const avg = (avg1+avg2)/2
    //     // console.log(`Ticker: ${ticker.price} | Average: ${avg}`)
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

    // const width = settings.WIGGLE_ROOM/100
    // const topBorder = 1+Number(width)/2
    // const bottomBorder = 1-Number(width)/2
    // const fullMultiplier = settings.WIGGLE_ROOM/100+1

    // console.log(fullMultiplier)
    // console.log(topBorder)
    // console.log(bottomBorder)

    // setInterval(() => {
    //     if (number = 5) {
    //         let another = 4
    //         if (another = 4) {
    //             return
    //         }
    //     } 
    //     console.log("this should never be executed.")
    // }, 3000);

    // setInterval(async() => {
    //     const RSI = await getRSI()
    //     console.log('RSI: ', RSI)
    // }, 1000);

    ; (async () => {
        let data = await exchangeInfo(settings)
        console.log(data)
    })();