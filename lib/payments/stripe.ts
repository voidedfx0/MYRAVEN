export function toStripeMinorUnits(amount: number, currency: string): number {
  const zeroDecimalCurrencies = new Set([
    "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG",
    "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
  ]);
  const threeDecimalCurrencies = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);
  const exponent = zeroDecimalCurrencies.has(currency.toUpperCase()) ? 0 : threeDecimalCurrencies.has(currency.toUpperCase()) ? 3 : 2;
  const value = Math.round(amount * (10 ** exponent));
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("The funding amount is outside the supported range.");
  }
  return value;
}

export function isStripeTestKey(value: string | undefined): value is string {
  return typeof value === "string" && value.startsWith("sk_test_");
}
