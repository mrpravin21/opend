import React, { useState, useContext, useEffect } from "react";
import { Principal } from "@dfinity/principal";
import { token } from "../../../declarations/token";
import { AuthContext } from "../index";
import { getAuthedActors } from "../icpAuth";

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
  const { isAuthenticated, principal } = useContext(AuthContext);
  
  // ---- Faucet state ----
  const [faucetDisabled, setFaucetDisabled] = useState(false);
  const [faucetText, setFaucetText] = useState("Gimme gimme");

  // ---- Balance state ----
  const [balanceInput, setBalanceInput] = useState("");
  const [balanceResult, setBalanceResult] = useState("");
  const [cryptoSymbol, setCryptoSymbol] = useState("");
  const [balanceHidden, setBalanceHidden] = useState(true);
  const [myBalance, setMyBalance] = useState("");

  // ---- Transfer state ----
  const [recipientId, setRecipientId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferHidden, setTransferHidden] = useState(true);
  const [transferFeedback, setTransferFeedback] = useState("");
  const [transferDisabled, setTransferDisabled] = useState(false);

  // ---- Statement state ----
  const [transactions, setTransactions] = useState([]);
  const [statementLoading, setStatementLoading] = useState(false);

  // Load current user's balance and transactions if authenticated
  useEffect(() => {
    async function loadMyBalance() {
      if (isAuthenticated && principal) {
        try {
          let tokenActor = token;
          if (isAuthenticated) {
            const { token: authedToken } = await getAuthedActors();
            tokenActor = authedToken;
          }
          const balance = await tokenActor.balanceOf(principal);
          const symbol = await tokenActor.getSymbol();
          setMyBalance(`${balance.toLocaleString()} ${symbol}`);
        } catch (error) {
          console.error("Error loading balance:", error);
        }
      }
    }
    loadMyBalance();
    loadTransactions();
  }, [isAuthenticated, principal]);

  // Load transactions for the current user
  const loadTransactions = async () => {
    if (!isAuthenticated || !principal) {
      return;
    }

    try {
      setStatementLoading(true);
      const { token: authedToken } = await getAuthedActors();
      const symbol = await authedToken.getSymbol();
      setCryptoSymbol(symbol);
      const txs = await authedToken.getTransactions(principal);
      // Sort by timestamp (newest first)
      const sortedTxs = [...txs].sort((a, b) => Number(b.timestamp - a.timestamp));
      setTransactions(sortedTxs);
    } catch (error) {
      console.error("Error loading transactions:", error);
      setTransactions([]);
    } finally {
      setStatementLoading(false);
    }
  };

  // ---- Handlers ----
  async function handleFaucetClick() {
    if (!isAuthenticated || !principal) {
      setFaucetText("Please login to claim tokens");
      return;
    }

    try {
      setFaucetDisabled(true);
      // Use authenticated actors to ensure tokens go to the logged-in user
      const { token: authedToken } = await getAuthedActors();
      const result = await authedToken.payOut();
      console.log("payout: " + result);
      setFaucetText(result);
      
      // Refresh balance and transactions after claiming
      const balance = await authedToken.balanceOf(principal);
      const symbol = await authedToken.getSymbol();
      setMyBalance(`${balance.toLocaleString()} ${symbol}`);
      loadTransactions();
    } catch (error) {
      console.error("Faucet error:", error);
      setFaucetText("Error: " + error.message);
    } finally {
      setFaucetDisabled(false);
    }
  }

  async function handleCheckBalance() {
    try {
      const principalToCheck = Principal.fromText(balanceInput);
      let tokenActor = token;
      if (isAuthenticated) {
        const { token: authedToken } = await getAuthedActors();
        tokenActor = authedToken;
      }
      const balance = await tokenActor.balanceOf(principalToCheck);
      const symbol = await tokenActor.getSymbol();
      setBalanceResult(balance.toLocaleString());
      setCryptoSymbol(symbol);
      setBalanceHidden(false);
    } catch (error) {
      console.error("Balance check error:", error);
      setBalanceResult("Error");
      setCryptoSymbol("");
      setBalanceHidden(false);
    }
  }

  async function handleTransfer() {
    if (!isAuthenticated) {
      setTransferFeedback("Please login to transfer tokens");
      setTransferHidden(false);
      return;
    }

    setTransferHidden(true);
    setTransferDisabled(true);

    try {
      const { token: authedToken } = await getAuthedActors();
      const recipient = Principal.fromText(recipientId);
      const amountToTransfer = Number(transferAmount);

      const result = await authedToken.transfer(recipient, amountToTransfer);
      setTransferFeedback(result);

      // Refresh balance and transactions after transfer
      if (principal) {
        const balance = await authedToken.balanceOf(principal);
        const symbol = await authedToken.getSymbol();
        setMyBalance(`${balance.toLocaleString()} ${symbol}`);
        loadTransactions();
      }

      setTransferHidden(false);
      setTransferDisabled(false);
    } catch (error) {
      console.error("Transfer error:", error);
      setTransferFeedback("Error: " + error.message);
      setTransferHidden(false);
      setTransferDisabled(false);
    }
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
        <label>
          Get your DANG tokens here! Claim 10,000 DANG tokens{" "}
          {isAuthenticated && principal
            ? `to ${principal.toText().substring(0, 8)}...`
            : "(Login required)"}
        </label>
        {isAuthenticated && myBalance && (
          <p style={{ marginTop: "10px", fontWeight: "bold" }}>
            Your Balance: {myBalance}
          </p>
        )}
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

      {/* Statement (Transaction History) */}
      <div className="window white">
        <h2>
          <span role="img" aria-label="statement emoji">
            📊
          </span>
          {" "}Statement
        </h2>
        {!isAuthenticated ? (
          <p>Please login to view your transaction history</p>
        ) : statementLoading ? (
          <p>Loading transactions...</p>
        ) : transactions.length === 0 ? (
          <p>No transactions found</p>
        ) : (
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #000", textAlign: "left" }}>
                  <th style={{ padding: "8px" }}>Date</th>
                  <th style={{ padding: "8px" }}>Description</th>
                  <th style={{ padding: "8px", textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, index) => {
                  const isDebit = tx.description.includes("debited");
                  const isCredit = tx.description.includes("credited");
                  const date = new Date(Number(tx.timestamp) / 1_000_000);
                  const formattedDate = date.toLocaleDateString() + " " + date.toLocaleTimeString();
                  
                  return (
                    <tr key={tx.id} style={{ borderBottom: "1px solid #ccc" }}>
                      <td style={{ padding: "8px", fontSize: "0.9em" }}>{formattedDate}</td>
                      <td style={{ padding: "8px" }}>{tx.description}</td>
                      <td style={{ 
                        padding: "8px", 
                        textAlign: "right",
                        fontWeight: "bold",
                        color: isCredit ? "#00aa00" : isDebit ? "#cc0000" : "#000"
                      }}>
                        {isCredit ? "+" : isDebit ? "-" : ""}{tx.amount.toLocaleString()} {cryptoSymbol || "DANG"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {isAuthenticated && transactions.length > 0 && (
          <p className="trade-buttons" style={{ marginTop: "10px" }}>
            <button onClick={loadTransactions}>
              Refresh
            </button>
          </p>
        )}
      </div>
    </div>
    </div>
  );
}

export default TokenWallet;
