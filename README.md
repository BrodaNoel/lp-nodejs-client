# LP NodeJS Client

A NodeJS client for handling LP

## Config

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

## Usage

- Run `nvm use` (to ensure you are using the correct NodeJS version)
- Run `npm start`
