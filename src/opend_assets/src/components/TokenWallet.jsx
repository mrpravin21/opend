import React, { useState } from "react";
import { Principal } from "@dfinity/principal";
import { token } from "../../../declarations/token";

/**
 * TokenWallet
 * Consolidated single-file version of:
 * - Header
 * - Faucet
 * - Balance
 * - Transfer
 *
 * Intended to be embedded inside opend_assets' existing App.jsx.
 */
function TokenWallet() {
  // ---- Faucet state ----
  const [faucetDisabled, setFaucetDisabled] = useState(false);
  const [faucetText, setFaucetText] = useState("Gimme gimme");

  // ---- Balance state ----
  const [balanceInput, setBalanceInput] = useState("");
  const [balanceResult, setBalanceResult] = useState("");
  const [cryptoSymbol, setCryptoSymbol] = useState("");
  const [balanceHidden, setBalanceHidden] = useState(true);

  // ---- Transfer state ----
  const [recipientId, setRecipientId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferHidden, setTransferHidden] = useState(true);
  const [transferFeedback, setTransferFeedback] = useState("");
  const [transferDisabled, setTransferDisabled] = useState(false);

  // ---- Handlers ----
  async function handleFaucetClick() {
    setFaucetDisabled(true);
    const result = await token.payOut();
    console.log("payout: " + result);
    setFaucetText(result);
  }

  async function handleCheckBalance() {
    const principal = Principal.fromText(balanceInput);
    const balance = await token.balanceOf(principal);
    setBalanceResult(balance.toLocaleString());
    setCryptoSymbol(await token.getSymbol());
    setBalanceHidden(false);
  }

  async function handleTransfer() {
    setTransferHidden(true);
    setTransferDisabled(true);

    const recipient = Principal.fromText(recipientId);
    const amountToTransfer = Number(transferAmount);

    const result = await token.transfer(recipient, amountToTransfer);
    setTransferFeedback(result);

    setTransferHidden(false);
    setTransferDisabled(false);
  }

  return (
    <div className="wallet-scope">
    <div id="screen">
      {/* Header (from Header.jsx) */}
      <header>
        <div className="blue window" id="logo">
          <h1>
            <span role="img" aria-label="tap emoji">
              💎
            </span>
            MintVault Wallet
          </h1>
        </div>
      </header>

      {/* Faucet (from Faucet.jsx) */}
      <div className="blue window">
        <h2>
          <span role="img" aria-label="tap emoji">
            🚰
          </span>
          Faucet
        </h2>
        <label>Get your DANG tokens here! Claim 10,000 DANG tokens to 2vxsx-fae</label>
        <p className="trade-buttons">
          <button id="btn-payout" onClick={handleFaucetClick} disabled={faucetDisabled}>
            {faucetText}
          </button>
        </p>
      </div>

      {/* Balance (from Balance.jsx) */}
      <div className="window white">
        <label>Check account token balance:</label>
        <p>
          <input
            id="balance-principal-id"
            type="text"
            placeholder="Enter a Principal ID"
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value)}
          />
        </p>
        <p className="trade-buttons">
          <button id="btn-request-balance" onClick={handleCheckBalance}>
            Check Balance
          </button>
        </p>
        <p hidden={balanceHidden}>
          This account has a balance of {balanceResult} {cryptoSymbol}.
        </p>
      </div>

      {/* Transfer (from Transfer.jsx) */}
      <div className="window white">
        <div className="transfer">
          <fieldset>
            <legend>To Account:</legend>
            <ul>
              <li>
                <input
                  type="text"
                  id="transfer-to-id"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                />
              </li>
            </ul>
          </fieldset>

          <fieldset>
            <legend>Amount:</legend>
            <ul>
              <li>
                <input
                  type="number"
                  id="amount"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                />
              </li>
            </ul>
          </fieldset>

          <p className="trade-buttons">
            <button id="btn-transfer" onClick={handleTransfer} disabled={transferDisabled}>
              Transfer
            </button>
          </p>

          <p hidden={transferHidden}>{transferFeedback}</p>
        </div>
      </div>
    </div>
    </div>
  );
}

export default TokenWallet;
