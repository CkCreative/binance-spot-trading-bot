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
    markets: {},
    quantities: {},
    prices: {},
    ticker: 0,
    latestOrder: {
      origQty: 0,
      price: 0,
      side: "",
      status: "",
    },
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
socket.on("pending", function (msg) {
  app.latestOrder = msg;
});
socket.on("ticker", function (msg) {
  app.ticker = msg;
});
socket.on("portfolio", function (portfolio) {
  app.balances = portfolio.balances;
  app.markets = portfolio.pairs;
});
socket.on("priceUpdate", function (tradingPair, current_price) {
  if (!app.prices[tradingPair]) {
    app.prices[tradingPair] = {
      lastPrice: 0,
      price: 0,
    };
  }
  app.prices[tradingPair].lastPrice = app.prices[tradingPair].price;
  app.prices[tradingPair].price = current_price;
  console.log(tradingPair, current_price);
});
let ctx = document.getElementById("chart").getContext("2d");
const defaultDataset = {
  label: "Waiting for data...",
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
          unit: "hour",
        },
      },
    },
  },
});

socket.on("quantities", function (msg) {
  quantities = msg;
  app.quantities = msg;
  console.log(msg);
  app.updateGraph();
});
