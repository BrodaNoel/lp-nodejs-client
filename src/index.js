require('dotenv').config({ path: '.env' });
const { Keyring, HttpProvider, ApiPromise } = require('@polkadot/api');
const { u8aToHex } = require('@polkadot/util');
const { cryptoWaitReady } = require('@polkadot/util-crypto');
const { logIncorrectAddress, logIncorrectPublicKey, logOrder } = require('./logs');
const { hexQuantityToQuantity, priceToTick, sqrtPriceToPrice } = require('./utils');

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

const HTTP_RPC = process.env.HTTP_RPC_URL || 'https://mainnet-rpc.chainflip.io';

const get = async params => {
  const response = await fetch(HTTP_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      ...params,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC call failed with status code ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`RPC returned error: ${JSON.stringify(data.error)}`);
  }

  return data.result;
};

let httpApi;
async function getHttpServer() {
  if (httpApi) {
    await httpApi.isReady;
    return httpApi;
  }

  const provider = new HttpProvider(HTTP_RPC);

  httpApi = new ApiPromise({ provider, noInitWarn: true });

  console.log('Connecting to the RPC...');
  await httpApi.isReady;
  console.log('Connected');

  return httpApi;
}

let pair;
async function getPair() {
  if (pair) {
    return pair;
  }

  await cryptoWaitReady();

  const keyring = new Keyring({ type: 'ed25519', ss58Format: 2112 });
  pair = keyring.addFromUri(process.env.POLKADOT_SEED);

  if (pair.address !== process.env.OWNER_ADDRESS) {
    logIncorrectAddress(pair);
    throw new Error('Incorrect address');
  }

  if (u8aToHex(pair.publicKey) !== process.env.POLKADOT_PUBLIC_KEY) {
    logIncorrectPublicKey(pair);
    throw new Error('Incorrect public key');
  }

  return pair;
}

let lastOrderId = Date.now();
async function setLimitOrder(base, quote, side, price, amount) {
  if (base !== 'Usdt' || quote !== 'Usdc') {
    throw new Error('Pool not implemented. Currently only USDT/USDC is implemented');
  }

  const api = await getHttpServer();
  const pair = await getPair();

  lastOrderId++;
  const orderId = BigInt(lastOrderId).toString();
  const tick = priceToTick(price, 6, 6).toString();
  const sellAmount = BigInt(amount);

  await api.tx.liquidityPools
    .setLimitOrder(base, quote, side, orderId, tick, sellAmount)
    .signAndSend(pair);
}

async function getBalances() {
  return get({
    method: 'cf_asset_balances',
    params: {
      account_id: process.env.OWNER_ADDRESS,
    },
  });
}

async function getCurrentOrders() {
  return get({
    method: 'cf_pool_orders',
    params: {
      base_asset: {
        chain: 'Ethereum',
        asset: 'USDT',
      },
      quote_asset: {
        chain: 'Ethereum',
        asset: 'USDC',
      },
      lp: process.env.OWNER_ADDRESS,
    },
  });
}

async function getPrices() {
  return get({
    method: 'cf_pool_price_v2',
    params: [
      { asset: 'USDT', chain: 'Ethereum' },
      { asset: 'USDC', chain: 'Ethereum' },
    ],
  });
}

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
    }

    if (process.env.LOG_PRICES === 'true') {
      console.log('\n=== PRICES ===');
      const prices = await getPrices();

      console.log(prices.base_asset.asset, 'BUY:', sqrtPriceToPrice(prices.buy, 6, 6));
      console.log(prices.base_asset.asset, 'SELL:', sqrtPriceToPrice(prices.sell, 6, 6));
    }

    console.log('\n=== STRATEGIES ===');

    switch (process.env.STRATEGY) {
      case 'SELL-STABLECOIN-BASIC':
        /**
         * STRATEGY: SELL-STABLECOIN-BASIC
         * POOL: USDT/USDC
         * PRICE: Hardcoded in .env: `STRATEGY_USDT_SELL_PRICE` and `STRATEGY_USDT_BUY_PRICE`
         */

        console.log('Strategy defined: "SELL-STABLECOIN-BASIC"');

        const USDT_SELL_PRICE = Number(process.env.STRATEGY_USDT_SELL_PRICE);
        const USDT_BUY_PRICE = Number(process.env.STRATEGY_USDT_BUY_PRICE);

        if (!(USDT_SELL_PRICE > 0)) {
          throw new Error(`STRATEGY_USDT_SELL_PRICE env variable should be > 0`);
        }
        if (!(USDT_BUY_PRICE > 0)) {
          throw new Error(`STRATEGY_USDT_BUY_PRICE env variable should be > 0`);
        }

        console.log('\n=== BALANCES ===');
        const balances = await getBalances();

        console.log('Ethereum', 'USDC', hexQuantityToQuantity(balances.Ethereum.USDC, 6));
        console.log('Ethereum', 'USDT', hexQuantityToQuantity(balances.Ethereum.USDT, 6));
        console.log('================\n');

        const usdtBalance = hexQuantityToQuantity(balances.Ethereum.USDT, 6);
        const usdcBalance = hexQuantityToQuantity(balances.Ethereum.USDC, 6);

        if (usdtBalance > 0 || usdcBalance > 0) {
          console.log(GREEN, 'Executing Strategy: "BASIC"', RESET);

          if (usdtBalance > 0) {
            console.log(GREEN, 'Selling USDT', RESET);
            await setLimitOrder('Usdt', 'Usdc', 'Sell', USDT_SELL_PRICE, balances.Ethereum.USDT);
          }

          if (usdcBalance > 0) {
            console.log(GREEN, 'Buying USDT', RESET);
            await setLimitOrder('Usdt', 'Usdc', 'Buy', USDT_BUY_PRICE, balances.Ethereum.USDC);
          }
        } else {
          console.log('Strategy "SELL-STABLECOIN-BASIC" was NOT executed');
          console.log('Reason: No free balance available');
        }
        break;

      default:
        throw new Error(
          'The strategy defined as STRATEGY in the env file, is not a valid strategy'
        );
    }

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
