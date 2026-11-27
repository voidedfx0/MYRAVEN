export type Currency = "USD" | "EUR" | "GBP" | "NGN" | "KES" | "GHS";
export type Rail = "solana" | "bank";
export type Preference = "balanced" | "lowest-cost" | "fastest" | "most-reliable";

export type QuoteRequest = {
  amount: number;
  sourceCurrency: Currency;
  destinationCurrency: Currency;
  destination: "solana" | "bank";
  preference: Preference;
};

export type RouteQuote = {
  id: string;
  rail: Rail;
  label: string;
  estimatedFee: number;
  estimatedMinutes: number;
  reliability: number;
  fxRate: number;
  recipientAmount: number;
  score: number;
  reasons: string[];
  simulated: true;
};

const usdRates: Record<Currency, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, NGN: 1550, KES: 129, GHS: 15.2,
};

const fees: Record<Rail, number> = { solana: 0.35, bank: 2.5 };
const speed: Record<Rail, number> = { solana: 1, bank: 45 };
const reliability: Record<Rail, number> = { solana: 97, bank: 94 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function buildDemoQuotes(input: QuoteRequest): RouteQuote[] {
  const { amount, sourceCurrency, destinationCurrency, destination, preference } = input;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    throw new Error("Enter an amount greater than zero and below 1,000,000.");
  }

  const usdValue = amount / usdRates[sourceCurrency];
  const fxRate = usdRates[destinationCurrency] / usdRates[sourceCurrency];
  const eligible: Rail[] =
    destination === "bank" ? ["bank", "solana"] : ["solana"];

  const weights = preference === "lowest-cost"
    ? { cost: 0.65, speed: 0.1, reliability: 0.15 }
    : preference === "fastest"
      ? { cost: 0.15, speed: 0.6, reliability: 0.15 }
      : preference === "most-reliable"
        ? { cost: 0.15, speed: 0.15, reliability: 0.6 }
        : { cost: 0.4, speed: 0.25, reliability: 0.25 };

  const quotes = eligible.map((rail) => {
    const feeUsd = fees[rail];
    const feeInSource = feeUsd * usdRates[sourceCurrency];
    const netSource = Math.max(0, amount - feeInSource);
    const estimatedFee = feeInSource;
    const recipientAmount = netSource * fxRate;
    const costScore = clamp(100 - (feeUsd / Math.max(usdValue, 1)) * 100, 0, 100);
    const speedScore = clamp(100 - speed[rail] * 1.8, 0, 100);
    const reliabilityScore = reliability[rail];
    const score = Math.round(
      costScore * weights.cost +
      speedScore * weights.speed +
      reliabilityScore * weights.reliability
    );
    const reasons = [
      rail === destination ? "Matches the requested receiving network" : "Alternative supported route",
      `${speed[rail]} min estimated processing window`,
      `${reliability[rail]}% illustrative reliability score`,
    ];
    return {
      id: rail,
      rail,
      label: rail === "solana" ? "Solana settlement route" : "Local bank payout",
      estimatedFee,
      estimatedMinutes: speed[rail],
      reliability: reliability[rail],
      fxRate,
      recipientAmount,
      score,
      reasons,
      simulated: true as const,
    };
  });

  return quotes.sort((a, b) => b.score - a.score);
}
