socket = io();

let box = document.getElementById("box");
let ticker = document.getElementById("ticker");
let balances = document.getElementById("balances");
let markets = document.getElementById("markets");
let quantities = {};
let selectedPair;
var app = new Vue({
  el: "#app",
  data: {
    selectedPair: null,
    balances: {},
    estTotal: 0,
    markets: {},
    quantities: {},
    chartData: {
      stuff: [],
    },
    prices: {},
    ticker: 0,
    latestOrders: {},
    latestOrder: {
      origQty: 0,
      price: 0,
      side: "",
      status: "",
    },
    possibleOrders: {},
  },
  methods: {
    updateGraph() {
      let idx = 0;
      for (let p in app.quantities) {
        let pc = 0,
          selected = app.quantities[p];
        try {
          pc =
            ((selected[selected.length - 1].y - selected[idx].y) /
              selected[selected.length - 1].y) *
            100;
          pc = pc.toFixed(2);
          let chartLabel = `Performance of the ${p} Market (`;
          if (pc > 0) {
            chartLabel += `+${pc}%)`;
          } else {
            chartLabel += `-${pc}%)`;
          }
          console.log(p, idx, myChart.data);
          if (!myChart.data.datasets[idx]) {
            console.log("new row");
            console.log({
              ...defaultDataset,
              ...{ label: chartLabel },
            });
            myChart.data.datasets.push({
              ...defaultDataset,
              ...{ label: chartLabel, data: selected },
            });
            /*     myChart.data.labels.push(chartLabel);
             */
          } else {
            myChart.data.datasets[idx].data = selected;
            myChart.data.datasets[idx].label = chartLabel;
          }
          console.log(myChart.data);
        } catch (error) {
          console.log(error);
        }

        idx++;
      }

      //  let q = [...selected];
      myChart.update();
    },
  },
});
socket.on("pending", function (tradingPair, msg) {
  app.latestOrder = msg;
  app.latestOrders[tradingPair] = msg;
});
socket.on("ticker", function (tradingPair, msg) {
  app.ticker = msg;
});
socket.on("portfolio", function (portfolio) {
  app.balances = portfolio.balances;
  app.markets = portfolio.pairs;
  app.estTotal = 0;
  for (let symbol in app.balances) {
    let compareTo = "BUSD",
      busdPair = symbol + compareTo;
    if (symbol == compareTo) {
      app.estTotal +=
        Number(app.balances[symbol].onOrder) +
        Number(app.balances[symbol].available);
    } else if (app.prices[busdPair]) {
      app.estTotal +=
        Number(app.prices[busdPair].price) *
        Number(app.balances[symbol].available);
      app.estTotal +=
        Number(app.prices[busdPair].price) *
        Number(app.balances[symbol].onOrder);
    } else {
      //console.log("no pair", busdPair);
    }
  }
});
socket.on("wouldTrade", function (tradingPair, tradeDetails) {
  // app.balances = portfolio.balances;
  // app.markets = portfolio.pairs;
  app.possibleOrders[tradingPair] = tradeDetails;
  //console.log(tradeDetails);
});
socket.on("priceUpdate", function (tradingPair, current_price) {
  if (!app.prices[tradingPair]) {
    app.prices[tradingPair] = {
      lastPrice: 0,
      price: 0,
      change: 0,
      pctChange: 0,
    };
  }

  app.prices[tradingPair].change =
    current_price - app.prices[tradingPair].lastPrice;
  if (app.prices[tradingPair].lastPrice !== 0) {
    app.prices[tradingPair].pctChange =
      (app.prices[tradingPair].change / app.prices[tradingPair].lastPrice) *
      100;
  }
  app.prices[tradingPair].lastPrice = app.prices[tradingPair].price;
  app.prices[tradingPair].price = current_price;
  if (app.prices["BTCBUSD"]) {
    const basePrice = app.prices["BTCBUSD"].price;
    if (basePrice > 0) {
      if (tradingPair == "BTCBUSD") {
        for (const key in app.prices) {
          const element = app.prices[key];
          element.strength = (element.price / basePrice) * 100;
        }
      } else {
        app.prices[tradingPair].strength =
          (app.prices[tradingPair].price / basePrice) * 100;
      }
    }
  }
});

