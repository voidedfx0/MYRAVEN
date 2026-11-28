"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AuthActions from "@/components/auth-actions";
import fundingCountriesData from "../../src/data/funding-countries.json";
import {
  Activity, ArrowDownLeft, ArrowLeft, ArrowLeftRight, ArrowUpRight, Bell, Check, CreditCard, Landmark, Smartphone,
  ChevronDown, CircleHelp, Globe2, LayoutDashboard, LockKeyhole,
  Menu, Plus, RefreshCw,
  Settings2, ShieldCheck, Sparkles, Wallet, WalletCards, X,
} from "lucide-react";

type Quote = {
  id: string; rail: "solana" | "bank"; label: string;
  estimatedFee: number; estimatedMinutes: number; reliability: number;
  recipientAmount: number; score: number; reasons: string[]; simulated: true;
};
type WalletConnection = { network: "Solana"; address: string; name: string };
type DemoActivity = { id: string; title: string; detail: string; amount: string; status: string; time: string; createdAt?: string; category?: "Sent" | "Received" | "Fund" | "Pending" };
type RecipientProfile = { myravenId: string; accountNumber?: string; displayName: string | null; countryCode: string | null; solanaAddress?: string | null; walletStatus?: string | null };
type PayoutBank = { id: string; code: string; name: string };
type FundingDeposit = {
  id: string; funding_method: string; input_kind: string; input_currency: string;
  input_amount: number | string; target_asset: string; credited_output_amount: number | string | null;
  status: string; failure_code: string | null; provider_code: string | null; provider_reference: string | null;
  created_at: string; updated_at: string;
  metadata?: {
    payment_state?: string; environment?: string;
    treasury_settlement?: {
      transfer_status?: string; sol_amount?: number | string; action_id?: string;
      blockchain_signature?: string; wallet_credited?: boolean; completed_at?: string;
    };
    settlement_diagnostics?: { stage?: string; last_error?: string; occurred_at?: string };
  } | null;
};

declare global {
  interface Window {
    solana?: { isPhantom?: boolean; connect: () => Promise<{ publicKey: { toString: () => string } }>; disconnect?: () => Promise<void> };
  }
}

const SCHEDULED_SEND_KEY = "myraven:scheduled-send";

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

const currencyAliases: Record<string, string> = {
  dollar: "USD", dollars: "USD", usd: "USD", euro: "EUR", euros: "EUR", eur: "EUR",
  pound: "GBP", pounds: "GBP", gbp: "GBP", naira: "NGN", ngn: "NGN",
  shilling: "KES", shillings: "KES", kes: "KES", cedi: "GHS", cedis: "GHS", ghs: "GHS",
  franc: "CHF", francs: "CHF", chf: "CHF",
};

function interpretPayAiRequest(prompt: string) {
  const amountMatch = prompt.match(/(?:^|\s)(?:send\s+)?([0-9]+(?:[.,][0-9]{1,2})?)/i);
  const amount = amountMatch ? Number(amountMatch[1].replace(",", ".")) : null;
  const normalized = prompt.toLowerCase();
  const currencyMatch = normalized.match(/\b(usd|eur|gbp|ngn|kes|ghs|chf|dollars?|euros?|pounds?|naira|shillings?|cedis?|francs?)\b/);
  const currency = currencyMatch ? currencyAliases[currencyMatch[1]] : null;
  const recipientMatch = prompt.match(/\bto\s+(.+?)(?:\s+(?:in|who|with|using|via|should|gets)\b|[,.]|$)/i);
  const recipient = recipientMatch?.[1]?.trim() ?? "";
  const destinationCurrency = /\b(naira|ngn)\b/i.test(prompt) ? "NGN"
    : /\b(dollars?|usd)\b/i.test(prompt) ? "USD"
    : /\b(euros?|eur)\b/i.test(prompt) ? "EUR"
    : /\b(pounds?|gbp)\b/i.test(prompt) ? "GBP"
    : /\b(kes|shillings?)\b/i.test(prompt) ? "KES"
    : /\b(ghs|cedis?)\b/i.test(prompt) ? "GHS" : null;
  const destination = /\b(wallet|solana|address)\b/i.test(prompt) ? "solana" : "bank";
  return { amount, currency, destinationCurrency, destination, recipient };
}

function shortAddress(address: string) {
  return address.length > 16 ? address.slice(0, 7) + "…" + address.slice(-6) : address;
}

