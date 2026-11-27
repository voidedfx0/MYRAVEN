"use client";

import { useState } from "react";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { Check, Copy, ExternalLink, ShieldCheck, Wallet } from "lucide-react";

function shortAddress(address: string) {
  return address.length > 18 ? address.slice(0, 8) + "…" + address.slice(-7) : address;
}

export default function PrivyWalletReadOnly() {
  const [message, setMessage] = useState("");
  const { ready: authReady, authenticated, user, logout } = usePrivy();
  const { login } = useLogin({ onError: (error) => setMessage(String(error)) });
  const { ready: walletsReady, wallets } = useWallets();

  const solanaWallets = wallets;

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
          <p style={{ margin: 0, fontSize: 12, opacity: .72 }}>Read-only wallet discovery. No wallet is created and no transaction can be signed here.</p>
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
            <button className="disconnect-button" onClick={() => void logout()}>Disconnect Privy</button>
          </div>
          <p style={{ margin: "8px 0", fontSize: 12, opacity: .65 }}>Privy user: {user?.id ? shortAddress(user.id) : "Authenticated"}</p>
          {!walletsReady ? (
            <p className="receive-address-status">Loading linked Solana wallets…</p>
          ) : solanaWallets.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {solanaWallets.map((wallet) => (
                <div key={wallet.address} className="connected-wallet">
                  <span className="mini-network solana">S</span>
                  <span><b>Privy Solana wallet</b><small>{shortAddress(wallet.address)}</small></span>
                  <span className="connected-label"><i /> Address visible</span>
                  <button className="disconnect-button" onClick={() => void copyAddress(wallet.address)}><Copy size={13} /> Copy</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="receive-address-status">No Solana wallet is linked to this Privy identity yet. This connection panel does not create one.</p>
          )}
        </div>
      )}
      {message ? <p className="wallet-message" role="status">{message}</p> : null}
      <p style={{ margin: "12px 0 0", fontSize: 11, opacity: .58 }}>Privy sign-in is currently separate from your MYRAVEN account. Account linking and wallet provisioning are not enabled.</p>
    </article>
  );
}
