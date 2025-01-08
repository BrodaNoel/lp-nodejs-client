require('dotenv').config({ path: '.env' });
const { logOrder } = require('./logs');
const { runStrategy } = require('./strategies');
const { getPrices, getCurrentOrders } = require('./actions');

const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

console.log('Checking basic configurations...');

if (!process.env.OWNER_ADDRESS) {
  throw new Error('OWNER_ADDRESS env variable is required');
}

if (!process.env.POLKADOT_PUBLIC_KEY) {
  throw new Error('POLKADOT_PUBLIC_KEY env variable is required');
}

if (!process.env.POLKADOT_SEED) {
  throw new Error('POLKADOT_SEED env variable is required');
}

if (!process.env.STRATEGY) {
  throw new Error(
    'STRATEGY env variable is required. Please read the README file in order to understand how to define a strategy'
  );
}

console.log(GREEN, 'Basic configurations: All good', RESET);

(async () => {
  let api;

  try {
    console.log('Starting bot...');

    if (process.env.LOG_CURRENT_ORDERS === 'true') {
      console.log('\n=== CURRENT ORDERS ===');

      const currentOrders = await getCurrentOrders();

      if (currentOrders.limit_orders.asks.length > 0) {
        console.log('=== ASKS (BUYING USDC) ===');
        currentOrders.limit_orders.asks.forEach(logOrder);
      }

      if (currentOrders.limit_orders.bids.length > 0) {
        console.log('=== BIDS (BUYING USDT) ===');
        currentOrders.limit_orders.bids.forEach(logOrder);
      }

      if (
        currentOrders.limit_orders.asks.length === 0 &&
        currentOrders.limit_orders.bids.length === 0
      ) {
        console.log('No opened orders');
      }
    }

    if (process.env.LOG_PRICES === 'true') {
      await getPrices();
    }

    console.log('\n=== STRATEGIES ===');

    await runStrategy(process.env.STRATEGY);

    console.log(GREEN, 'Done!', RESET);
  } catch (error) {
    console.error(error);

    if (api && api.isConnected) {
      console.log('Disconnecting...');
      api.disconnect();
    }

    console.error('Done with error');
  }
})();