export default function Home() {
  const [amount, setAmount] = useState("0.001");
  const [amountEntryMode, setAmountEntryMode] = useState<"SOL" | "LOCAL">("SOL");
  const [sourceCurrency, setSourceCurrency] = useState("USD");
  const [destinationCurrency, setDestinationCurrency] = useState("NGN");
  const [destination, setDestination] = useState("bank");
  const [preference, setPreference] = useState("balanced");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [notice, setNotice] = useState("Choose your payment details to compare routes.");
  const [loading, setLoading] = useState(false);
  const [wallets, setWallets] = useState<WalletConnection[]>([]);
  const [myravenWallet, setMyravenWallet] = useState<{address:string;status:string;network:string}|null>(null);
  const [myravenWalletLoading, setMyravenWalletLoading] = useState(true);
  const [myravenWalletError, setMyravenWalletError] = useState("");
  const [availableSol, setAvailableSol] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState(false);
  const [preferredCurrency, setPreferredCurrency] = useState("USD");
  const [solPriceLocal, setSolPriceLocal] = useState<number | null>(null);
  const [solPriceUsd, setSolPriceUsd] = useState<number | null>(null);
  const [solPriceUpdatedAt, setSolPriceUpdatedAt] = useState<string | null>(null);
  const [externalSolBalance, setExternalSolBalance] = useState<number | null>(null);
  const [externalBalanceLoading, setExternalBalanceLoading] = useState(false);
  const [externalBalanceError, setExternalBalanceError] = useState("");
  const [fundingCountry, setFundingCountry] = useState("NG");
  const [fundingCurrency, setFundingCurrency] = useState("NGN");
  const [fundingMethod, setFundingMethod] = useState("card");
  const [fundingAmount, setFundingAmount] = useState("100");
  const [fundingTargetAsset, setFundingTargetAsset] = useState("SOL");
  const [fundingCheckoutLoading, setFundingCheckoutLoading] = useState(false);
  const [fundingMessage, setFundingMessage] = useState("");
  const [fundingHistory, setFundingHistory] = useState<FundingDeposit[]>([]);
  const [fundingHistoryLoading, setFundingHistoryLoading] = useState(false);
  const [fundingHistoryMessage, setFundingHistoryMessage] = useState("");
  const fundingHistoryInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    async function loadWalletBalance() {
      try {
        const [summaryResponse, balanceResponse] = await Promise.all([
          fetch("/api/account/summary", { cache: "no-store" }),
          fetch("/api/account/wallet/balance", { cache: "no-store" }),
        ]);
        if (summaryResponse.ok) {
          const summary = await summaryResponse.json();
          const countryCode = String(summary.profile?.country_code ?? "").toUpperCase();
          const profileCountry = fundingCountriesData.countries.find((country) => country.code === countryCode);
          const profileCurrency = profileCountry?.currency?.[0];
          if (active && profileCurrency && /^[A-Z]{3}$/.test(profileCurrency)) setPreferredCurrency(profileCurrency);
        }
        const balance = await balanceResponse.json();
        if (!balanceResponse.ok || !Number.isFinite(Number(balance.availableSol))) {
          throw new Error(balance.error ?? "Live wallet balance unavailable");
        }
        if (active) {
          setAvailableSol(Number(balance.availableSol));
          setBalanceError(false);
        }
      } catch {
        if (active) { setAvailableSol(null); setBalanceError(true); }
      } finally {
        if (active) setBalanceLoading(false);
      }
    }
    void loadWalletBalance();
    const interval = window.setInterval(loadWalletBalance, 20_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);


  useEffect(() => {
    let active = true;
    async function loadMyravenWallet() {
      try {
        const response = await fetch("/api/account/wallet", { method: "POST", cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Your MYRAVEN wallet is not available yet.");
        if (active) setMyravenWallet({ address: data.address, status: data.status, network: data.network });
      } catch (issue) {
        if (active) setMyravenWalletError(issue instanceof Error ? issue.message : "Could not load your MYRAVEN wallet.");
      } finally {
        if (active) setMyravenWalletLoading(false);
      }
    }
    void loadMyravenWallet();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadSolPrice() {
      try {
        const response = await fetch("/api/market/sol-price?currency=" + encodeURIComponent(preferredCurrency), { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !Number.isFinite(Number(data.price))) throw new Error("Price unavailable");
        if (active) {
          setSolPriceLocal(Number(data.price));
          setSolPriceUpdatedAt(data.updatedAt ?? null);
        }
      } catch {
        if (active) { setSolPriceLocal(null); setSolPriceUpdatedAt(null); }
      }
    }
    void loadSolPrice();
    const interval = window.setInterval(loadSolPrice, 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [preferredCurrency]);

  useEffect(() => {
    let active = true;
    async function loadUsdSolPrice() {
      try {
        const response = await fetch("/api/market/sol-price?currency=USD", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !Number.isFinite(Number(data.price)) || Number(data.price) <= 0) throw new Error("USD price unavailable");
        if (active) setSolPriceUsd(Number(data.price));
      } catch {
        if (active) setSolPriceUsd(null);
      }
    }
    void loadUsdSolPrice();
    const interval = window.setInterval(loadUsdSolPrice, 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const [walletMessage, setWalletMessage] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [recentActivity, setRecentActivity] = useState<DemoActivity[]>([]);
  const [selectedRoute, setSelectedRoute] = useState("");
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approved, setApproved] = useState(false);
  const [transferSending, setTransferSending] = useState(false);
  const [transferMessage, setTransferMessage] = useState("");
  const [transferRequestId, setTransferRequestId] = useState("");
  const [sendWindowSeconds, setSendWindowSeconds] = useState(0);
  const [sendWindowActive, setSendWindowActive] = useState(false);
  const [toast, setToast] = useState<{title:string;message:string;kind:"info"|"success"|"warning"}|null>(null);
  const [payAiOpen, setPayAiOpen] = useState(false);
  const [payAiPrompt, setPayAiPrompt] = useState("");
  const [payAiMessage, setPayAiMessage] = useState("");
  const [recipientReference, setRecipientReference] = useState("");
  const [recipientType, setRecipientType] = useState("myraven");
  const [recipientCountry, setRecipientCountry] = useState("NG");
  const [recipientBank, setRecipientBank] = useState("");
  const [recipientBanks, setRecipientBanks] = useState<PayoutBank[]>([]);
  const [recipientBanksLoading, setRecipientBanksLoading] = useState(false);
  const [recipientBanksMessage, setRecipientBanksMessage] = useState("");
  const [recipientBankAccount, setRecipientBankAccount] = useState("");
  const [recipientProfile, setRecipientProfile] = useState<RecipientProfile | null>(null);
  const [recipientLookupStatus, setRecipientLookupStatus] = useState("");
  const [recipientLookupLoading, setRecipientLookupLoading] = useState(false);
  const [activities, setActivities] = useState<DemoActivity[]>([]);
  const [activityFilter, setActivityFilter] = useState<"Sent" | "Received" | "Fund" | "Pending">("Pending");
  const [ussdPhone, setUssdPhone] = useState("");
  const [ussdAmount, setUssdAmount] = useState("25");
  const [ussdResult, setUssdResult] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/account/summary", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => { if (active) setDisplayName(String(data?.profile?.display_name ?? "").trim()); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (recipientType !== "local-bank") return;
    let active = true;
    setRecipientBanks([]);
    setRecipientBank("");
    setRecipientBanksLoading(true);
    setRecipientBanksMessage("Loading banks for the selected country…");
    fetch("/api/payout/banks?country=" + encodeURIComponent(recipientCountry), { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Bank list could not be loaded.");
        if (!active) return;
        const banks: PayoutBank[] = Array.isArray(data.banks) ? data.banks : [];
        setRecipientBanks(banks);
        setRecipientBanksMessage(String(data.message ?? (banks.length ? "Choose a bank." : "No bank directory available.")));
      })
      .catch((error) => {
        if (active) setRecipientBanksMessage(error instanceof Error ? error.message : "Bank list could not be loaded.");
      })
      .finally(() => { if (active) setRecipientBanksLoading(false); });
    return () => { active = false; };
  }, [recipientType, recipientCountry]);

  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get("section") || "overview";
    setActiveSection(["overview","payments","wallets","funding","ussd"].includes(section) ? section : "overview");
  }, []);

  useEffect(() => {
    let active = true;
    async function loadRecentActivity() {
      try {
        const response = await fetch("/api/activity/recent", { cache: "no-store" });
        const data = await response.json();
        if (active && response.ok && Array.isArray(data.activities)) setRecentActivity(data.activities);
      } catch { /* Overview remains usable when activity is temporarily unavailable. */ }
    }
    void loadRecentActivity();
    const interval = window.setInterval(loadRecentActivity, 20000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SCHEDULED_SEND_KEY);
      if (!raw) return;
      const scheduled = JSON.parse(raw) as { requestId:string; amount:string; recipientProfile:RecipientProfile; recipientReference:string; recipientType:string; expiresAt:number };
      if (!scheduled?.requestId || !scheduled.recipientProfile || !Number.isFinite(scheduled.expiresAt)) { window.localStorage.removeItem(SCHEDULED_SEND_KEY); return; }
      setTransferRequestId(scheduled.requestId); setAmount(scheduled.amount); setRecipientProfile(scheduled.recipientProfile);
      setRecipientReference(scheduled.recipientReference); setRecipientType(scheduled.recipientType);
      setSendWindowSeconds(Math.max(0, Math.ceil((scheduled.expiresAt - Date.now()) / 1000))); setSendWindowActive(true);
    } catch { window.localStorage.removeItem(SCHEDULED_SEND_KEY); }
  }, []);
  const bestQuote = useMemo(() => quotes.find((quote) => quote.id === selectedRoute) ?? quotes[0], [quotes, selectedRoute]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qrRecipient = params.get("to") || params.get("recipient");
    if (qrRecipient) {
      setRecipientType(/^\\d{10}$/.test(qrRecipient) ? "account" : "myraven");
      setRecipientReference(qrRecipient);
      setDestination("solana");
      setNotice("MYRAVEN recipient details imported from QR. Verify the recipient before continuing.");
    }
  }, []);

  async function loadFundingHistory() {
    if (fundingHistoryInFlight.current) return;
    fundingHistoryInFlight.current = true;
    setFundingHistoryLoading(true);
    try {
      const response = await fetch("/api/funding/deposits", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Funding history could not be loaded.");
      const deposits: FundingDeposit[] = Array.isArray(data.deposits) ? data.deposits : [];
      setFundingHistory(deposits);
      // Main dashboard handles verification and the clearly labelled test conversion.
      const needsVerification = deposits.filter((deposit) =>
        ["awaiting_payment", "converting"].includes(deposit.status)
        && deposit.provider_reference
        && deposit.metadata?.payment_state !== "successful"
        && /^MRV-FUND-[0-9a-f-]{36}$/i.test(deposit.provider_reference)
      );
      if (needsVerification.length) {
        await Promise.all(needsVerification.map((deposit) =>
          fetch("/api/funding/reconcile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tx_ref: deposit.provider_reference }),
          }).catch(() => null)
        ));
      }
      const refreshed = await fetch("/api/funding/deposits", { cache: "no-store" });
      const refreshedData = await refreshed.json();
      const latest = refreshed.ok && Array.isArray(refreshedData.deposits) ? refreshedData.deposits : deposits;

      // Verified test payments settle from the central Devnet treasury into the user's Privy wallet.
      const readyForSettlement: FundingDeposit[] = latest.filter((deposit: FundingDeposit) =>
        deposit.status === "converting"
        && deposit.metadata?.payment_state === "successful"
        && deposit.metadata?.environment === "test"
        && deposit.target_asset === "SOL"
        && deposit.metadata?.treasury_settlement?.transfer_status !== "confirmed"
      );
      // A single treasury wallet must process transfers sequentially. Parallel
      // Privy actions can race for the same treasury wallet and leave deposits pending.
      const settlementErrors: string[] = [];
      for (const deposit of readyForSettlement) {
        try {
          const settlementResponse = await fetch("/api/funding/settle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deposit_id: deposit.id }),
          });
          const settlementResult = await settlementResponse.json().catch(() => ({}));
          if (settlementResponse.status === 202) {
            // Keep the shared treasury serial: finish this transfer before starting another.
            break;
          }
          if (!settlementResponse.ok) {
            settlementErrors.push(String(settlementResult.error ?? "SOL settlement could not be completed."));
            break;
          }
        } catch {
          settlementErrors.push("Could not reach the SOL settlement service. It will retry automatically.");
          break;
        }
      }
      const finalResponse = await fetch("/api/funding/deposits", { cache: "no-store" });
      const finalData = await finalResponse.json();
      if (finalResponse.ok && Array.isArray(finalData.deposits)) {
        setFundingHistory(finalData.deposits);
        const diagnostic = (finalData.deposits as FundingDeposit[]).find((item) => item.metadata?.settlement_diagnostics?.last_error)?.metadata?.settlement_diagnostics;
        if (settlementErrors.length) setFundingHistoryMessage(settlementErrors[0]);
        else if (diagnostic?.last_error) setFundingHistoryMessage("Settlement " + (diagnostic.stage ?? "error") + ": " + diagnostic.last_error);
        else if ((finalData.deposits as FundingDeposit[]).some((item) => item.status === "credited")) setFundingHistoryMessage("");
      } else if (settlementErrors.length) setFundingHistoryMessage(settlementErrors[0]);
    } catch (error) {
      setFundingHistoryMessage(error instanceof Error ? error.message : "Funding history is unavailable.");
    } finally {
      fundingHistoryInFlight.current = false;
      setFundingHistoryLoading(false);
    }
  }

  useEffect(() => {
    void loadFundingHistory();
    const fundingRefresh = window.setInterval(() => { void loadFundingHistory(); }, 12000);

    // Flutterwave returns status, tx_ref and transaction_id after checkout.
    // Never trust the browser status: reconcile the reference server-side.
    const params = new URLSearchParams(window.location.search);
    const returnedStatus = params.get("status");
    const txRef = params.get("tx_ref");
    if (returnedStatus === "successful" && txRef) {
      void fetch("/api/funding/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tx_ref: txRef }),
      }).then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Payment verification is still processing.");
        await loadFundingHistory();
        if (result.paymentStatus === "successful") {
          setFundingMessage("Payment successful. Your " + (result.conversionStatus ?? "crypto conversion") + " is awaiting settlement.");
        }
      }).catch(() => {
        setFundingMessage("Payment return received. Verification is still processing; refresh your funding activity shortly.");
      });
    }
    return () => window.clearInterval(fundingRefresh);
  }, []);

  async function startFundingCheckout() {
    const country = fundingCountriesData.countries.find((item) => item.code === fundingCountry);
    const currency = fundingCurrency;
    const amountValue = Number(fundingAmount);
    if (!country || !currency || !Number.isFinite(amountValue) || amountValue <= 0) {
      setFundingMessage("Choose a country and enter a valid funding amount.");
      return;
    }
        const method = "card";
    setFundingCheckoutLoading(true);
    setFundingMessage("Creating a secure hosted checkout…");
    try {
      const response = await fetch("/api/funding/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountValue,
          countryCode: fundingCountry,
          currency,
          method,
          targetAsset: fundingTargetAsset,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Funding checkout could not be started.");
      setFundingMessage("Opening Flutterwave secure checkout…");
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setFundingMessage(error instanceof Error ? error.message : "Funding checkout is unavailable.");
    } finally {
      setFundingCheckoutLoading(false);
    }
  }

  async function calculateRoutes(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (recipientType === "local-bank") {
      setNotice(recipientBank
        ? "Bank selected. Account details and payout execution are not part of this stage yet."
        : "Choose a country and a bank to complete this bank-selection stage.");
      return;
    }
    const solAmount = Number(amount);
    if (!Number.isFinite(solAmount) || solAmount <= 0) { setNotice("Enter a valid SOL amount."); return; }
    if (availableSol === null) { setNotice("Your live Devnet SOL balance is still unavailable. Refresh and try again."); return; }
    if (solAmount + 0.00001 > availableSol) { setNotice("Insufficient SOL. Keep 0.00001 SOL available for network fees."); return; }
    if (!recipientProfile || !["myraven", "account"].includes(recipientType)) {
      setNotice("Verify the MYRAVEN recipient first, then review your transfer.");
      return;
    }
    setQuotes([]);
    setSelectedRoute("myraven-devnet");
    setApproved(false);
    setTransferMessage("");
    setNotice("Recipient verified. Review the amount and recipient before sending.");
    setApprovalOpen(true);
  }

  async function connectSolana() {
    try {
      if (!window.solana?.isPhantom) {
        setWalletMessage("Phantom wallet was not detected. You can still explore MYRAVEN; provider-based deposits are not connected yet.");
        return;
      }
      const response = await window.solana.connect();
      const address = response.publicKey.toString();
      setWallets([{ network: "Solana", address, name: "Connected Solana wallet" }]);
      setExternalSolBalance(null);
      setExternalBalanceError("");
      setExternalBalanceLoading(true);
      setWalletMessage("Solana wallet connected in read-only mode. Checking its Devnet SOL balance. Make sure Phantom is set to Devnet…");
      try {
        const balanceResponse = await fetch("/api/wallets/solana/balance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) });
        const balanceData = await balanceResponse.json();
        if (!balanceResponse.ok) throw new Error(balanceData.error ?? "Balance unavailable.");
        setExternalSolBalance(Number(balanceData.sol));
        setWalletMessage("Public Devnet SOL balance loaded. MYRAVEN has not requested transaction permissions.");
      } catch (error) {
        setExternalBalanceError(error instanceof Error ? error.message : "Could not load public balance.");
        setWalletMessage("Wallet connected, but its public balance could not be loaded.");
      } finally {
        setExternalBalanceLoading(false);
      }
    } catch {
      setWalletMessage("Wallet connection was cancelled or unavailable.");
    }
  }

  async function verifyRecipient() {
    const reference = recipientReference.trim();
    setRecipientProfile(null);
    setRecipientLookupStatus("");
    if (!reference) {
      setRecipientLookupStatus("Enter a recipient identifier first.");
      return;
    }

    if (recipientType === "local-bank") {
      setRecipientLookupStatus("Bank directory and account-name verification require a connected payout provider. No bank has been selected or verified yet.");
      return;
    }

    if (recipientType === "myraven" || recipientType === "account") {
      setRecipientLookupLoading(true);
      try {
        const response = await fetch("/api/recipients/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ myravenId: reference }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Recipient lookup failed.");
        setRecipientProfile(data.recipient);
        setRecipientLookupStatus("MYRAVEN profile matched. Check the displayed name and ID before continuing.");
      } catch (error) {
        setRecipientLookupStatus(error instanceof Error ? error.message : "Recipient lookup failed.");
      } finally {
        setRecipientLookupLoading(false);
      }
      return;
    }

    if (recipientType === "solana") {
      const base58Address = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(reference);
      setRecipientLookupStatus(base58Address
        ? "Address format looks valid, but the wallet owner is unverified. Confirm the full address independently."
        : "That does not look like a valid Solana address. Check the full address and try again.");
      return;
    }

    setRecipientLookupStatus("MYRAVEN account-number lookup is not connected yet. Use a MYRAVEN ID for profile matching.");
  }

  function beginSendCountdown() {
    if (!recipientProfile || !["myraven", "account"].includes(recipientType)) {
      setTransferMessage("Verify a MYRAVEN recipient before sending.");
      return;
    }
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || availableSol === null || Number(amount) + 0.00001 > availableSol) {
      setTransferMessage("Insufficient available Devnet SOL or balance unavailable.");
      return;
    }
    const requestId = crypto.randomUUID();
    setTransferRequestId(requestId);
    window.localStorage.setItem(SCHEDULED_SEND_KEY, JSON.stringify({ requestId, amount, recipientProfile, recipientReference, recipientType, expiresAt: Date.now() + 60000 }));
    setSendWindowSeconds(60);
    setSendWindowActive(true);
    setActivities((current) => [{
      id: "scheduled-" + requestId,
      title: "Transfer pending",
      detail: recipientProfile.displayName || recipientReference,
      amount: "-" + String(amount) + " SOL",
      status: "Cancels in 01:00",
      category: "Pending",
      time: "Just now",
    }, ...current]);
    setApprovalOpen(false);
    setTransferMessage("Transfer scheduled. Cancel it from Activity within 60 seconds.");
    setToast({ title: "Your transfer is on standby", message: "60 seconds to cancel · then sending starts automatically.", kind: "info" });
  }

  function cancelScheduledSend() {
    if (!sendWindowActive || !transferRequestId) return;
    const scheduledId = "scheduled-" + transferRequestId;
    setSendWindowActive(false);
    setSendWindowSeconds(0);
    window.localStorage.removeItem(SCHEDULED_SEND_KEY);
    setActivities((current) => current.map((item) => item.id === scheduledId ? { ...item, title: "Transfer cancelled", status: "Cancelled · Not sent" } : item));
    setTransferRequestId("");
    setTransferMessage("Transfer cancelled. No SOL was sent.");
    setToast({ title: "Transfer cancelled", message: "Nothing was sent. Your SOL remains in your wallet.", kind: "warning" });
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!sendWindowActive) return;
    if (sendWindowSeconds <= 0) {
      if (balanceLoading) return;
      if (availableSol === null) {
        window.localStorage.removeItem(SCHEDULED_SEND_KEY);
        setSendWindowActive(false);
        setTransferMessage("Wallet balance could not be verified. No SOL was sent.");
        setToast({ title: "Transfer paused", message: "Your wallet balance could not be verified, so nothing was sent.", kind: "warning" });
        return;
      }
      window.localStorage.removeItem(SCHEDULED_SEND_KEY);
      setSendWindowActive(false);
      setActivities((current) => current.filter((item) => item.id !== "scheduled-" + transferRequestId));
      void confirmDemoPayment();
      return;
    }
    setActivities((current) => current.map((item) => item.id === "scheduled-" + transferRequestId
      ? { ...item, status: "Cancels in " + String(Math.floor(sendWindowSeconds / 60)).padStart(2, "0") + ":" + String(sendWindowSeconds % 60).padStart(2, "0") }
      : item));
    const timer = window.setTimeout(() => setSendWindowSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [sendWindowActive, sendWindowSeconds, transferRequestId, balanceLoading, availableSol]);

  async function confirmDemoPayment() {
    if (!recipientProfile || !["myraven", "account"].includes(recipientType)) {
      setTransferMessage("Verify a MYRAVEN recipient before sending.");
      return;
    }
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || availableSol === null || Number(amount) + 0.00001 > availableSol) {
      setTransferMessage("Insufficient available Devnet SOL or balance unavailable.");
      return;
    }
    const requestId = transferRequestId || crypto.randomUUID();
    setTransferRequestId(requestId);
    setTransferSending(true);
    setTransferMessage("Submitting your signed Devnet transfer…");
    setToast({ title: "Transfer initiated", message: "Your SOL transfer has been submitted to Solana Devnet.", kind: "info" });
    try {
      const response = await fetch("/api/transfers/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: recipientReference, amount: String(amount), idempotencyKey: requestId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "SOL transfer could not be submitted.");
      setTransferMessage("Transfer submitted · waiting for Solana Devnet confirmation…");
      setActivities((current) => [{
        id: String(data.actionId),
        title: "Sent",
        detail: recipientProfile.displayName || recipientReference,
        amount: "-" + String(amount) + " SOL",
        status: "Pending",
        category: "Pending",
        time: "Just now",
      }, ...current]);
      setApproved(true);
      setApprovalOpen(false);
      setTransferRequestId("");
      let finalStatus = String(data.status || "pending").toLowerCase();
      for (let attempt = 0; attempt < 8 && !["succeeded", "failed", "cancelled", "reverted"].includes(finalStatus); attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const statusResponse = await fetch("/api/transfers/status?actionId=" + encodeURIComponent(String(data.actionId)), { cache: "no-store" });
        const statusData = await statusResponse.json();
        if (!statusResponse.ok) continue;
        finalStatus = String(statusData.status || "pending").toLowerCase();
      }
      if (finalStatus === "succeeded") {
        setTransferMessage("Transfer confirmed on Solana Devnet. Action " + String(data.actionId) + ".");
        setToast({ title: "Transfer successful", message: "Solana Devnet confirmed your payment.", kind: "success" });
        setActivities((current) => current.map((item) => item.id === String(data.actionId) ? { ...item, status: "Sent", category: "Sent" } : item));
        const balanceResponse = await fetch("/api/account/wallet/balance", { cache: "no-store" });
        const balanceData = await balanceResponse.json();
        if (balanceResponse.ok && Number.isFinite(Number(balanceData.availableSol))) setAvailableSol(Number(balanceData.availableSol));
      } else if (["failed", "cancelled", "reverted"].includes(finalStatus)) {
        setTransferMessage("Privy reports the transfer " + finalStatus + ". Check the action details before retrying.");
        setActivities((current) => current.map((item) => item.id === String(data.actionId) ? { ...item, status: "Failed" } : item));
      } else {
        setTransferMessage("Transfer is still processing on Devnet. Action " + String(data.actionId) + ". Do not submit it again yet.");
      }
    } catch (error) {
      setTransferMessage(error instanceof Error ? error.message : "Transfer failed. No success was recorded.");
      setToast({ title: "Transfer needs attention", message: error instanceof Error ? error.message : "No success was recorded.", kind: "warning" });
    } finally {
      setTransferSending(false);
    }
  }

  function simulateUssd() {
    if (!/^\+?[0-9]{7,15}$/.test(ussdPhone.replace(/[\s-]/g, ""))) {
      setUssdResult("Enter a valid demo phone number (7–15 digits).");
      return;
    }
    const parsedAmount = Number(ussdAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setUssdResult("Enter a valid amount.");
      return;
    }
    setUssdResult("Demo USSD request created for " + ussdPhone + ". No telecom, bank or wallet was contacted.");
    setActivities((current) => [{
      id: "MRV-USSD-" + String(current.length + 1).padStart(4, "0"),
      title: "USSD send simulation",
      detail: "Recipient " + shortAddress(ussdPhone),
      amount: "-" + money(parsedAmount, "USD"),
      status: "Simulated · Awaiting demo confirmation",
      time: "Just now",
    }, ...current]);
  }

  function disconnectWallet(address: string) {
    setWallets((current) => current.filter((wallet) => wallet.address !== address));
    setExternalSolBalance(null);
    setExternalBalanceError("");
    setWalletMessage("Wallet disconnected from this session.");
  }

  const nav = [
    { label: "Overview", icon: LayoutDashboard, href: "/dashboard", key: "overview" },
    { label: "Payments", icon: ArrowLeftRight, href: "/dashboard?section=payments", key: "payments" },
    { label: "Wallets", icon: Wallet, href: "/dashboard?section=wallets", key: "wallets" },
    { label: "Funding", icon: WalletCards, href: "/dashboard?section=funding", key: "funding" },
    { label: "Activity", icon: Activity, href: "/dashboard/activity", key: "activity" },
    { label: "Notifications", icon: Bell, href: "/notifications", key: "notifications" },
    { label: "Account details", icon: Wallet, href: "/dashboard/account-details", key: "account" },
    { label: "Settings", icon: Settings2, href: "/settings", key: "settings" },
    { label: "USSD preview", icon: Smartphone, href: "/dashboard?section=ussd", key: "ussd" },
  ];

  return (
    <main className="app-frame">
      {toast ? <div className={`mrv-toast mrv-toast-${toast.kind}`} role="status" aria-live="polite"><span className="mrv-toast-bot" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M20 5V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="20" cy="4" r="2" fill="#67E8F9"/><rect x="6" y="10" width="28" height="23" rx="9" fill="url(#mrvBot)" stroke="currentColor" strokeWidth="1.4"/><defs><linearGradient id="mrvBot" x1="6" y1="10" x2="34" y2="33"><stop stopColor="#8B5CF6"/><stop offset="1" stopColor="#25243D"/></linearGradient></defs><circle cx="15" cy="21" r="2.4" fill="#A5F3FC"/><circle cx="25" cy="21" r="2.4" fill="#A5F3FC"/><path d="M15 27Q20 31 25 27" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg><i /></span><span className="mrv-toast-copy"><b>Hey there! 👋</b><small key={toast.title + toast.message} className="mrv-toast-type">{toast.message}</small></span><button type="button" className="mrv-toast-close" onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={15} /></button><span className="mrv-toast-progress" /></div> : null}
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <a className="brand" href="#" aria-label="MYRAVEN home">
          <span className="brand-orbit-lockup">
            <svg className="brand-orbit-art" viewBox="0 0 240 72" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="word-orbit-metal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#F4F1FF"/><stop offset=".42" stopColor="#B8A5FF"/><stop offset=".72" stopColor="#67E8F9"/><stop offset="1" stopColor="#E7EAF4"/></linearGradient>
                <linearGradient id="word-orbit-violet" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#7C3AED"/><stop offset=".52" stopColor="#C4B5FD"/><stop offset="1" stopColor="#E9D5FF"/></linearGradient>
                <linearGradient id="word-orbit-cyan" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#67E8F9"/><stop offset="1" stopColor="#A5F3FC"/></linearGradient>
                <radialGradient id="orbit-planet-violet"><stop stopColor="#FFF"/><stop offset=".35" stopColor="#D8C8FF"/><stop offset="1" stopColor="#8057E8"/></radialGradient>
                <radialGradient id="orbit-planet-cyan"><stop stopColor="#FFF"/><stop offset=".38" stopColor="#A5F3FC"/><stop offset="1" stopColor="#159DB8"/></radialGradient>
              </defs>
              <g className="orbit-plane orbit-plane-back" fill="none" strokeLinecap="round">
                <ellipse cx="120" cy="36" rx="105" ry="25" stroke="url(#word-orbit-violet)" strokeWidth="1.25" opacity=".72"/>
                <circle r="3.1" fill="url(#orbit-planet-violet)" stroke="#E9D5FF" strokeWidth=".55">
                  <animateMotion dur="13s" repeatCount="indefinite" path="M15 36 A105 25 0 1 1 225 36 A105 25 0 1 1 15 36"/>
                </circle>
              </g>
              <g className="orbit-plane orbit-plane-mid" fill="none" strokeLinecap="round">
                <ellipse cx="120" cy="36" rx="99" ry="18" stroke="url(#word-orbit-metal)" strokeWidth="1.45" opacity=".85"/>
                <circle r="2.7" fill="url(#orbit-planet-cyan)" stroke="#CFFAFE" strokeWidth=".5">
                  <animateMotion dur="9s" repeatCount="indefinite" path="M21 36 A99 18 0 1 0 219 36 A99 18 0 1 0 21 36"/>
                </circle>
              </g>
              <g className="orbit-plane orbit-plane-front" fill="none" strokeLinecap="round">
                <ellipse cx="120" cy="36" rx="108" ry="13" stroke="url(#word-orbit-cyan)" strokeWidth="1.15" opacity=".8"/>
                <circle r="2.4" fill="url(#orbit-planet-violet)" stroke="#E9D5FF" strokeWidth=".45">
                  <animateMotion dur="17s" repeatCount="indefinite" path="M12 36 A108 13 0 1 1 228 36 A108 13 0 1 1 12 36"/>
                </circle>
              </g>
            </svg>
            <span className="brand-wordmark">MYRAVEN</span>
            <svg className="brand-orbit-front" viewBox="0 0 240 72" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="orbit-word-crossing" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#8B5CF6" stopOpacity="0"/><stop offset=".48" stopColor="#D8CCFF"/><stop offset=".72" stopColor="#67E8F9"/><stop offset="1" stopColor="#67E8F9" stopOpacity="0"/></linearGradient>
                <radialGradient id="orbit-word-planet"><stop stopColor="#FFFFFF"/><stop offset=".4" stopColor="#C4B5FD"/><stop offset="1" stopColor="#7C3AED"/></radialGradient>
              </defs>
              <ellipse cx="120" cy="36" rx="91" ry="9" fill="none" stroke="url(#orbit-word-crossing)" strokeWidth="1.05" opacity=".9"/>
              <circle r="3.2" fill="url(#orbit-word-planet)" stroke="#E9D5FF" strokeWidth=".55">
                <animateMotion dur="7.5s" repeatCount="indefinite" path="M29 36 A91 9 0 1 1 211 36 A91 9 0 1 1 29 36"/>
              </circle>
            </svg>
          </span>
        </a>
        <div className="workspace-label">WORKSPACE <ChevronDown size={13} /></div>
        <div className="workspace-card"><span className="workspace-avatar">M</span><span><b>Personal workspace</b><small>MYRAVEN account</small></span><span className="online-dot" /></div>
        <div className="nav-caption">MYRAVEN</div>
        <nav className="side-nav">
          {nav.map(({ label, icon: Icon, href, key }) => <a className={activeSection === key ? "active" : ""} href={href} key={key}><Icon size={17} />{label}</a>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon"><CircleHelp size={16} /></span><b>Need a hand?</b><p>Explore how MYRAVEN connects payment methods.</p><a href="#how">Explore platform <ArrowUpRight size={13} /></a></div>
          <a className="profile-row" href="/settings"><span className="profile-avatar">M</span><span><b>MYRAVEN account</b><small>Account settings</small></span><ChevronDown size={15} /></a>
        </div>
      </aside>

      <section className="main-area">
        <header className="top-header">
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}><Menu size={19} /></button>
          <div className="breadcrumb"><button className="icon-button" type="button" aria-label="Go back" title="Go back" onClick={() => { if (window.history.length > 1) window.history.back(); else window.location.assign("/dashboard"); }}><ArrowLeft size={16} /></button>Workspace <span>/</span> <b>{activeSection === "ussd" ? "USSD preview" : activeSection[0].toUpperCase()+activeSection.slice(1)}</b></div>
          <div className="header-actions"><span className="environment-pill"><i /> DEVNET TEST</span><AuthActions variant="workspace" /><a className="icon-button" href="/notifications" aria-label="Notifications" title="Notifications"><Bell size={17} /></a><span className="header-avatar">M</span></div>
        </header>

        <div className="content-wrap">
          <section className="welcome-row">
            <div><div className="eyebrow"><Sparkles size={13} /> MYRAVEN WORKSPACE</div><h1>{activeSection === "overview" ? (displayName ? "Good to see you, " + displayName + "." : "Good to see you.") : activeSection === "ussd" ? "USSD preview" : activeSection[0].toUpperCase()+activeSection.slice(1)}</h1><p>{activeSection === "overview" ? "Your balances, payments and latest activity at a glance." : activeSection === "payments" ? "Send SOL to verified MYRAVEN accounts and review payment routes." : activeSection === "wallets" ? "Manage your MYRAVEN wallet and connected external wallets." : activeSection === "funding" ? "Add funds through Flutterwave and track SOL settlement." : "Explore the USSD flow preview. No telecom or bank action is performed."}</p></div>
            <div className="welcome-date"><span>NETWORK</span><b><i /> Solana Devnet · Test</b></div>
          </section>
          {activeSection === "overview" ? <section className="metrics-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <article className="metric-card balance-metric-card"><div className="metric-top"><span>Available SOL balance</span><Wallet size={17} /></div><strong>{balanceLoading ? "Loading…" : availableSol === null ? "— SOL" : availableSol.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 8 }) + " SOL"}</strong><small>{balanceError ? "Live wallet balance unavailable" : "Confirmed SOL available to send · pending funds excluded"}</small><div className="metric-line purple-line" /></article>
            <article className="metric-card"><div className="metric-top"><span>Local currency value</span><WalletCards size={17} /></div><strong>{availableSol !== null && solPriceLocal !== null ? money(availableSol * solPriceLocal, preferredCurrency) : "— " + preferredCurrency}</strong><small>{solPriceLocal !== null ? "Estimated value of your available SOL balance" : "Live local-currency estimate loading"}</small><div className="metric-line cyan-line" /></article>
          </section> : null}

          {activeSection === "overview" ? <section className="panel overview-payments-panel"><div className="mini-panel-heading"><span className="panel-kicker">PAYMENTS</span><a href="/dashboard?section=payments">Open payments <ArrowUpRight size={13} /></a></div><div className="funding-history-actions"><a className="connect-button" href="/dashboard?section=payments"><ArrowLeftRight size={13} /> Send funds</a><a className="connect-button" href="/dashboard?section=funding"><WalletCards size={13} /> Add funds</a><a className="connect-button" href="/dashboard/account-details"><ArrowDownLeft size={13} /> Receive</a></div></section> : null}

          {activeSection === "payments" ? <div className="work-grid">
            <section className="panel payment-panel" id="payment">
              <div className="panel-heading"><div><span className="panel-kicker">SMARTROUTE ENGINE</span><h2>Send funds</h2><p>Send from your SOL balance to a MYRAVEN account or choose a local bank destination.</p></div><div className="payment-heading-actions"><button type="button" className={payAiOpen ? "pay-ai-trigger pay-ai-active" : "pay-ai-trigger"} onClick={() => setPayAiOpen((open) => !open)}><Sparkles size={13} /> Pay AI</button><span className="step-badge">01 / 03</span></div></div>
              {payAiOpen ? <div className="pay-ai-box">
                <div className="pay-ai-title"><span className="pay-ai-orb"><Sparkles size={13} /></span><span><b>Pay AI</b><small>Transfer assistant · Preview</small></span></div>
                <p>Describe the SOL amount and where it should go. Review all details before continuing.</p>
                <textarea value={payAiPrompt} onChange={(event) => setPayAiPrompt(event.target.value)} placeholder="e.g. Send 0.5 SOL to a MYRAVEN ID, bank account, or Solana address." rows={3} />
                <button type="button" className="pay-ai-submit" onClick={() => {
                  const parsed = interpretPayAiRequest(payAiPrompt);
                  const updates: string[] = [];
                  if (parsed.amount && Number.isFinite(parsed.amount) && parsed.amount > 0) { setAmount(String(parsed.amount)); updates.push("amount"); }
                  if (parsed.currency && ["USD","EUR","GBP","NGN","KES","GHS","CHF"].includes(parsed.currency)) { setSourceCurrency(parsed.currency); updates.push("your currency"); }
                  if (parsed.destinationCurrency) { setDestinationCurrency(parsed.destinationCurrency); updates.push("recipient currency"); }
                  if (parsed.destination) setDestination(parsed.destination);
                  if (parsed.recipient) { setRecipientReference(parsed.recipient); updates.push("recipient reference"); }
                  setPayAiMessage(updates.length ? "Prepared " + updates.join(", ") + ". Check the SOL amount and destination below, then calculate an estimate." : "I couldn’t confidently identify the amount or currencies. Include an amount and currency, for example: “Send 100 CHF to Daniel in Nigeria, paid out in NGN.”");
                }}>Prepare transfer <ArrowUpRight size={13} /></button>
                {payAiMessage ? <div className="pay-ai-feedback">{payAiMessage}</div> : null}
                <small className="pay-ai-disclaimer">Assisted form parsing only. Live AI, recipient lookup and payment execution are not connected yet.</small>
              </div> : null}
              <form onSubmit={calculateRoutes}>
                <label className="field-label">SEND FUNDS · {amountEntryMode === "SOL" ? "SOL" : preferredCurrency}</label>
                <div className="amount-field amount-field-local-toggle">
                  <input
                    value={amountEntryMode === "SOL" ? amount : solPriceLocal !== null && amount !== "" ? (Number(amount) * solPriceLocal).toFixed(2) : ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (amountEntryMode === "SOL") setAmount(value);
                      else if (value === "") setAmount("");
                      else if (solPriceLocal !== null && solPriceLocal > 0) setAmount(String(Number((Number(value) / solPriceLocal).toFixed(9))));
                    }}
                    type="number"
                    min={amountEntryMode === "SOL" ? "0.000001" : "0.01"}
                    step={amountEntryMode === "SOL" ? "0.000000001" : "0.01"}
                    required
                    disabled={amountEntryMode === "LOCAL" && (solPriceLocal === null || solPriceLocal <= 0)}
                    aria-label={amountEntryMode === "SOL" ? "Amount to send in SOL" : "Amount to send in local currency"}
                  />
                  <div className="amount-unit-switch" aria-label="Amount currency">
                    <button type="button" className={amountEntryMode === "SOL" ? "selected" : ""} onClick={() => setAmountEntryMode("SOL")}>SOL</button>
                    <button type="button" className={amountEntryMode === "LOCAL" ? "selected" : ""} onClick={() => setAmountEntryMode("LOCAL")} disabled={solPriceLocal === null || solPriceLocal <= 0}>{preferredCurrency}</button>
                  </div>
                </div>
                <small className="wallet-card-foot">{amountEntryMode === "SOL"
                  ? solPriceLocal !== null && Number(amount) > 0 ? "≈ " + money(Number(amount) * solPriceLocal, preferredCurrency) + " · estimated local value" : "Switch to " + preferredCurrency + " to enter a local amount"
                  : "≈ " + (Number(amount) > 0 ? Number(amount).toLocaleString("en-US", { maximumFractionDigits: 8 }) : "—") + " SOL · live market estimate"}</small>
                <small className="wallet-card-foot">{balanceLoading ? "Checking available SOL…" : availableSol === null ? "Your SOL balance is unavailable." : `Available: ${availableSol.toLocaleString("en-US", { maximumFractionDigits: 8 })} SOL`}</small>
                <div className="transfer-connector"><span><ArrowDownLeft size={15} /></span><i /></div>
                <label className="field-label">SEND TO</label>
                <select className="recipient-method-select" value={recipientType} onChange={(event) => { setRecipientType(event.target.value); setRecipientProfile(null); setRecipientLookupStatus(""); setRecipientReference(""); setRecipientBank(""); setRecipientBankAccount(""); setRecipientLookupStatus(""); setDestination(event.target.value === "local-bank" ? "bank" : "solana"); }} aria-label="Recipient destination">
                  <option value="myraven">MYRAVEN ID · receive SOL</option>
                  <option value="account">MYRAVEN account · receive SOL</option>
                  <option value="local-bank">Local bank · receive local currency</option>
                </select>
                <label className="field-label preference-label">RECIPIENT IDENTIFIER</label>
                {recipientType === "local-bank" ? <div className="local-bank-fields">
                  <label className="field-label">RECIPIENT COUNTRY</label>
                  <select value={recipientCountry} onChange={(event) => { setRecipientCountry(event.target.value); setRecipientBank(""); setRecipientLookupStatus(""); }} aria-label="Recipient country">
                    {fundingCountriesData.countries.filter((country) => country.independent).map((country) => (
                      <option value={country.code} key={country.code}>{country.name} · {country.code}</option>
                    ))}
                  </select>
                  <label className="field-label">CHOOSE RECIPIENT BANK</label>
                  <select value={recipientBank} onChange={(event) => setRecipientBank(event.target.value)} aria-label="Recipient bank" disabled={recipientBanksLoading || recipientBanks.length === 0}>
                    <option value="">{recipientBanksLoading ? "Loading bank directory…" : recipientBanks.length ? "Select a bank" : "No banks available for this country"}</option>
                    {recipientBanks.map((bank) => <option value={bank.code} key={bank.id}>{bank.name}</option>)}
                  </select>
                  <p className="recipient-lookup-status">{recipientBanksMessage}</p>
                  {recipientBank ? <p className="recipient-lookup-status verified">Selected: {recipientBanks.find((bank) => bank.code === recipientBank)?.name}. Account details and payout steps will be added later.</p> : null}
                </div> : <div className="recipient-lookup-row">
                  <input className="recipient-reference-input" value={recipientReference} onChange={(event) => { setRecipientReference(event.target.value); setRecipientProfile(null); setRecipientLookupStatus(""); }} placeholder={recipientType === "myraven" ? "MRV-XXXXXXXXXX" : recipientType === "account" ? "MYRAVEN account number" : "Paste Solana address"} aria-label="Recipient identifier" />
                </div>}
                {recipientType !== "local-bank" ? <button type="button" className="verify-recipient-button" onClick={verifyRecipient} disabled={recipientLookupLoading}>
                  <ShieldCheck size={13} /> {recipientLookupLoading ? "Checking recipient…" : recipientType === "solana" ? "Validate SOL address" : "Verify recipient"}
                </button> : null}
                {recipientProfile ? <div className="recipient-verification-card">
                  <div className="recipient-avatar">{(recipientProfile.displayName || "M").slice(0, 1).toUpperCase()}</div>
                  <div className="recipient-verification-copy">
                    <b>{recipientProfile.displayName || "MYRAVEN user"}</b>
                    <small>{recipientProfile.myravenId}{recipientProfile.countryCode ? " · " + recipientProfile.countryCode : ""}</small>
                    <em><Check size={11} /> MYRAVEN profile matched</em>
                  </div>
                </div> : null}
                {recipientLookupStatus ? <p className={recipientProfile ? "recipient-lookup-status verified" : "recipient-lookup-status"} role="status">{recipientLookupStatus}</p> : null}
                {recipientType !== "local-bank" ? <>
                  <label className="field-label preference-label">ROUTE PRIORITY</label>
                  <div className="preference-options">{[{id:"balanced",label:"Balanced"},{id:"lowest-cost",label:"Lowest cost"},{id:"fastest",label:"Fastest"},{id:"most-reliable",label:"Reliability"}].map((option) => <button type="button" className={preference === option.id ? "preference-active" : ""} onClick={() => setPreference(option.id)} key={option.id}>{option.label}</button>)}</div>
                  <button className="primary-action" type="submit" disabled={loading}>{loading ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />}{loading ? "Checking transfer…" : "Review & proceed"}<ArrowUpRight size={16} /></button>
                </> : <div className="bank-payout-stage-note"><Landmark size={16}/><span><b>Bank selection complete</b><small>This stage stops at the bank list. Account number, beneficiary verification and payout submission are not active yet.</small></span></div>}
              </form>
              <div className="notice-line"><ShieldCheck size={14} /> No funds move until you confirm the transfer.</div>
            </section>

            <section className="panel route-panel">
              <div className="panel-heading"><div><span className="panel-kicker">TRANSFER STATUS</span><h2>Ready to send</h2><p>MYRAVEN-to-MYRAVEN SOL transfers use your verified Devnet wallets.</p></div><span className="live-indicator"><i /> PREVIEW</span></div>
              {quotes.length === 0 ? <div className="empty-routes"><div className="empty-orbit"><ArrowLeftRight size={23} /></div><b>{recipientType === "local-bank" ? "Local bank payout setup" : "Compare routes is not needed here"}</b><p>{recipientType === "local-bank" ? "Choose the recipient country and a bank. This stage ends at bank selection; account details and payout execution are not active yet." : "Verify the recipient, enter your SOL amount, then review the actual Devnet send on the next step."}</p></div> : <div className="route-list">{quotes.map((quote, index) => <button className={`route-option ${selectedRoute === quote.id ? "route-selected" : ""}`} onClick={() => setSelectedRoute(quote.id)} key={quote.id}><span className={`route-icon ${quote.rail}`}>{quote.rail === "solana" ? "S" : "↗"}</span><span className="route-info"><b>{quote.label}{index === 0 ? <em>BEST MATCH</em> : null}</b><small>{quote.estimatedMinutes} min · {quote.reliability}% illustrative reliability</small></span><span className="route-output"><b>{recipientType === "local-bank" ? money(quote.recipientAmount, destinationCurrency) : solPriceUsd ? (quote.recipientAmount / solPriceUsd).toFixed(6) + " SOL" : "—"}</b><small>Fee {solPriceUsd ? (quote.estimatedFee / solPriceUsd).toFixed(6) + " SOL" : "—"}</small></span><span className="route-score">{quote.score}</span></button>)}</div>}
              {quotes.length > 0 ? <div className="route-explanation"><Sparkles size={15} /><span><b>Why this route?</b> {bestQuote?.reasons.join(" · ")}</span></div> : <div className="route-footnote"><span><span className="legend-dot purple" /> Cost</span><span><span className="legend-dot cyan" /> Speed</span><span><span className="legend-dot green" /> Reliability</span></div>}
              {quotes.length > 0 ? <button className="secondary-action" onClick={() => setApprovalOpen(true)}>Review payment details <ArrowUpRight size={15} /></button> : null}
              <p className="simulation-note">{notice}</p>
            </section>
          </div> : null}

          {activeSection === "funding" ? <section className="panel wallet-panel funding-hub-panel" id="funding">
            <div className="panel-heading wallet-heading funding-heading">
              <div>
                <span className="panel-kicker">MYRAVEN FUNDING · ONE WALLET</span>
                <h2>Add money to your MYRAVEN wallet</h2>
                <p>Choose your country to see the funding routes that can serve it. Your local currency is identified from your selection.</p>
              </div>
              <span className="read-only-tag"><LockKeyhole size={12} /> TEST MODE · DEVNET</span>
            </div>

            <div className="funding-country-row">
              <div className="funding-country-field">
                <label className="field-label" htmlFor="funding-country">YOUR COUNTRY OR REGION</label>
                <select id="funding-country" value={fundingCountry} onChange={(event) => { const code = event.target.value; setFundingCountry(code); setFundingCurrency(fundingCountriesData.countries.find((item) => item.code === code)?.currency?.[0] ?? ""); }}>
                  <option value="">Choose a country or region</option>
                  {fundingCountriesData.countries.map((country) => (
                    <option value={country.code} key={country.code}>{country.name} ({country.code})</option>
                  ))}
                </select>
              </div>
              <div className="funding-currency-card">
                <span>DETECTED LOCAL CURRENCY</span>
                <strong>{fundingCountriesData.countries.find((country) => country.code === fundingCountry)?.currency?.join(" / ") || "—"}</strong>
                <small>{fundingCountriesData.countries.find((country) => country.code === fundingCountry)?.currencyName?.join(" / ") || "Select a country to identify its currency"}</small>
              </div>
            </div>

            <div className="funding-section-label">
              <div><span className="panel-kicker">FUNDING METHODS</span><h3>Choose how to add money</h3></div>
              <span className="funding-method-count">ONE PAYMENT PARTNER</span>
            </div>
            <div className="funding-method-grid">
              {[
                { id: "card", title: "Flutterwave", detail: "Secure card checkout · local methods where supported", note: "One checkout for supported countries", icon: CreditCard },
              ].map((method) => {
                const Icon = method.icon;
                return (
                  <button type="button" key={method.id} onClick={() => setFundingMethod(method.id)} className={`funding-method-card ${fundingMethod === method.id ? "funding-method-selected" : ""}`}>
                    <span className="funding-method-icon"><Icon size={18} /></span>
                    <span className="funding-method-copy"><b>{method.title}</b><small>{method.detail}</small><em>{method.note}</em></span>
                    <span className="funding-method-radio">{fundingMethod === method.id ? <Check size={13} /> : null}</span>
                  </button>
                );
              })}
            </div>

            <div className="funding-route-status">
              <div className="funding-route-status-icon"><ShieldCheck size={17} /></div>
              <div>
                <span className="panel-kicker">COUNTRY ROUTE CHECK</span>
                <b>{fundingCountry ? `Funding route for ${fundingCountriesData.countries.find((country) => country.code === fundingCountry)?.name || fundingCountry}` : "Choose your country to check funding routes"}</b>
                <p>{fundingCountry ? "Country and currency identified. Funding options appear when supported by our partner and your account." : "Select your country to check local currency and available funding options."}</p>
              </div>
              <span className="funding-provider-status">FLUTTERWAVE</span>
            </div>

            <div className="funding-next-step">
              <div>
                <span className="panel-kicker">SELECTED METHOD</span>
                <b>Flutterwave secure checkout</b>
                <p>Flutterwave handles card payments. Available options depend on your country and account approval.</p>
              </div>
              <span className="read-only-tag"><LockKeyhole size={11} /> TEST SETUP</span>
            </div>
            <div className="funding-checkout-controls">
              <label className="funding-country-field">
                <span className="field-label">AMOUNT TO ADD</span>
                <input type="number" min="1" max="1000000" step="0.01" value={fundingAmount} onChange={(event) => setFundingAmount(event.target.value)} />
              </label>
              <label className="funding-country-field">
                <span className="field-label">PAYMENT CURRENCY</span>
                <select value={fundingCurrency} onChange={(event) => setFundingCurrency(event.target.value)}>
                  {(fundingCountriesData.countries.find((item) => item.code === fundingCountry)?.currency ?? []).map((code) => <option value={code} key={code}>{code}</option>)}
                </select>
              </label>
              <label className="funding-country-field">
                <span className="field-label">WALLET ASSET</span>
                <select value={fundingTargetAsset} onChange={(event) => setFundingTargetAsset(event.target.value)}>
                  <option value="SOL">SOL · Solana</option>
                </select>
              </label>
              <button type="button" className="primary-action funding-checkout-button" onClick={startFundingCheckout} disabled={fundingCheckoutLoading}>
                {fundingCheckoutLoading ? <RefreshCw size={16} className="spin" /> : <ArrowUpRight size={16} />}
                Continue to secure checkout
              </button>
            </div>
            {fundingMessage ? <p className="funding-disclaimer" role="status">{fundingMessage}</p> : null}
            <div className="funding-history">
              <div className="funding-history-heading">
                <div><span className="panel-kicker">YOUR WALLET FUNDING</span><h3>Recent funding activity</h3></div>
                <div className="funding-history-actions">
                  <a className="connect-button" href="/dashboard/activity">View all activity <ArrowUpRight size={13} /></a>
                  <button type="button" className="connect-button" onClick={() => void loadFundingHistory()} disabled={fundingHistoryLoading}>
                    <RefreshCw size={13} className={fundingHistoryLoading ? "spin" : ""} /> Refresh
                  </button>
                </div>
              </div>
              {fundingHistoryMessage ? <p className="funding-disclaimer" role="status">{fundingHistoryMessage}</p> : null}
              {fundingHistory.length ? <div className="funding-history-list">
                {fundingHistory.slice(0, 2).map((deposit) => <div className="funding-history-item" key={deposit.id}>
                  <span className="funding-history-mark"><WalletCards size={15} /></span>
                  <span className="funding-history-copy">
                    <b>{money(Number(deposit.input_amount), deposit.input_currency)} · {deposit.target_asset} requested</b>
                    <small>{deposit.funding_method.replaceAll("_", " ")} · {new Date(deposit.created_at).toLocaleString()}</small>
                  </span>
                  <span className={`funding-history-status status-${deposit.status}`}>
                    {deposit.status === "credited" ? "Wallet funded"
                      : deposit.metadata?.treasury_settlement?.transfer_status && deposit.metadata.treasury_settlement.transfer_status !== "confirmed" ? "Conversion · settling on-chain"
                      : deposit.status === "converting" ? "Payment successful · conversion pending"
                      : deposit.status === "submitted_onchain" || deposit.status === "confirming" ? "Crypto settlement pending"
                      : deposit.status === "awaiting_payment" ? "Awaiting payment confirmation"
                      : deposit.status.replaceAll("_", " ")}
                    {deposit.credited_output_amount ? <small>{deposit.credited_output_amount} {deposit.target_asset} credited to your wallet</small>
                      : deposit.metadata?.treasury_settlement?.transfer_status ? <small>Devnet treasury transfer awaiting confirmation</small>
                      : deposit.status === "converting" ? <small>Payment verified · preparing SOL settlement</small> : null}
                  </span>
                </div>)}
              </div> : <p className="funding-history-empty">{fundingHistoryLoading ? "Loading funding activity…" : "Your verified funding requests will appear here."}</p>}
            </div>
            <p className="funding-disclaimer"><ShieldCheck size={13} /> Test mode: verified Flutterwave test payments are settled from MYRAVEN&apos;s shared Devnet treasury. SOL appears in your available balance only after the transfer is confirmed on Solana.</p>
          </section> : null}
          {activeSection === "wallets" ? <section className="panel wallet-panel" id="wallets">
            <div className="panel-heading wallet-heading"><div><span className="panel-kicker">CONNECTED ASSETS</span><h2>Wallet connections</h2><p>Connect Phantom on Solana Devnet to verify a public address and view test SOL. MYRAVEN never asks for your seed phrase.</p></div><span className="read-only-tag"><ShieldCheck size={12} /> ADDRESS ONLY</span></div>
            <article className="wallet-connect-card myraven-embedded-wallet-card">
              <div className="wallet-network-logo solana-logo">M</div>
              <div className="wallet-copy"><b>MYRAVEN embedded wallet</b><small>Automatically created for your account · Privy · {myravenWallet?.network ?? "Solana Devnet"}</small></div>
              <span className="connected-label"><i /> {myravenWalletLoading ? "Setting up" : myravenWallet?.address ? "Your wallet" : "Needs attention"}</span>
            </article>
            <div className="myraven-wallet-address-panel">
              {myravenWalletLoading ? <p className="wallet-message">Loading your MYRAVEN wallet…</p> : myravenWallet?.address ? <>
                <img src={"https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data="+encodeURIComponent(myravenWallet.address)} alt="QR code for your MYRAVEN Solana wallet" width="112" height="112" />
                <div className="receive-address-value"><div><span className="panel-kicker">YOUR MYRAVEN SOLANA ADDRESS</span><code>{myravenWallet.address}</code><small>Embedded wallet · {myravenWallet.network} · {myravenWallet.status}</small></div><div className="wallet-address-actions"><button className="connect-button" type="button" onClick={() => { void navigator.clipboard.writeText(myravenWallet.address); setWalletMessage("MYRAVEN wallet address copied."); }}>Copy address</button><a className="connect-button" href={"https://explorer.solana.com/address/"+myravenWallet.address+"?cluster=devnet"} target="_blank" rel="noreferrer">Explorer <ArrowUpRight size={13}/></a></div></div>
              </> : <div className="wallet-message" role="status">{myravenWalletError || "Your MYRAVEN wallet could not be loaded."} <button type="button" className="connect-button" onClick={async()=>{setMyravenWalletLoading(true);setMyravenWalletError("");try{const r=await fetch("/api/account/wallet",{method:"POST",cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error??"Wallet setup failed.");setMyravenWallet({address:d.address,status:d.status,network:d.network});}catch(e){setMyravenWalletError(e instanceof Error?e.message:"Wallet setup failed.");}finally{setMyravenWalletLoading(false);}}}>Retry wallet setup</button></div>}
            </div>
            <div className="wallet-connect-grid">
              <article className="wallet-connect-card"><div className="wallet-network-logo solana-logo">S</div><div className="wallet-copy"><b>Solana</b><small>Phantom · Devnet · Public address only</small></div><button onClick={connectSolana} className="connect-button">Connect wallet <Plus size={14} /></button></article>
              
            </div>
            {walletMessage ? <p className="wallet-message">{walletMessage}</p> : null}
            {wallets.length > 0 ? <div className="connected-list">{wallets.map((wallet) => <div className="connected-wallet" key={wallet.address}><span className={`mini-network ${wallet.network.toLowerCase()}`}>S</span><span><b>{wallet.name}</b><small>{shortAddress(wallet.address)}</small></span><span className="connected-label"><i /> Connected · Read only</span><button onClick={() => { void navigator.clipboard.writeText(wallet.address); setWalletMessage("Connected wallet address copied."); }} className="disconnect-button">Copy</button><button onClick={() => disconnectWallet(wallet.address)} className="disconnect-button">Disconnect</button></div>)}</div> : <div className="wallet-empty"><WalletCards size={18} /><span>No wallets connected yet</span></div>}
            {wallets[0] ? <div className="receive-address-value external-receive-address"><div><span className="panel-kicker">EXTERNAL SOLANA DEVNET ADDRESS · READ ONLY</span><code>{wallets[0].address}</code></div><button className="connect-button" onClick={() => { void navigator.clipboard.writeText(wallets[0].address); setWalletMessage("External Solana address copied."); }}>Copy address</button></div> : null}
            <div className="wallet-balance-grid">
              <article className="wallet-balance-card myraven-wallet-card">
                <div className="wallet-balance-card-top"><span><Wallet size={15} /> MYRAVEN WALLET</span><small>ON-CHAIN SOL</small></div>
                <strong>{balanceLoading ? "Loading…" : availableSol === null ? "— SOL" : `${availableSol.toLocaleString("en-US", { maximumFractionDigits: 8 })} SOL`}</strong>
                <p>Available to send from your MYRAVEN account. Pending funds are excluded.</p>
                <small className="wallet-card-foot">{solPriceLocal !== null ? "1 SOL ≈ " + money(solPriceLocal, preferredCurrency) + (solPriceUpdatedAt ? " · live market estimate" : "") : "Local SOL market estimate unavailable"}</small>
                <small className="wallet-card-foot">{availableSol !== null && solPriceLocal !== null ? "≈ " + money(availableSol * solPriceLocal, preferredCurrency) + " · " + preferredCurrency : ""}</small>
                <small className="wallet-card-foot">{balanceError ? "Balance could not be loaded" : "Live Solana Devnet balance · Test only"}</small>
              </article>
              <article className="wallet-balance-card external-wallet-card">
                <div className="wallet-balance-card-top"><span><WalletCards size={15} /> CONNECTED WALLET</span><small>READ ONLY</small></div>
                <strong>{externalBalanceLoading ? "Checking…" : externalSolBalance === null ? "— SOL" : `${externalSolBalance.toLocaleString("en-US", { maximumFractionDigits: 8 })} SOL`}</strong>
                <p>{wallets.length ? shortAddress(wallets[0].address) : "Connect Phantom to view a public SOL balance."}</p>
                <small className="wallet-card-foot">{externalBalanceError || (wallets.length ? "External wallet · Devnet · Not MYRAVEN funds" : "No external wallet connected")}</small>
              </article>
            </div>
            <div className="wallet-security"><ShieldCheck size={15} /><span>External wallet balances are informational only. MYRAVEN does not receive signing permission, move funds, or access your seed phrase or private key.</span></div>
          </section> : null}

          {activeSection === "payments" ? <section className="panel safety-panel" id="safety"><div className="mini-panel-heading"><span className="safety-icon"><ShieldCheck size={17} /></span><span className="panel-kicker">PAYMENT SAFETY</span></div><h3>You stay in control.</h3><p>Every payment requires a clear review and explicit approval. A quote alone never authorizes a transaction.</p><div className="safety-points"><span><Check size={13} /> Fees shown before approval</span><span><Check size={13} /> Wallet credit waits for on-chain confirmation</span><span><Check size={13} /> No blind payment retries</span></div></section> : null}

          {activeSection === "overview" ? <section className="panel activity-panel" id="activity"><div className="mini-panel-heading"><span className="panel-kicker">LATEST ACTIVITY</span><a href="/dashboard/activity">View all activity <ArrowUpRight size={13} /></a></div><div className="demo-activity-list">{(() => { const seen = new Set<string>(); const rows = [...activities, ...recentActivity].filter((item) => Boolean(item.category)).filter((item) => { if (seen.has(item.id)) return false; seen.add(item.id); return true; }).slice(0, 2); return rows.length ? rows.map((item) => <div className="demo-activity-item" key={item.id}><span className="activity-mark"><ArrowLeftRight size={14} /></span><span className="activity-description"><b>{item.title}</b><small>{item.detail} · {item.time}</small></span><span className="activity-amount"><b>{item.amount}</b><small>{item.status}</small>{item.id === "scheduled-" + transferRequestId && sendWindowActive ? <button className="cancel-review" type="button" onClick={cancelScheduledSend}>Cancel</button> : null}</span></div>) : <div className="activity-empty"><Activity size={17} /><span><b>No activity yet</b><small>Your confirmed transfers and funding records will appear here.</small></span></div>; })()}</div></section> : null}

          {activeSection === "ussd" ? <section className="panel funding-hub-panel ussd-preview-panel" id="ussd"><div className="panel-heading"><div><span className="panel-kicker">USSD · PREVIEW ONLY</span><h2>Explore a USSD payment flow</h2><p>Try the interaction preview. It does not contact a telecom provider, bank or wallet.</p></div><span className="read-only-tag">NO LIVE ACTION</span></div><div className="funding-checkout-controls"><label className="funding-country-field"><span className="field-label">PHONE NUMBER</span><input value={ussdPhone} onChange={(event) => setUssdPhone(event.target.value)} placeholder="+234 800 000 0000" /></label><label className="funding-country-field"><span className="field-label">AMOUNT · DEMO USD</span><input type="number" min="1" value={ussdAmount} onChange={(event) => setUssdAmount(event.target.value)} /></label><button type="button" className="primary-action" onClick={simulateUssd}><Smartphone size={16} /> Preview USSD request</button></div>{ussdResult ? <p className="funding-disclaimer" role="status">{ussdResult}</p> : null}</section> : null}

          <footer className="app-footer"><span>© {new Date().getFullYear()} MYRAVEN</span><span>Money moves. Intelligence connects.</span><span>TEST MODE · SOLANA DEVNET ONLY</span></footer>
        </div>
      </section>

      {menuOpen ? <button className="mobile-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" /> : null}
      {approvalOpen ? <div className="modal-backdrop" role="presentation" onClick={() => setApprovalOpen(false)}><section className="approval-modal" role="dialog" aria-modal="true" aria-labelledby="approval-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setApprovalOpen(false)} aria-label="Close"><X size={18} /></button><span className="panel-kicker">DEVNET TRANSFER REVIEW</span><h2 id="approval-title">Review before you send</h2><p>After you confirm Send, a 60-second cancellation window starts in Activity. If you do not cancel before it ends, MYRAVEN immediately submits the transfer. This is test-network SOL, not mainnet funds.</p><div className="review-rows"><span>Recipient <b>{recipientProfile?.displayName ?? (recipientType === "solana" ? "External Solana wallet" : recipientType === "local-bank" ? "Local bank payout" : "Not verified")}</b></span><span>Recipient check <b>{recipientProfile ? "MYRAVEN profile matched" : recipientLookupStatus || "Not checked"}</b></span><span>Identifier <b>{recipientReference || "Not provided"}</b></span><span>You send <b>{Number(amount).toLocaleString("en-US", { maximumFractionDigits: 8 })} SOL</b></span><span>Route <b>MYRAVEN internal transfer · Solana Devnet</b></span><span>Network fee <b>Deducted by Solana at confirmation</b></span><span>Recipient receives <b>{Number(amount).toLocaleString("en-US", { maximumFractionDigits: 8 })} SOL</b></span></div>{transferMessage ? <div className="approval-result"><Check size={16} /> {transferMessage}</div> : <div className="approval-result"><LockKeyhole size={16} /> Ready to submit a real Devnet SOL transfer to the verified MYRAVEN wallet.</div>}<button className="primary-action" type="button" onClick={beginSendCountdown} disabled={transferSending || approved || sendWindowActive || !recipientProfile}>{transferSending ? "Submitting…" : approved ? "Transfer submitted" : sendWindowActive ? "Scheduled…" : "Send SOL"} <ArrowUpRight size={15} /></button><button className="cancel-review" type="button" onClick={() => setApprovalOpen(false)}>Go back</button></section></div> : null}
    </main>
  );
}
