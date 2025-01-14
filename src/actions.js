const { Keyring, HttpProvider, ApiPromise } = require('@polkadot/api');
const { u8aToHex } = require('@polkadot/util');
const { cryptoWaitReady } = require('@polkadot/util-crypto');
const { logIncorrectAddress, logIncorrectPublicKey, logLiquidity } = require('./logs');
const { hexQuantityToQuantity, priceToTick, sqrtPriceToPrice, tickToPrice } = require('./utils');

const HTTP_RPC = process.env.HTTP_RPC_URL || 'https://mainnet-rpc.chainflip.io';

const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

let httpApi;
async function getHttpServer(attempt = 0) {
  try {
    if (httpApi) {
      await httpApi.isReady;
      return httpApi;
    }

    const provider = new HttpProvider(HTTP_RPC);

    httpApi = new ApiPromise({ provider, noInitWarn: true });

    const i = Date.now();

    console.log('Connecting to the HTTP server...');

    await httpApi.isReady;

    console.log('Connected', `(${Date.now() - i} ms)`);

    return httpApi;
  } catch (error) {
    console.error(`Failed attempt ${attempt} to connect to HTTP server: ${error.message}`);

    if (attempt >= 3) {
      throw new Error('Too many attempts (3) to connect to HTTP Server: ' + error.message);
    }

    httpApi = null;
    return await getHttpServer(attempt + 1);
  }
}

let pair;
async function getPair() {
  if (pair) {
    return pair;
  }

  const i = Date.now();

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

  console.log('Pair generated', `(${Date.now() - i} ms)`);

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

let balancesCache = null;
async function getBalances() {
  const i = Date.now();

  console.log('🏦 BALANCES | Getting balances...');

  const balances = balancesCache
    ? balancesCache
    : await get({
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

  // clearn asks
  liquidity.limit_orders.asks.forEach(x => {
    x.tickPrice = tickToPrice(x.tick, 6, 6);
    x.amountNumber = hexQuantityToQuantity(x.amount, 6);
  });
  liquidity.limit_orders.asks.sort((a, b) => a.tick - b.tick);
  liquidity.limit_orders.asks = liquidity.limit_orders.asks
    .filter(x => x.amountNumber >= 1)
    .slice(0, 5);

  // clear bids
  liquidity.limit_orders.bids.forEach(x => {
    x.tickPrice = tickToPrice(x.tick, 6, 6);
    x.amountNumber = hexQuantityToQuantity(x.amount, 6);
  });
  liquidity.limit_orders.bids.sort((a, b) => b.tick - a.tick);
  liquidity.limit_orders.bids = liquidity.limit_orders.bids
    .filter(x => x.amountNumber >= 1)
    .slice(0, 5);

  console.log('🏧 LIQUIDITY | SELLING');
  liquidity.limit_orders.asks.forEach(logLiquidity);
  console.log('🏧 LIQUIDITY | BUYING');
  liquidity.limit_orders.bids.forEach(logLiquidity);

  return liquidity;
}

let lastOrderId = Date.now();
async function setLimitOrder(base, quote, side, price, amount) {
  if (base !== 'Usdt' || quote !== 'Usdc') {
    throw new Error('Pool not implemented. Currently only USDT/USDC is implemented');
  }

  const i = Date.now();

  console.log(GREEN, side === 'Sell' ? '🚀 Selling USDT' : '🚀 Buying USDT', `@ ${price}`, RESET);

  const api = await getHttpServer();
  const pair = await getPair();

  lastOrderId++;
  const orderId = BigInt(lastOrderId).toString();
  const tick = priceToTick(price, 6, 6).toString();
  const sellAmount = BigInt(amount);

  balancesCache = null;
  await api.tx.liquidityPools
    .setLimitOrder(base, quote, side, orderId, tick, sellAmount)
    .signAndSend(pair);
  balancesCache = null;

  console.log(
    GREEN,
    side === 'Sell' ? '✅ Sell done' : '✅ Buy done',
    RESET,
    `(${Date.now() - i} ms)`
  );
}

/**
 * side: buy/sell
 * maxOrMin: float
 * liquidity: [{ tick: 3, tickPrice: 1.0003000300009999, amount:"0x7b550e7c" }
 * 1.0003
 */
function getPriceFromLiquidity(side, maxOrMin, liquidity) {
  const price = liquidity.find(x => {
    if (side === 'buy') {
      return x.tickPrice <= maxOrMin;
    } else if (side === 'sell') {
      return x.tickPrice >= maxOrMin;
    } else {
      throw new Error('Incorrect `side` on `getPriceFromLiquidity`');
    }
  });

  return price;
}

async function closeAllOpenedPositions() {
  const i = Date.now();

  const currentOrders = await getCurrentOrders();

  const orders = [
    ...currentOrders.limit_orders.asks.map(x => ({
      Limit: {
        id: x.id,
        baseAsset: 'Usdt',
        quoteAsset: 'Usdc',
        side: 'Sell',
      },
    })),
    ...currentOrders.limit_orders.bids.map(x => ({
      Limit: {
        id: x.id,
        baseAsset: 'Usdt',
        quoteAsset: 'Usdc',
        side: 'Buy',
      },
    })),
  ];

  if (orders.length > 0) {
    const api = await getHttpServer();
    const pair = await getPair();

    balancesCache = null;
    await api.tx.liquidityPools.cancelOrdersBatch(orders).signAndSend(pair);
    balancesCache = null;
  }

  console.log(
    GREEN,
    orders.length > 0 ? `✅ All positions closed (${orders.length})` : 'No positions to close',
    RESET,
    `(${Date.now() - i} ms)`
  );
}

module.exports = {
  getHttpServer,
  getPair,
  get,
  getCurrentOrders,
  getBalances,
  getPrices,
  getLiquidity,
  setLimitOrder,
  getPriceFromLiquidity,
  closeAllOpenedPositions,
};
