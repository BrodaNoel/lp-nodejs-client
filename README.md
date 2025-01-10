# LP NodeJS Client

A NodeJS client for handling LP

**IMPORTANT**: Currently, this bot is not a "daemon" (a process that never ends, and keep "listening"). You have to manually run it (`npm start`) every time you want it to be ran. In the near future I'll add a functionality to define how often you want your strategies to be ran, and the bot will be running them as a daemon.

## Installation / Configuration

- Clone this repo
- Add a `.env` file
- Inside the `.env` file, define a `OWNER_ADDRESS` (your ChainFlip Address, i.e.: `cFJxVfwc...`)
- Open https://polkadot.snap.chainsafe.io/
- Connect with your wallet
- Select the network: Polkadot
- Copy the Public Key, and add it inside the `.env` file, defined as `POLKADOT_PUBLIC_KEY`
- Export the Private Key, and add it inside the `.env` file, defined as `POLKADOT_SEED`
- [OPTIONAL] You can define an `HTTP_RPC_URL` in the `.env` file, otherwise `https://mainnet-rpc.chainflip.io` will be used
- [OPTIONAL] You can define an `WS_RPC_URL` in the `.env` file, otherwise `wss://mainnet-rpc.chainflip.io` will be used
- Run `nvm use` (or make sure to use a compatible NodeJS version. Check the `.nvmrc` file)
- Run `npm i`

**Extras**
Be careful with all these extra log configurations. The more you add, the slower the script will run. If you are running a "high frecuency trading" style (strategies being run every 10 seconds or less), I would suggest you to avoid adding these logs

- In your `.env` file, add `LOG_CURRENT_ORDERS=true` if you want to log in the console your current opened limit orders
- In your `.env` file, add `LOG_PRICES=true` if you want to log in the console the current prices of USDT/USDC (more coming soon)

## Defining an Strategy

In order to define an Strategy to be executed by this bot, you have to add some new variables in your `.env` file.

The available strategies are the following.

> Consider creating an issue asking for new strategies, or creating a PR in case you want to code it yourself. In case you want to create a new issue, please make sure to explain in details how the strategy should works

**Price Considerations**: Every time you define a `PRICE` in an strategy, remember that this price will actually be transformed to `tick`, so, the buy/sell price will be the `tick` closest to the price you defined.

**Strategy Methods**
It is important to pay attention to the Strategy method. It could be HTTP server, or WebSocket.

- WebSocket method: The bot will subscribe to a websocket method, and will be listening to this until you manually stop the bot. This is usually called "daemon" style.
- HTTP method: The bot will run a serie of HTTP call in order to run the strategy, and it will stop the bot as soon as it finishes (usually taking less than 5 seconds).

### Strategy: SELL-STABLECOIN-BASIC

- The `SELL-STABLECOIN-BASIC` strategy is the most basic one.
- Pool: Only ETH USDT/USDC
- Method: HTTP
- This strategy just check if you have free balance on ETH:USDT or ETH:USDC, and sell it setting a limit-order.
- The price to SELL USDT (buy USDC) will be defined as `STRATEGY_USDT_SELL_PRICE`
- The price to BUY USDT (sell USDC) will be defined as `STRATEGY_USDT_BUY_PRICE`

```bash
## Add this to your .env file
STRATEGY=SELL-STABLECOIN-BASIC
STRATEGY_USDT_SELL_PRICE=1
STRATEGY_USDT_BUY_PRICE=0.999
```

### Strategy: SELL-STABLECOIN-BASIC-WS

- Pool: Only ETH USDT/USDC
- Method: WebSocket
- The bot will be listening to `cf_subscribe_scheduled_swaps` events ("new swap coming" event), and it will run a similar strategy like `SELL-STABLECOIN-BASIC` strategy, as soon as it detects a upcoming swap. Basically, if a new SELL swap is coming, it will create a BUY limit-order in case that you have some free balance available. Same thing if a new BUY swap is coming (it will create a SELL limit-order with your free balance).
- Make sure to define the env vars required (`STRATEGY_USDT_SELL_PRICE` and `STRATEGY_USDT_BUY_PRICE`), in order to properly set the prices you want to set.

```bash
## Add this to your .env file
STRATEGY=SELL-STABLECOIN-BASIC-WS
STRATEGY_USDT_SELL_PRICE=1
STRATEGY_USDT_BUY_PRICE=0.999
```

## Usage

- Run `nvm use` (to ensure you are using the correct NodeJS version)
- Run `npm start`
