const { ringBell } = require('./logs');

const WS_RPC = process.env.WS_RPC_URL || 'wss://mainnet-rpc.chainflip.io';

let requestId = 0;
function getNextId() {
  requestId++;
  return requestId;
}

let ws = null;

async function connectWs(callback) {
  if (!callback) {
    throw new Error('🚨Missing callback on connectWs');
  }

  ws = new WebSocket(WS_RPC);

  // Event: Connection opened
  ws.onopen = () => {
    console.log('✅ Connected to the WebSocket server.');

    // Construct the subscription message
    const subscribeMessage = {
      id: getNextId(),
      jsonrpc: '2.0',
      method: 'cf_subscribe_scheduled_swaps',
      params: {
        base_asset: { chain: 'Ethereum', asset: 'USDT' },
        quote_asset: { chain: 'Ethereum', asset: 'USDC' },
      },
    };

    // Send the subscription message as a JSON string
    ws.send(JSON.stringify(subscribeMessage), err => {
      if (err) {
        console.error('🚨 Subscription error:', err);
        // TODO: Handle these errors
      } else {
        console.log('✅ Subscription message sent:', subscribeMessage);
      }
    });
  };

  // Event: Message received from server
  ws.onmessage = event => {
    try {
      const message = JSON.parse(event.data);

      // Handle different message types as per your application logic
      if (message.method === 'cf_subscribe_scheduled_swaps') {
        console.log(
          '👂 Event Listened: cf_subscribe_scheduled_swaps',
          message.params.result.block_number
        );
        callback(message);
      } else {
        console.log('👂 Event Listened: unknown', message);
      }
    } catch (err) {
      console.error('🚨 Error parsing message:', err);
    }
  };

  // Event: Connection closed
  ws.onclose = event => {
    if (event.code === 1000) {
      console.log(`🏁 ✅ WebSocket closed`);
    } else {
      console.log(`🚨 WebSocket connection closed with error: ${event.code} - ${event.reason}`);

      if ([1006].includes(event.code)) {
        setTimeout(() => {
          console.log('🔃 Reconnecting...');
          connectWs(callback);
        }, 1000);
      }
    }
  };

  // Event: Error occurred
  ws.onerror = error => {
    ringBell(2);
    console.error('🚨 WebSocket error:', error.message);
  };
}

process.on('SIGINT', () => {
  console.log('Received SIGINT. Closing WebSocket connection.');

  if (ws.readyState === WebSocket.OPEN) {
    ws.close(1000, 'Process terminated'); // 1000 indicates a normal closure
    // process.exit(0);
  }
});

module.exports = {
  connectWs,
};
