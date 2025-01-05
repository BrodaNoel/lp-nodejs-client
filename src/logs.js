const RED = '\x1b[31m';
const RESET = '\x1b[0m';

const logIncorrectAddress = pair => {
  console.log(
    RED,
    'The ChainFlip Address is generated from your Polkadot address, which seems to be incorrect',
    RESET
  );
  console.log(RED, 'Your Polkadot address:', process.env.POLKADOT_ADDRESS, RESET);
  console.log(
    RED,
    'Expected ChanFlip address generated from your Polkadot address:',
    process.env.OWNER_ADDRESS,
    RESET
  );
  console.log(RED, 'ChanFlip Address generated:', pair.address, RESET);
};

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

module.exports = {
  logIncorrectAddress,
  createError,
};
