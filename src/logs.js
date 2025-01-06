const { tickToPrice, hexQuantityToQuantity } = require('./utils');

const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

const logIncorrectAddress = pair => {
  console.error('Incorrect generated ChaninFlip address');
  console.error(
    'The ChainFlip Address is generated from your Polkadot address, which seems to be incorrect'
  );
  console.error('Expected:', process.env.POLKADOT_ADDRESS);
  console.error('Generated:', pair.address);
  console.error('Check your POLKADOT_SEED');
};

const logIncorrectPublicKey = pair => {
  console.error('Incorrect generated public key');
  console.error('The Public Key is generated from your Polkadot seed, which seems to be incorrect');
  console.error('Expected:', process.env.POLKADOT_PUBLIC_KEY);
  console.error('Generated:', u8aToHex(pair.publicKey));
  console.error('Check your POLKADOT_SEED');
};

const logOrder = x =>
  console.log(`ID ${x.id}
TICK          ${YELLOW}${tickToPrice(x.tick, 6, 6)}${RESET}
SELL_PENDING  ${GREEN}${hexQuantityToQuantity(x.sell_amount, 6)}${RESET}
SELL_ORIGINAL ${GREEN}${hexQuantityToQuantity(x.original_sell_amount, 6)}${RESET}`);

const createError = dispatchErr => {
  if (!dispatchErr) return null;

  if (dispatchErr.isModule) {
    const { name, section, docs } = dispatchErr.registry.findMetaError(dispatchErr.asModule);

    const err = Error(`${section}.${name}:\n${docs.join(' ')}`, {
      cause: dispatchErr,
    });

    if (err.stack) err.stack = err.stack.split('\n').slice(0, 2).join('\n');

    return err;
  }

  return new Error(
    `The submitted extrinsic failed with an unexpected error: ${dispatchErr.toString()}`
  );
};

const wsCallback = async data => {
  console.log('status.type', data.status.type);

  const err = createError(data.dispatchError);
  if (err) {
    console.error(err);
  }

  return data;
};

module.exports = {
  logIncorrectAddress,
  logIncorrectPublicKey,
  logOrder,
  createError,
  wsCallback,
};
