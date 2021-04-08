socket = io();

let box = document.getElementById("box")
let ticker = document.getElementById("ticker")
socket.on('pending', function (msg) {
    box.innerHTML = `Latest Order: | ${msg.origQty}@${msg.price} | ${msg.side} | ${msg.status}`
});
socket.on('ticker', function (msg) {
    ticker.innerHTML = `Current Price: ${msg}`
});