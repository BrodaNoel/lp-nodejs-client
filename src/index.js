require('dotenv').config({ path: '.env' });
const { HttpProvider, Keyring } = require('@polkadot/api');
const { ApiPromise } = require('@polkadot/api/promise');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

const baseUrl = 'https://mainnet-rpc.chainflip.io';
const ownerAddress = process.env.OWNER_ADDRESS;

if (!ownerAddress) {
  throw new Error('OWNER_ADDRESS env variable is required');
}

const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';
const YELLOW = '\x1b[33m';

function priceToTick(price, decimals_of_quote_asset, decimals_of_base_asset) {
  const quote = price * Math.pow(10, decimals_of_quote_asset - decimals_of_base_asset);
  const tick = Math.round(Math.log(quote) / Math.log(1.0001));
  return Math.min(Math.max(tick, -887272), 887272);
}

function tickToPrice(tick, decimals_of_quote_asset, decimals_of_base_asset) {
  const quote = Math.pow(1.0001, tick);
  return quote * Math.pow(10, decimals_of_base_asset - decimals_of_quote_asset);
}

function priceToHexPrice(price, decimals_of_quote_asset, decimals_of_base_asset) {
  let shifted = BigInt(price * 2 ** 128);
  let hex_price =
    (shifted * 10n ** BigInt(decimals_of_quote_asset)) / 10n ** BigInt(decimals_of_base_asset);
  let hex_string = hex_price.toString(16);
  return '0x' + (hex_string.length % 2 ? '0' : '') + hex_string;
}

function hexPriceToPrice(hex_price, decimals_of_quote_asset, decimals_of_base_asset) {
  return (
    (Number(BigInt(hex_price)) / 2 ** 128) *
    10 ** (decimals_of_base_asset - decimals_of_quote_asset)
  );
}

function sqrtPriceToPrice(hex_input, decimals_of_quote_asset, decimals_of_base_asset) {
  let raw_price = Math.pow(Number(BigInt(hex_input)) / 2 ** 96, 2);
  return raw_price * 10 ** (decimals_of_base_asset - decimals_of_quote_asset);
}

function priceToSqrtPrice(price, decimals_of_quote_asset, decimals_of_base_asset) {
  let hex_sqrt = BigInt(
    Math.sqrt(price / 10 ** (decimals_of_base_asset - decimals_of_quote_asset)) * 2 ** 96
  );
  let hex_string = hex_sqrt.toString(16);
  return '0x' + (hex_string.length % 2 ? '0' : '') + hex_string;
}

function hexQuantityToQuantity(hex, decimals_of_quote_asset) {
  return Number(BigInt(hex)) / 10 ** decimals_of_quote_asset;
}

const orderParser = x =>
  console.log(`ID ${x.id}
TICK ${x.tick}      ${YELLOW}${tickToPrice(x.tick, 6, 6)}${RESET}
SELL_PENDING  ${GREEN}${hexQuantityToQuantity(x.sell_amount, 6)}${RESET}
SELL_ORIGINAL ${GREEN}${hexQuantityToQuantity(x.original_sell_amount, 6)}${RESET}`);

const get = async params => {
  const response = await fetch(baseUrl, {
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

(async () => {
  try {
    const i = Date.now();
    const [balances, currentOrders, prices] = await Promise.all([
      get({
        method: 'cf_asset_balances',
        params: {
          account_id: ownerAddress,
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
          lp: ownerAddress,
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
    console.log(Date.now() - i, 'ms');

    console.log('');

    console.log('=== BALANCE ===');
    console.log('Ethereum', 'USDC', hexQuantityToQuantity(balances.Ethereum.USDC, 6));
    console.log('Ethereum', 'USDT', hexQuantityToQuantity(balances.Ethereum.USDT, 6));

    console.log('');

    if (currentOrders.limit_orders.asks.length > 0) {
      console.log('=== ASKS (BUYING USDC) ===');
      currentOrders.limit_orders.asks.forEach(orderParser);
    }

    if (currentOrders.limit_orders.bids.length > 0) {
      console.log('=== BIDS (BUYING USDT) ===');
      currentOrders.limit_orders.bids.forEach(orderParser);
    }

    console.log('');

    console.log('=== PRICES ===');
    console.log(prices.base_asset.asset, sqrtPriceToPrice(prices.buy, 6, 6));

    const provider = new HttpProvider(baseUrl);
    const api = new ApiPromise({ provider });

    console.log('Connecting to the RPC...');
    await api.isReady;
    console.log('Connected');

    await cryptoWaitReady();
    const keyring = new Keyring({ type: 'sr25519' });
    const signer = keyring.addFromMnemonic(process.env.MNEMONIC);

    const baseAsset = 'Usdt';
    const quoteAsset = 'Usdc';
    const side = 'Buy';
    const orderId = BigInt(1);
    const tick = priceToTick(0.996, 6, 6);
    const sellAmount = BigInt(balances.Ethereum.USDC);

    const result = await api.tx.liquidityPools
      .setLimitOrder(
        baseAsset,
        quoteAsset,
        side,
        orderId.toString(),
        tick.toString(),
        sellAmount.toString()
      )
      .signAndSend(signer);

    console.log(GREEN, 'Limit order created!', RESET);
    console.log(result);
  } catch (error) {
    console.error(error);
  }
})();
