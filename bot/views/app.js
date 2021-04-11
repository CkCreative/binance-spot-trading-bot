socket = io();

let box = document.getElementById("box")
let ticker = document.getElementById("ticker")
let quantities = [12, 19, 3, 5, 2, 3]
socket.on('pending', function (msg) {
    box.innerHTML = `Latest Order: | ${msg.origQty}@${msg.price} | ${msg.side} | ${msg.status}`
});
socket.on('ticker', function (msg) {
    ticker.innerHTML = `Current Price: ${msg}`
});

let ctx = document.getElementById('chart').getContext('2d');
let myChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Performance of the Main Asset',
            data: quantities,
            backgroundColor: [
                'rgba(255, 99, 132, 0.2)',
                'rgba(54, 162, 235, 0.2)',
                'rgba(255, 206, 86, 0.2)',
                'rgba(75, 192, 192, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(255, 159, 64, 0.2)'
            ],
            borderColor: [
                'rgba(255, 99, 132, 1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)'
            ],
            borderWidth: 1
        }]
    },
    options: {
        scales: {
            y: {
                beginAtZero: true,
            },
            xAxes: {
                type: 'time',
                time: {
                    unit: 'hour'
                },
            }
        }
    }
});

socket.on('quantities', function (msg) {
    let pc = 0
    try {
        pc = ((msg[msg.length - 1].y - msg[0].y) / msg[msg.length - 1].y) * 100
        pc = (pc).toFixed(2)
        if (pc > 0) {
            myChart.data.datasets[0].label = `Performance of the Main Asset (+${pc}%)`
        } else {
            myChart.data.datasets[0].label = `Performance of the Main Asset (-${pc}%)`
        }
    } catch (error) {
        console.log(error)
    }
    quantities = [...msg]
    myChart.data.datasets[0].data = quantities
    myChart.update()
});