const { Keyring, HttpProvider, ApiPromise } = require('@polkadot/api');
const { u8aToHex } = require('@polkadot/util');
const { cryptoWaitReady } = require('@polkadot/util-crypto');
const { logIncorrectAddress, logIncorrectPublicKey, logLiquidity } = require('./logs');
const { hexQuantityToQuantity, priceToTick, sqrtPriceToPrice } = require('./utils');

const HTTP_RPC = process.env.HTTP_RPC_URL || 'https://mainnet-rpc.chainflip.io';

const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

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

async function get(params) {
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
}

async function getCurrentOrders() {
  return get({
    method: 'cf_pool_orders',
    params: {
      base_asset: { chain: 'Ethereum', asset: 'USDT' },
      quote_asset: { chain: 'Ethereum', asset: 'USDC' },
      lp: process.env.OWNER_ADDRESS,
    },
  });
}

async function getBalances() {
  const i = Date.now();

  console.log('🏦 BALANCES | Getting balances...');

  const balances = await get({
    method: 'cf_asset_balances',
    params: {
      account_id: process.env.OWNER_ADDRESS,
    },
  });

  console.log(
    '🏦 BALANCES |',
    'ETH:USDC:',
    hexQuantityToQuantity(balances.Ethereum.USDC, 6),
    '| ',
    'ETH:USDT:',
    hexQuantityToQuantity(balances.Ethereum.USDT, 6),
    `(${Date.now() - i} ms)`
  );

  return balances;
}

async function getPrices() {
  const i = Date.now();
  console.log('💵 PRICES | Getting prices...');

  const prices = await get({
    method: 'cf_pool_price_v2',
    params: [
      { chain: 'Ethereum', asset: 'USDT' },
      { chain: 'Ethereum', asset: 'USDC' },
    ],
  });

  console.log(
    '💵 PRICES |',
    'ETH:USDT BUY:',
    sqrtPriceToPrice(prices.buy, 6, 6),
    '| ',
    'ETH:USDT SELL:',
    sqrtPriceToPrice(prices.sell, 6, 6),
    `(${Date.now() - i} ms)`
  );

  return prices;
}

async function getLiquidity() {
  const i = Date.now();

  console.log('🏧 LIQUIDITY | Getting liquidity...');

  const liquidity = await get({
    method: 'cf_pool_liquidity',
    params: {
      base_asset: { chain: 'Ethereum', asset: 'USDT' },
      quote_asset: { chain: 'Ethereum', asset: 'USDC' },
    },
  });

  console.log('🏧 LIQUIDITY | ETH:USDT/USDC', `(${Date.now() - i} ms)`);
  console.log('🏧 LIQUIDITY | SELLING');
  liquidity.limit_orders.asks.sort((a, b) => a.tick - b.tick);
  liquidity.limit_orders.asks.forEach(logLiquidity);
  console.log('🏧 LIQUIDITY | BUYING');
  liquidity.limit_orders.bids.sort((a, b) => b.tick - a.tick);
  liquidity.limit_orders.bids.forEach(logLiquidity);

  return liquidity;
}

let lastOrderId = Date.now();
async function setLimitOrder(base, quote, side, price, amount) {
  if (base !== 'Usdt' || quote !== 'Usdc') {
    throw new Error('Pool not implemented. Currently only USDT/USDC is implemented');
  }

  const i = Date.now();

  console.log(GREEN, side === 'Sell' ? '🚀 Selling USDT' : '🚀 Buying USDT', RESET);

  const api = await getHttpServer();
  const pair = await getPair();

  lastOrderId++;
  const orderId = BigInt(lastOrderId).toString();
  const tick = priceToTick(price, 6, 6).toString();
  const sellAmount = BigInt(amount);

  await api.tx.liquidityPools
    .setLimitOrder(base, quote, side, orderId, tick, sellAmount)
    .signAndSend(pair);

  console.log(
    GREEN,
    side === 'Sell' ? '✅ Sell done' : '✅ Buy done',
    RESET,
    `(${Date.now() - i} ms)`
  );
}

module.exports = {
  get,
  getCurrentOrders,
  getBalances,
  getPrices,
  getLiquidity,
  setLimitOrder,
};
