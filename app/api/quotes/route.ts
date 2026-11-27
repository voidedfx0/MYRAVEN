import { NextResponse } from "next/server";
import { buildDemoQuotes, type QuoteRequest } from "@/lib/payments/smart-route";

const currencies = ["USD", "EUR", "GBP", "NGN", "KES", "GHS"];
const destinations = ["solana", "bank"];
const preferences = ["balanced", "lowest-cost", "fastest", "most-reliable"];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<QuoteRequest>;
    if (
      typeof body.amount !== "number" ||
      !currencies.includes(String(body.sourceCurrency)) ||
      !currencies.includes(String(body.destinationCurrency)) ||
      !destinations.includes(String(body.destination)) ||
      !preferences.includes(String(body.preference))
    ) {
      return NextResponse.json({ error: "Invalid quote request." }, { status: 400 });
    }

    const quotes = buildDemoQuotes(body as QuoteRequest);
    return NextResponse.json({
      mode: "simulation",
      notice: "Illustrative estimates only. No live exchange rates, provider availability or payment execution.",
      quotes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to calculate quote.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
