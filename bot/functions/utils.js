const fetch = require('node-fetch');
import settings from '../settings.json'

// Send discord messages, no fancy formatting, just the content of the message.
export const sendDiscord = (message) => {
    fetch(`${settings.DISCORD}`,{
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
          },
        body: JSON.stringify({
            content: message
        })
    }).then(data => {
        console.log(data)
    }).catch(e => {
            console.log(e)
        })
}