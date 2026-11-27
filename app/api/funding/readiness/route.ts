import { NextResponse } from "next/server";
import { getFundingIntegrationStatus } from "@/lib/payments/providers/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getFundingIntegrationStatus();

  return NextResponse.json({
    mode: status.configured ? "provider_adapter_registered" : "integration_required",
    network: status.chain,
    settlementAssets: status.supportedAssets,
    fundingMethods: status.methods.map((method) => ({
      method,
      enabled: status.configured,
    })),
    message: status.message,
    realMoneyEnabled: false,
  });
}
