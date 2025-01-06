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

function priceToTick(price, decimals_of_quote_asset, decimals_of_base_asset) {
  const quote = price * Math.pow(10, decimals_of_quote_asset - decimals_of_base_asset);
  const tick = Math.round(Math.log(quote) / Math.log(1.0001));
  return Math.min(Math.max(tick, -887272), 887272);
}

function sqrtPriceToPrice(hex_input, decimals_of_quote_asset, decimals_of_base_asset) {
  let raw_price = Math.pow(Number(BigInt(hex_input)) / 2 ** 96, 2);
  return raw_price * 10 ** (decimals_of_base_asset - decimals_of_quote_asset);
}

module.exports = {
  tickToPrice,
  priceToHexPrice,
  hexPriceToPrice,
  priceToSqrtPrice,
  hexQuantityToQuantity,
  priceToTick,
  sqrtPriceToPrice,
};
