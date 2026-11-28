"use client";

import { useEffect, useMemo, useState } from "react";
import AuthActions from "@/components/auth-actions";
import fundingCountriesData from "../../src/data/funding-countries.json";
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, Check, CreditCard, Landmark, Smartphone,
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
type DemoActivity = { id: string; title: string; detail: string; amount: string; status: string; time: string };
type RecipientProfile = { myravenId: string; accountNumber?: string; displayName: string | null; countryCode: string | null; solanaAddress?: string | null; walletStatus?: string | null };
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
  } | null;
};

declare global {
  interface Window {
    solana?: { isPhantom?: boolean; connect: () => Promise<{ publicKey: { toString: () => string } }>; disconnect?: () => Promise<void> };
  }
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState("");
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approved, setApproved] = useState(false);
  const [transferSending, setTransferSending] = useState(false);
  const [transferMessage, setTransferMessage] = useState("");
  const [transferRequestId, setTransferRequestId] = useState("");
  const [paymentWindowActive, setPaymentWindowActive] = useState(false);
  const [paymentWindowSeconds, setPaymentWindowSeconds] = useState(60);
  const [payAiOpen, setPayAiOpen] = useState(false);
  const [payAiPrompt, setPayAiPrompt] = useState("");
  const [payAiMessage, setPayAiMessage] = useState("");
  const [recipientReference, setRecipientReference] = useState("");
  const [recipientType, setRecipientType] = useState("myraven");
  const [recipientCountry, setRecipientCountry] = useState("NG");
  const [recipientBank, setRecipientBank] = useState("");
  const [recipientBankAccount, setRecipientBankAccount] = useState("");
  const [recipientProfile, setRecipientProfile] = useState<RecipientProfile | null>(null);
  const [recipientLookupStatus, setRecipientLookupStatus] = useState("");
  const [recipientLookupLoading, setRecipientLookupLoading] = useState(false);
  const [activities, setActivities] = useState<DemoActivity[]>([]);
  const [ussdPhone, setUssdPhone] = useState("");
  const [ussdAmount, setUssdAmount] = useState("25");
  const [ussdResult, setUssdResult] = useState("");

  useEffect(() => {
    if (!paymentWindowActive) return;
    if (paymentWindowSeconds <= 0) {
      setPaymentWindowActive(false);
      void confirmDemoPayment();
      return;
    }
    const timer = window.setTimeout(() => setPaymentWindowSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [paymentWindowActive, paymentWindowSeconds]);

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
    setFundingHistoryLoading(true);
    setFundingHistoryMessage("");
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
      const readyForSettlement: FundingDeposit[] = latest.filter((deposit) =>
        deposit.status === "converting"
        && deposit.metadata?.payment_state === "successful"
        && deposit.metadata?.environment === "test"
        && deposit.target_asset === "SOL"
        && deposit.metadata?.treasury_settlement?.transfer_status !== "confirmed"
      );
      await Promise.all(readyForSettlement.map((deposit) =>
        fetch("/api/funding/settle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deposit_id: deposit.id }),
        }).catch(() => null)
      ));
      const finalResponse = await fetch("/api/funding/deposits", { cache: "no-store" });
      const finalData = await finalResponse.json();
      if (finalResponse.ok && Array.isArray(finalData.deposits)) setFundingHistory(finalData.deposits);
    } catch (error) {
      setFundingHistoryMessage(error instanceof Error ? error.message : "Funding history is unavailable.");
    } finally {
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

  function startPaymentSafetyWindow() {
    const solAmount = Number(amount);
    if (!recipientProfile || !["myraven", "account"].includes(recipientType)) {
      setTransferMessage("Verify a MYRAVEN recipient before authorizing payment.");
      return;
    }
    if (!Number.isFinite(solAmount) || solAmount <= 0 || availableSol === null || solAmount + 0.00001 > availableSol) {
      setTransferMessage("Your live Devnet balance is insufficient or unavailable. Request test SOL or refresh the balance.");
      return;
    }
    setApproved(false);
    setTransferRequestId("");
    setPaymentWindowSeconds(60);
    setPaymentWindowActive(true);
    setTransferMessage("Payment authorized for the 60-second safety window. Review the details; cancel any time before submission.");
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
        title: "SOL transfer submitted",
        detail: recipientProfile.displayName || recipientReference,
        amount: "-" + String(amount) + " SOL",
        status: "Pending · Devnet",
        time: "Just now",
      }, ...current]);
      setApproved(true);
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
        setActivities((current) => current.map((item) => item.id === String(data.actionId) ? { ...item, status: "Confirmed · Devnet" } : item));
        const balanceResponse = await fetch("/api/account/wallet/balance", { cache: "no-store" });
        const balanceData = await balanceResponse.json();
        if (balanceResponse.ok && Number.isFinite(Number(balanceData.availableSol))) setAvailableSol(Number(balanceData.availableSol));
      } else if (["failed", "cancelled", "reverted"].includes(finalStatus)) {
        setTransferMessage("Privy reports the transfer " + finalStatus + ". Check the action details before retrying.");
        setActivities((current) => current.map((item) => item.id === String(data.actionId) ? { ...item, status: "Failed · Devnet" } : item));
      } else {
        setTransferMessage("Transfer is still processing on Devnet. Action " + String(data.actionId) + ". Do not submit it again yet.");
      }
    } catch (error) {
      setTransferMessage(error instanceof Error ? error.message : "Transfer failed. No success was recorded.");
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
    { label: "Overview", icon: LayoutDashboard },
    { label: "Payments", icon: ArrowLeftRight },
    { label: "Wallets", icon: Wallet },
    { label: "Activity", icon: Activity },
    { label: "USSD Preview", icon: Globe2 },
  ];

  return (
    <main className="app-frame">
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
        <div className="nav-caption">PLATFORM</div>
        <nav className="side-nav">
          {nav.map(({ label, icon: Icon }, index) => <a className={index === 0 ? "active" : ""} href={index === 1 ? "#payment" : index === 2 ? "#wallets" : index === 3 ? "/dashboard/activity" : "#ussd"} key={label}><Icon size={17} />{label}{label === "Payments" ? <span className="nav-soon">NEW</span> : null}</a>)}
        </nav>
        <div className="nav-caption tools-caption">TOOLS</div>
        <nav className="side-nav">
          <a href="/dashboard/account-details"><Wallet size={17} />Account details</a>
          <a href="#funding"><WalletCards size={17} />Funding</a>
          <a href="#payment"><Globe2 size={17} />SmartRoute</a>
          <a href="#safety"><ShieldCheck size={17} />Payment safety</a>
          <a href="#ussd"><Globe2 size={17} />USSD simulator</a>
          <a href="#activity"><Bell size={17} />Notifications</a>
          <a href="/settings"><Settings2 size={17} />Settings</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon"><CircleHelp size={16} /></span><b>Need a hand?</b><p>Explore how MYRAVEN connects payment methods.</p><a href="#how">Explore platform <ArrowUpRight size={13} /></a></div>
          <a className="profile-row" href="/settings"><span className="profile-avatar">M</span><span><b>MYRAVEN account</b><small>Account settings</small></span><ChevronDown size={15} /></a>
        </div>
      </aside>

      <section className="main-area">
        <header className="top-header">
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}><Menu size={19} /></button>
          <div className="breadcrumb">Workspace <span>/</span> <b>Overview</b></div>
          <div className="header-actions"><span className="environment-pill"><i /> PREVIEW MODE</span><AuthActions variant="workspace" /><button className="icon-button" aria-label="Notifications"><Bell size={17} /></button><span className="header-avatar">M</span></div>
        </header>

        <div className="content-wrap">
          <section className="welcome-row">
            <div><div className="eyebrow"><Sparkles size={13} /> INTELLIGENT PAYMENT ORCHESTRATION</div><h1>Good to see you.</h1><p>Your money, your choices. MYRAVEN connects the routes in between.</p></div>
            <div className="welcome-date"><span>PLATFORM STATUS</span><b><i /> Core preview online</b></div>
          </section>

          <section className="metrics-grid">
            <article className="metric-card balance-metric-card"><div className="metric-top"><span>Available to send</span><Wallet size={17} /></div><strong>{balanceLoading ? "Loading…" : availableSol === null ? "— SOL" : availableSol.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 8 }) + " SOL"}</strong><small>{balanceError ? "Sign in or refresh to load your live wallet balance" : "Confirmed SOL in your MYRAVEN wallet · excludes pending funds"}</small><div className="metric-line purple-line" /></article>
            <article className="metric-card"><div className="metric-top"><span>Routes compared</span><ArrowLeftRight size={17} /></div><strong>{quotes.length.toString().padStart(2, "0")}</strong><small>MYRAVEN Devnet transfers</small><div className="metric-line cyan-line" /></article>
            <article className="metric-card"><div className="metric-top"><span>Payments completed</span><Check size={17} /></div><strong>{(fundingHistory.filter((deposit) => deposit.status === "credited" || deposit.metadata?.payment_state === "successful").length + activities.filter((item) => item.status.includes("Completed")).length).toString().padStart(2, "0")}</strong><small>Verified deposits and completed demo payments</small><div className="metric-line green-line" /></article>
            <article className="metric-card"><div className="metric-top"><span>Safety status</span><LockKeyhole size={17} /></div><strong className="metric-word">Protected</strong><small>Approval required for every action</small><div className="metric-line silver-line" /></article>
          </section>

          <div className="work-grid">
            <section className="panel payment-panel" id="payment">
              <div className="panel-heading"><div><span className="panel-kicker">SMARTROUTE ENGINE</span><h2>Build a payment</h2><p>Send from your SOL balance to a MYRAVEN account, a bank, or a Solana address.</p></div><div className="payment-heading-actions"><button type="button" className={payAiOpen ? "pay-ai-trigger pay-ai-active" : "pay-ai-trigger"} onClick={() => setPayAiOpen((open) => !open)}><Sparkles size={13} /> Pay AI</button><span className="step-badge">01 / 03</span></div></div>
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
                <label className="field-label">YOU SEND · SOL</label>
                <div className="amount-field"><input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0.000001" step="0.000001" required aria-label="Amount to send in SOL" /><span className="amount-currency">SOL</span></div>
                <small className="wallet-card-foot">{balanceLoading ? "Checking available SOL…" : availableSol === null ? "Your SOL balance is unavailable." : `Available: ${availableSol.toLocaleString("en-US", { maximumFractionDigits: 8 })} SOL`}</small>
                <div className="transfer-connector"><span><ArrowDownLeft size={15} /></span><i /></div>
                <label className="field-label">SEND TO</label>
                <select className="recipient-method-select" value={recipientType} onChange={(event) => { setRecipientType(event.target.value); setRecipientProfile(null); setRecipientLookupStatus(""); setRecipientReference(""); setRecipientBank(""); setRecipientBankAccount(""); setRecipientLookupStatus(""); setDestination(event.target.value === "local-bank" ? "bank" : "solana"); }} aria-label="Recipient destination">
                  <option value="myraven">MYRAVEN ID · receive SOL</option>
                  <option value="account">MYRAVEN account · receive SOL</option>
                </select>
                <label className="field-label preference-label">RECIPIENT IDENTIFIER</label>
                {recipientType === "local-bank" ? <div className="local-bank-fields">
                  <label className="field-label">RECIPIENT COUNTRY</label>
                  <select value={recipientCountry} onChange={(event) => { setRecipientCountry(event.target.value); setRecipientBank(""); setRecipientLookupStatus(""); }} aria-label="Recipient country">
                    <option value="NG">Nigeria</option><option value="GH">Ghana</option><option value="KE">Kenya</option><option value="ZA">South Africa</option><option value="GB">United Kingdom</option><option value="US">United States</option><option value="CH">Switzerland</option><option value="EU">Euro area</option>
                  </select>
                  <label className="field-label">BANK / PAYMENT PROVIDER</label>
                  <select value={recipientBank} onChange={(event) => { setRecipientBank(event.target.value); setRecipientLookupStatus(""); }} aria-label="Recipient bank" disabled><option value="">Bank list loads from connected payout providers</option></select>
                  <label className="field-label">RECIPIENT ACCOUNT NUMBER</label>
                  <input value={recipientBankAccount} onChange={(event) => { setRecipientBankAccount(event.target.value); setRecipientLookupStatus(""); }} placeholder="Enter recipient account number" aria-label="Recipient bank account number" />
                  <p className="recipient-lookup-status">Country selection is a preview. Live bank lists and account-name verification will appear when a payout provider is connected.</p>
                </div> : <div className="recipient-lookup-row">
                  <input className="recipient-reference-input" value={recipientReference} onChange={(event) => { setRecipientReference(event.target.value); setRecipientProfile(null); setRecipientLookupStatus(""); }} placeholder={recipientType === "myraven" ? "MRV-XXXXXXXXXX" : recipientType === "account" ? "MYRAVEN account number" : "Paste Solana address"} aria-label="Recipient identifier" />
                </div>}
                {recipientType !== "local-bank" ? <button type="button" className="verify-recipient-button" onClick={verifyRecipient} disabled={recipientLookupLoading}>
                  <ShieldCheck size={13} /> {recipientLookupLoading ? "Checking recipient…" : recipientType === "solana" ? "Validate SOL address" : "Verify recipient"}
                </button> : <button type="button" className="verify-recipient-button" onClick={verifyRecipient}><ShieldCheck size={13} /> Check bank details</button>}
                {recipientProfile ? <div className="recipient-verification-card">
                  <div className="recipient-avatar">{(recipientProfile.displayName || "M").slice(0, 1).toUpperCase()}</div>
                  <div className="recipient-verification-copy">
                    <b>{recipientProfile.displayName || "MYRAVEN user"}</b>
                    <small>{recipientProfile.myravenId}{recipientProfile.countryCode ? " · " + recipientProfile.countryCode : ""}</small>
                    <em><Check size={11} /> MYRAVEN profile matched</em>
                  </div>
                </div> : null}
                {recipientLookupStatus ? <p className={recipientProfile ? "recipient-lookup-status verified" : "recipient-lookup-status"} role="status">{recipientLookupStatus}</p> : null}
                <label className="field-label preference-label">ROUTE PRIORITY</label>
                <div className="preference-options">{[{id:"balanced",label:"Balanced"},{id:"lowest-cost",label:"Lowest cost"},{id:"fastest",label:"Fastest"},{id:"most-reliable",label:"Reliability"}].map((option) => <button type="button" className={preference === option.id ? "preference-active" : ""} onClick={() => setPreference(option.id)} key={option.id}>{option.label}</button>)}</div>
                <button className="primary-action" type="submit" disabled={loading}>{loading ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />}{loading ? "Checking transfer…" : "Review & proceed"}<ArrowUpRight size={16} /></button>
              </form>
              <div className="notice-line"><ShieldCheck size={14} /> No funds move until you confirm the transfer.</div>
            </section>

            <section className="panel route-panel">
              <div className="panel-heading"><div><span className="panel-kicker">TRANSFER STATUS</span><h2>Ready to send</h2><p>MYRAVEN-to-MYRAVEN SOL transfers use your verified Devnet wallets.</p></div><span className="live-indicator"><i /> PREVIEW</span></div>
              {quotes.length === 0 ? <div className="empty-routes"><div className="empty-orbit"><ArrowLeftRight size={23} /></div><b>Compare routes is not needed here</b><p>Verify the recipient, enter your SOL amount, then select “Review transfer”. You will approve the actual Devnet send on the next step.</p></div> : <div className="route-list">{quotes.map((quote, index) => <button className={`route-option ${selectedRoute === quote.id ? "route-selected" : ""}`} onClick={() => setSelectedRoute(quote.id)} key={quote.id}><span className={`route-icon ${quote.rail}`}>{quote.rail === "solana" ? "S" : "↗"}</span><span className="route-info"><b>{quote.label}{index === 0 ? <em>BEST MATCH</em> : null}</b><small>{quote.estimatedMinutes} min · {quote.reliability}% illustrative reliability</small></span><span className="route-output"><b>{recipientType === "local-bank" ? money(quote.recipientAmount, destinationCurrency) : solPriceUsd ? (quote.recipientAmount / solPriceUsd).toFixed(6) + " SOL" : "—"}</b><small>Fee {solPriceUsd ? (quote.estimatedFee / solPriceUsd).toFixed(6) + " SOL" : "—"}</small></span><span className="route-score">{quote.score}</span></button>)}</div>}
              {quotes.length > 0 ? <div className="route-explanation"><Sparkles size={15} /><span><b>Why this route?</b> {bestQuote?.reasons.join(" · ")}</span></div> : <div className="route-footnote"><span><span className="legend-dot purple" /> Cost</span><span><span className="legend-dot cyan" /> Speed</span><span><span className="legend-dot green" /> Reliability</span></div>}
              {quotes.length > 0 ? <button className="secondary-action" onClick={() => setApprovalOpen(true)}>Review payment details <ArrowUpRight size={15} /></button> : null}
              <p className="simulation-note">{notice}</p>
            </section>
          </div>

          <section className="panel wallet-panel funding-hub-panel" id="funding">
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
            <p className="funding-disclaimer"><ShieldCheck size={13} /> Test integration only. A successful Flutterwave payment is verified server-side. SOL is added to your available balance only after real conversion and Solana settlement are confirmed.</p>
          </section>
          <section className="panel wallet-panel" id="wallets">
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
          </section>

          <section className="bottom-grid" id="safety">
            <article className="panel safety-panel"><div className="mini-panel-heading"><span className="safety-icon"><ShieldCheck size={17} /></span><span className="panel-kicker">PAYMENT SAFETY</span></div><h3>You stay in control.</h3><p>Every payment requires a clear review and explicit approval. A quote alone never authorizes a transaction.</p><div className="safety-points"><span><Check size={13} /> Fees shown before approval</span><span><Check size={13} /> Wallet credit waits for on-chain confirmation</span><span><Check size={13} /> No blind payment retries</span></div></article>
            <article className="panel activity-panel" id="activity"><div className="mini-panel-heading"><span className="panel-kicker">RECENT ACTIVITY</span><a href="/dashboard/activity">View all <ArrowUpRight size={13} /></a></div><div className="demo-activity-list">{activities.length ? activities.slice(0, 2).map((item) => <div className="demo-activity-item" key={item.id}><span className="activity-mark"><ArrowLeftRight size={14} /></span><span className="activity-description"><b>{item.title}</b><small>{item.detail} · {item.time}</small></span><span className="activity-amount"><b>{item.amount}</b><small>{item.status}</small></span></div>) : <div className="activity-empty"><Activity size={17} /><span><b>No activity yet</b><small>Verified deposits and real transaction events will appear here. Preview approvals stay clearly labelled.</small></span></div>}</div></article>
          </section>

          <footer className="app-footer"><span>© {new Date().getFullYear()} MYRAVEN</span><span>Money moves. Intelligence connects.</span><span>TEST MODE · SOLANA DEVNET ONLY</span></footer>
        </div>
      </section>

      {menuOpen ? <button className="mobile-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" /> : null}
      {approvalOpen ? <div className="modal-backdrop" role="presentation" onClick={() => { setPaymentWindowActive(false); setApprovalOpen(false); }}><section className="approval-modal" role="dialog" aria-modal="true" aria-labelledby="approval-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => { setPaymentWindowActive(false); setApprovalOpen(false); }} aria-label="Close"><X size={18} /></button><span className="panel-kicker">DEVNET TRANSFER REVIEW</span><h2 id="approval-title">Review before you send</h2><p>Real SOL will move on Solana Devnet after you confirm. This is test-network SOL, not mainnet funds.</p><div className="review-rows"><span>Recipient <b>{recipientProfile?.displayName ?? (recipientType === "solana" ? "External Solana wallet" : recipientType === "local-bank" ? "Local bank payout" : "Not verified")}</b></span><span>Recipient check <b>{recipientProfile ? "MYRAVEN profile matched" : recipientLookupStatus || "Not checked"}</b></span><span>Identifier <b>{recipientReference || "Not provided"}</b></span><span>You send <b>{Number(amount).toLocaleString("en-US", { maximumFractionDigits: 8 })} SOL</b></span><span>Route <b>MYRAVEN internal transfer · Solana Devnet</b></span><span>Network fee <b>Deducted by Solana at confirmation</b></span><span>Recipient receives <b>{Number(amount).toLocaleString("en-US", { maximumFractionDigits: 8 })} SOL</b></span></div>{transferMessage ? <div className="approval-result"><Check size={16} /> {transferMessage}</div> : <div className="approval-result"><LockKeyhole size={16} /> Ready to submit a real Devnet SOL transfer to the verified MYRAVEN wallet.</div>}{paymentWindowActive ? <div className="approval-result"><LockKeyhole size={16} /> Payment will be submitted in <b>{String(Math.floor(paymentWindowSeconds / 60)).padStart(2, "0")}:{String(paymentWindowSeconds % 60).padStart(2, "0")}</b>. Review the details or cancel below.</div> : null}<button className="primary-action" type="button" onClick={() => paymentWindowActive ? undefined : startPaymentSafetyWindow()} disabled={transferSending || approved || !recipientProfile || paymentWindowActive}>{transferSending ? "Submitting…" : approved ? "Transfer submitted" : paymentWindowActive ? "Safety window active…" : "Authorize · start 60-second window"} <ArrowUpRight size={15} /></button>{paymentWindowActive ? <button className="cancel-review" type="button" onClick={() => { setPaymentWindowActive(false); setPaymentWindowSeconds(60); setTransferMessage("Payment cancelled during the safety window. No funds were sent."); }}>Cancel payment</button> : <button className="cancel-review" type="button" onClick={() => setApprovalOpen(false)}>Go back</button>}</section></div> : null}
    </main>
  );
}