let ctx = document.getElementById("chart").getContext("2d");
let ctx2 = document.getElementById("chart2").getContext("2d");
let ctx3 = document.getElementById("chart-portfolio").getContext("2d");
const defaultDataset = {
  label: "",
  data: [],
  backgroundColor: [
    "rgba(255, 99, 132, 0.2)",
    "rgba(54, 162, 235, 0.2)",
    "rgba(255, 206, 86, 0.2)",
    "rgba(75, 192, 192, 0.2)",
    "rgba(153, 102, 255, 0.2)",
    "rgba(255, 159, 64, 0.2)",
  ],
  borderColor: [
    "rgba(255, 99, 132, 1)",
    "rgba(54, 162, 235, 1)",
    "rgba(255, 206, 86, 1)",
    "rgba(75, 192, 192, 1)",
    "rgba(153, 102, 255, 1)",
    "rgba(255, 159, 64, 1)",
  ],
  borderWidth: 1,
};

let myChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [{ ...defaultDataset }],
  },
  options: {
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
      },
      xAxes: {
        type: "time",
        time: {
          minUnit: "second",
          /*unit: "hour",*/
        },
      },
    },
  },
});
let portfolioChart = new Chart(ctx3, {
  type: "pie",
  data: {
    labels: [],
    datasets: [{ ...defaultDataset }],
  },
  options: {
    cutout: "50%",
  },
});
function adjustRadiusBasedOnData(ctx) {
  var v = ctx.parsed.y;
  if (app.markets["ETHBUSD"]) {
    for (let i in app.markets["ETHBUSD"].tradeHistory) {
      let e = app.markets["ETHBUSD"].tradeHistory[i];
      //console.log(e.time,ctx.parsed.x );
      if (e.time) {
        let dist = Math.abs(ctx.parsed.x - e.time);
        if (dist < 2000) {
          console.log(e);
          return 50;
        }
      }
    }
  }
  return 2;
}
let histConfig = {
  type: "candlestick",
  /*  data: {
    labels: [],
    datasets: [{ ...defaultDataset }],
  }, */
  options: {
    plugins: {
      legend: true,
      tooltip: true,
      zoom: {
        zoom: {
          pan:{
            enabled: true
          },
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: "x",
        },
      },
    },
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: false,
      },
      xAxes: {
        type: "time",
        time: {
          minUnit: "second",
          /*unit: "hour",*/
        },
      },
    },
    elements: {
      point: {
        radius: adjustRadiusBasedOnData,
        hoverRadius: 15,
      },
    },
  },
};
let myChart2 = new Chart(ctx2, histConfig);
socket.on("quantities", function (msg) {
  quantities = msg;
  app.quantities = msg;
  console.log(msg);
  app.updateGraph();
});

socket.on("chartUpdate", function (tradingPair, chart) {
  let data = [],
    chartLabel = tradingPair;
  for (let i in chart) {
    data.push({
      x: i / 10,
      o: chart[i].open,
      c: chart[i].close,
      h: chart[i].high,
      l: chart[i].low,
    });
  }
  let found = 0;
  app.chartData.stuff[tradingPair] = data;
  myChart2.data.datasets.forEach((dataset) => {
    if (dataset.label == tradingPair) {
      dataset.data = app.chartData.stuff[tradingPair];
      found = true;
    }
  });
  if (!found) {
    myChart2.data.datasets.push({
      ...defaultDataset,
      ...{
        label: chartLabel,
        data: app.chartData.stuff[tradingPair],
        color: { up: "#01ff01", down: "#fe0000", unchanged: "#999" },
      },
    });
  }
  myChart2.update();
});
