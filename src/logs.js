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

module.exports = {
  logIncorrectAddress,
};
