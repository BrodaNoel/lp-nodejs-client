const { hexQuantityToQuantity } = require('./utils');
const { setLimitOrder, getBalances } = require('./actions');
const { connectWs } = require('./wsServer');
const { ringBell, logUpcomingSwap } = require('./logs');

const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

async function runStrategy(strategy) {
  console.log(`runStrategy:${strategy}`);

  if (strategy === 'SELL-STABLECOIN-BASIC') {
    /**
     * STRATEGY: SELL-STABLECOIN-BASIC
     * POOL: USDT/USDC
     * PRICE: Hardcoded in .env: `STRATEGY_USDT_SELL_PRICE` and `STRATEGY_USDT_BUY_PRICE`
     *
     * If there is free balance, we sell it.
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
      console.log(GREEN, '💰 Free balance found', RESET);

      if (usdtBalance > 0) {
        console.log(GREEN, '🚀 Selling USDT', RESET);
        await setLimitOrder('Usdt', 'Usdc', 'Sell', USDT_SELL_PRICE, balances.Ethereum.USDT);
      }

      if (usdcBalance > 0) {
        console.log(GREEN, '🚀 Buying USDT', RESET);
        await setLimitOrder('Usdt', 'Usdc', 'Buy', USDT_BUY_PRICE, balances.Ethereum.USDC);
      }
    } else {
      console.log('😥 No free balance available');
    }
  } else if (strategy === 'SELL-STABLECOIN-BASIC-WS') {
    /**
     * STRATEGY: SELL-STABLECOIN-BASIC-WS
     * POOL: USDT/USDC
     * PRICE: Hardcoded in .env: `STRATEGY_USDT_SELL_PRICE` and `STRATEGY_USDT_BUY_PRICE`
     *
     * Similar to SELL-STABLECOIN-BASIC, but will run on WebSockets on each
     * cf_subscribe_scheduled_swaps event (in case there are swaps on it).
     * If there is a BUY SWAP upcoming, it creates a SELL.
     * If there is a SELL SWAP upcoming, it creates a BUY.
     */

    const USDT_SELL_PRICE = Number(process.env.STRATEGY_USDT_SELL_PRICE);
    const USDT_BUY_PRICE = Number(process.env.STRATEGY_USDT_BUY_PRICE);

    if (!(USDT_SELL_PRICE > 0)) {
      throw new Error(`STRATEGY_USDT_SELL_PRICE env variable should be > 0`);
    }
    if (!(USDT_BUY_PRICE > 0)) {
      throw new Error(`STRATEGY_USDT_BUY_PRICE env variable should be > 0`);
    }

    let waitAfterBlockNumber = 0;
    async function strategySellStableCoinBasicWsListener(message) {
      if (message.params.result.swaps.length === 0) {
        return;
      }

      if (waitAfterBlockNumber > message.params.result.block_number) {
        console.log(`🛑 Strategy skipped. Waiting for block ${waitAfterBlockNumber}`);
        return;
      }

      const swap = message.params.result.swaps[0];

      logUpcomingSwap(swap);

      const balances = await getBalances();

      const usdtBalance = hexQuantityToQuantity(balances.Ethereum.USDT, 6);
      const usdcBalance = hexQuantityToQuantity(balances.Ethereum.USDC, 6);

      if (swap.side === 'buy') {
        if (usdtBalance > 0) {
          ringBell(5);

          waitAfterBlockNumber = swap.execute_at;
          await setLimitOrder('Usdt', 'Usdc', 'Sell', USDT_SELL_PRICE, balances.Ethereum.USDT);
        } else {
          console.log('😢 No free balance (USDT) available to SELL');
        }
      } else if (swap.side === 'sell') {
        if (usdcBalance > 0) {
          ringBell(5);

          waitAfterBlockNumber = swap.execute_at;
          await setLimitOrder('Usdt', 'Usdc', 'Buy', USDT_BUY_PRICE, balances.Ethereum.USDC);
        } else {
          console.log('😢 No free balance (USDC) available to SELL');
        }
      } else {
        throw new Error('🚨 Unknown swap.side');
      }
    }

    await connectWs(strategySellStableCoinBasicWsListener);
  } else {
    throw new Error('🚨 The strategy defined as STRATEGY in the env file, is not valid');
  }
}

module.exports = {
  runStrategy,
};
