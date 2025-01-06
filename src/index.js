require('dotenv').config({ path: '.env' });
const { Keyring, HttpProvider, ApiPromise } = require('@polkadot/api');
const { u8aToHex } = require('@polkadot/util');
const { cryptoWaitReady } = require('@polkadot/util-crypto');
const { logIncorrectAddress, logIncorrectPublicKey, logOrder } = require('./logs');
const { hexQuantityToQuantity, priceToTick, sqrtPriceToPrice } = require('./utils');

if (!process.env.OWNER_ADDRESS) {
  throw new Error('OWNER_ADDRESS env variable is required');
}

if (!process.env.POLKADOT_PUBLIC_KEY) {
  throw new Error('POLKADOT_PUBLIC_KEY env variable is required');
}

if (!process.env.POLKADOT_SEED) {
  throw new Error('POLKADOT_SEED env variable is required');
}

const HTTP_RPC = process.env.HTTP_RPC_URL || 'https://mainnet-rpc.chainflip.io';

const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

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

(async () => {
  let api;

  try {
    console.log('Getting Balances, current orders, and current prices...');

    const [balances, currentOrders, prices] = await Promise.all([
      get({
        method: 'cf_asset_balances',
        params: {
          account_id: process.env.OWNER_ADDRESS,
        },
      }),
      get({
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
      }),
      get({
        method: 'cf_pool_price_v2',
        params: [
          { asset: 'USDT', chain: 'Ethereum' },
          { asset: 'USDC', chain: 'Ethereum' },
        ],
      }),
    ]);

    console.log('');

    console.log('=== BALANCE ===');
    console.log('Ethereum', 'USDC', hexQuantityToQuantity(balances.Ethereum.USDC, 6));
    console.log('Ethereum', 'USDT', hexQuantityToQuantity(balances.Ethereum.USDT, 6));

    console.log('');

    if (currentOrders.limit_orders.asks.length > 0) {
      console.log('=== ASKS (BUYING USDC) ===');
      currentOrders.limit_orders.asks.forEach(logOrder);
    }

    if (currentOrders.limit_orders.bids.length > 0) {
      console.log('=== BIDS (BUYING USDT) ===');
      currentOrders.limit_orders.bids.forEach(logOrder);
    }

    console.log('');

    console.log('=== PRICES ===');
    console.log(prices.base_asset.asset, sqrtPriceToPrice(prices.buy, 6, 6));

    console.log('');

    console.log('=== STRATEGIES ===');

    /**
     * STRATEGY: BASIC / NON-STRATEGY
     * POOL: USDT/USDC
     * PRICE: Hardcoded
     *
     * This "strategy" just set a new limit-order in case there is some balance.
     * The price is hardcoded
     *
     * Example:
     * - If USDT balance is > 0, set an order to sell it (buy USDC).
     * - If USDC balance is > 0, set an order to sell it (buy USDT).
     */

    const usdtBalance = hexQuantityToQuantity(balances.Ethereum.USDT, 6);
    const usdcBalance = hexQuantityToQuantity(balances.Ethereum.USDC, 6);

    if (usdtBalance > 0 || usdcBalance > 0) {
      console.log(GREEN, 'Executing Strategy: "BASIC"', RESET);

      if (usdtBalance > 0) {
        console.log(GREEN, 'Selling USDT', RESET);
        await setLimitOrder('Usdt', 'Usdc', 'Sell', 1.001, balances.Ethereum.USDT);
      }

      if (usdcBalance > 0) {
        console.log(GREEN, 'Buying USDT', RESET);
        await setLimitOrder('Usdt', 'Usdc', 'Buy', 0.999, balances.Ethereum.USDC);
      }
    } else {
      console.log('Strategy "BASIC" was NOT executed');
      console.log('Reason: No free balance available');
    }

    console.log(GREEN, 'Done!', RESET);
  } catch (error) {
    console.error(error);

    if (api.isConnected) {
      console.log('Disconnecting...');
      api.disconnect();
    }

    console.error('Done with error');
  }
})();
