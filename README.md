# LP NodeJS Client

A NodeJS client for handling LP

## Installation / Configuration

- Clone this repo
- Add a `.env` file
- Inside the `.env` file, define a `OWNER_ADDRESS` (your ChainFlip Address, i.e.: `cFJxVfwc...`)
- Open https://polkadot.snap.chainsafe.io/
- Connect with your wallet
- Select the network: Polkadot
- Copy the Public Key, and add it inside the `.env` file, defined as `POLKADOT_PUBLIC_KEY`
- Export the Private Key, and add it inside the `.env` file, defined as `POLKADOT_SEED`
- [OPTIONAL] You can define an HTTP_RPC_URL in the `.env` file, otherwise `https://mainnet-rpc.chainflip.io` will be used
- Run `nvm use` (or make sure to use a compatible NodeJS version. Check the `.nvmrc` file)
- Run `npm i`

## Defining an Strategy

In order to define an Strategy to be executed by this bot, you have to add some new variables in your `.env` file.

The available strategies are the following.

> Consider creating an issue asking for new strategies, or creating a PR in case you want to code it yourself. In case you want to create a new issue, please make sure to explain in details how the strategy should works

**Considerations**: Every time you define a `PRICE` in an strategy, remember that this price will actually be transformed to `tick`, so, the buy/sell price will be the `pick` closest to your provided price.

### Strategy: SELL-STABLECOIN-BASIC

- The `SELL-STABLECOIN-BASIC` strategy is the most basic one.
- Pool: Only USDT/USDC
- This strategy just check if you have free balance on ETH:USDT or ETH:USDC, and sell it setting a limit-order.
- The price to SELL USDT (buy USDC) will be defined as `STRATEGY_USDT_SELL_PRICE`
- The price to BUY USDT (sell USDC) will be defined as `STRATEGY_USDT_BUY_PRICE`

```bash
## The strategy name
STRATEGY=SELL-STABLECOIN-BASIC
STRATEGY_USDT_SELL_PRICE=1
STRATEGY_USDT_BUY_PRICE=0.999
```

## Usage

- Run `nvm use` (to ensure you are using the correct NodeJS version)
- Run `npm start`
