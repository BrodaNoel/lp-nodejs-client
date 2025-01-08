const { hexQuantityToQuantity } = require('./utils');
const { setLimitOrder, getBalances } = require('./actions');
const { connectWs } = require('./wsServer');

const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

async function runStrategy(strategy) {
  console.log(`runStrategy:${strategy}`);

  if (strategy === 'SELL-STABLECOIN-BASIC') {
    /**
     * STRATEGY: SELL-STABLECOIN-BASIC
     * POOL: USDT/USDC
     * PRICE: Hardcoded in .env: `STRATEGY_USDT_SELL_PRICE` and `STRATEGY_USDT_BUY_PRICE`
     */

    const USDT_SELL_PRICE = Number(process.env.STRATEGY_USDT_SELL_PRICE);
    const USDT_BUY_PRICE = Number(process.env.STRATEGY_USDT_BUY_PRICE);

    if (!(USDT_SELL_PRICE > 0)) {
      throw new Error(`STRATEGY_USDT_SELL_PRICE env variable should be > 0`);
    }
    if (!(USDT_BUY_PRICE > 0)) {
      throw new Error(`STRATEGY_USDT_BUY_PRICE env variable should be > 0`);
    }

    const balances = await getBalances();

    const usdtBalance = hexQuantityToQuantity(balances.Ethereum.USDT, 6);
    const usdcBalance = hexQuantityToQuantity(balances.Ethereum.USDC, 6);

    if (usdtBalance > 0 || usdcBalance > 0) {
      console.log(GREEN, 'Free balance found', RESET);

      if (usdtBalance > 0) {
        console.log(GREEN, 'Selling USDT', RESET);
        await setLimitOrder('Usdt', 'Usdc', 'Sell', USDT_SELL_PRICE, balances.Ethereum.USDT);
      }

      if (usdcBalance > 0) {
        console.log(GREEN, 'Buying USDT', RESET);
        await setLimitOrder('Usdt', 'Usdc', 'Buy', USDT_BUY_PRICE, balances.Ethereum.USDC);
      }
    } else {
      console.log('Reason: No free balance available');
    }
  } else if (strategy === 'SELL-STABLECOIN-BASIC-WS') {
    /**
     * STRATEGY: SELL-STABLECOIN-BASIC-WS
     * Exactly as SELL-STABLECOIN-BASIC, but will run on WebSockets on each
     * cf_subscribe_scheduled_swaps event (in case there are swaps on it)
     */

    function strategySellStableCoinBasicWsListener(/* message */) {
      // console.log(message.params.result.swaps);
      // TODO: Here we should actually check if the swap received is trying to buy what we
      // have on balance. It does not makes sense to set a SELL order if the swap is also selling
      runStrategy('SELL-STABLECOIN-BASIC');
    }

    await connectWs(strategySellStableCoinBasicWsListener);
  } else {
    throw new Error('The strategy defined as STRATEGY in the env file, is not valid');
  }
}

module.exports = {
  runStrategy,
};
