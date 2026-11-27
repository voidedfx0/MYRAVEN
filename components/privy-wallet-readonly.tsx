"use client";

import { useEffect, useState } from "react";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { Check, Copy, ExternalLink, ShieldCheck, Wallet, RefreshCw } from "lucide-react";

type BalanceState = { loading: boolean; sol?: number; error?: string };

function shortAddress(address: string) {
  return address.length > 18 ? address.slice(0, 8) + "…" + address.slice(-7) : address;
}

export default function PrivyWalletReadOnly() {
  const [message, setMessage] = useState("");
  const [balances, setBalances] = useState<Record<string, BalanceState>>({});
  const [refreshing, setRefreshing] = useState(false);
  const { ready: authReady, authenticated, user, logout } = usePrivy();
  const { login } = useLogin({ onError: (error) => setMessage(String(error)) });
  const { ready: walletsReady, wallets } = useWallets();
  const solanaWallets = wallets;

  async function loadBalances() {
    if (!solanaWallets.length) return;
    setRefreshing(true);
    setBalances(Object.fromEntries(solanaWallets.map((wallet) => [wallet.address, { loading: true }])));
    await Promise.all(solanaWallets.map(async (wallet) => {
      try {
        const response = await fetch("/api/wallets/solana/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: wallet.address }),
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Balance unavailable");
        setBalances((current) => ({ ...current, [wallet.address]: { loading: false, sol: Number(data.sol) } }));
      } catch (error) {
        setBalances((current) => ({
          ...current,
          [wallet.address]: { loading: false, error: error instanceof Error ? error.message : "Balance unavailable" },
        }));
      }
    }));
    setRefreshing(false);
  }

  useEffect(() => {
    if (walletsReady && authenticated && solanaWallets.length) void loadBalances();
  // Refresh when the authenticated wallet list changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletsReady, authenticated, solanaWallets.map((wallet) => wallet.address).join("|")]);

  async function copyAddress(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setMessage("Public address copied.");
    } catch {
      setMessage("Could not copy address in this browser.");
    }
  }

  return (
    <article style={{ margin: "18px 0", padding: 18, border: "1px solid rgba(167,139,250,.24)", borderRadius: 18, background: "linear-gradient(135deg, rgba(124,58,237,.09), rgba(34,211,238,.035))" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <span className="panel-kicker">PRIVY · SOLANA ACCESS</span>
          <h3 style={{ margin: "5px 0", fontSize: 16 }}>Privy wallet connection</h3>
          <p style={{ margin: 0, fontSize: 12, opacity: .72 }}>Linked wallet discovery and public balance checks through Helius. Read-only access.</p>
        </div>
        <span className="read-only-tag"><ShieldCheck size={12} /> READ ONLY</span>
      </div>

      {!authReady ? (
        <p className="receive-address-status">Checking Privy connection…</p>
      ) : !authenticated ? (
        <button className="connect-button" style={{ marginTop: 14 }} onClick={() => login()}>
          <Wallet size={14} /> Continue with Privy <ExternalLink size={13} />
        </button>
      ) : (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, opacity: .8 }}><Check size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />Privy authenticated</span>
            <div style={{ display: "flex", gap: 8 }}>
              {walletsReady && solanaWallets.length > 0 && <button className="disconnect-button" onClick={() => void loadBalances()} disabled={refreshing}><RefreshCw size={12} /> {refreshing ? "Refreshing…" : "Refresh balances"}</button>}
              <button className="disconnect-button" onClick={() => void logout()}>Disconnect Privy</button>
            </div>
          </div>
          <p style={{ margin: "8px 0", fontSize: 12, opacity: .65 }}>Privy user: {user?.id ? shortAddress(user.id) : "Authenticated"}</p>
          {!walletsReady ? (
            <p className="receive-address-status">Loading linked Solana wallets…</p>
          ) : solanaWallets.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {solanaWallets.map((wallet) => {
                const balance = balances[wallet.address];
                return (
                  <div key={wallet.address} className="connected-wallet">
                    <span className="mini-network solana">S</span>
                    <span style={{ minWidth: 0, flex: 1 }}><b>Privy Solana wallet</b><small>{shortAddress(wallet.address)}</small><small>{balance?.loading ? "Checking public balance…" : balance?.error ? balance.error : balance?.sol !== undefined ? balance.sol.toLocaleString("en-US", { maximumFractionDigits: 6 }) + " SOL · public balance" : "Balance not checked yet"}</small></span>
                    <a className="disconnect-button" href={"https://solscan.io/account/" + encodeURIComponent(wallet.address)} target="_blank" rel="noreferrer" aria-label="View wallet on Solscan"><ExternalLink size={13} /> Explorer</a>
                    <button className="disconnect-button" onClick={() => void copyAddress(wallet.address)}><Copy size={13} /> Copy</button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="receive-address-status">No Solana wallet is linked to this Privy identity yet. This panel does not create one.</p>
          )}
        </div>
      )}
      {message ? <p className="wallet-message" role="status">{message}</p> : null}
      <p style={{ margin: "12px 0 0", fontSize: 11, opacity: .58 }}>Privy sign-in is separate from your MYRAVEN account. No wallet is created here, and MYRAVEN does not request signing or transfer permissions.</p>
    </article>
  );
}
