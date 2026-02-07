import React, { useState, useContext, useEffect } from "react";
import { Principal } from "@dfinity/principal";
import { token } from "../../../declarations/token";
import { AuthContext } from "../index";
import { getAuthedActors } from "../icpAuth";

function TokenWallet() {
  const { isAuthenticated, principal } = useContext(AuthContext);

  const [faucetDisabled, setFaucetDisabled] = useState(false);
  const [faucetText, setFaucetText] = useState("Claim DANG");

  const [balanceInput, setBalanceInput] = useState("");
  const [balanceResult, setBalanceResult] = useState("");
  const [cryptoSymbol, setCryptoSymbol] = useState("");
  const [balanceHidden, setBalanceHidden] = useState(true);
  const [myBalance, setMyBalance] = useState("");

  const [recipientId, setRecipientId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferHidden, setTransferHidden] = useState(true);
  const [transferFeedback, setTransferFeedback] = useState("");
  const [transferDisabled, setTransferDisabled] = useState(false);

  const [transactions, setTransactions] = useState([]);
  const [statementLoading, setStatementLoading] = useState(false);

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

  const loadTransactions = async () => {
    if (!isAuthenticated || !principal) return;
    try {
      setStatementLoading(true);
      const { token: authedToken } = await getAuthedActors();
      const symbol = await authedToken.getSymbol();
      setCryptoSymbol(symbol);
      const txs = await authedToken.getTransactions(principal);
      const sortedTxs = [...txs].sort((a, b) => Number(b.timestamp - a.timestamp));
      setTransactions(sortedTxs);
    } catch (error) {
      console.error("Error loading transactions:", error);
      setTransactions([]);
    } finally {
      setStatementLoading(false);
    }
  };

  async function handleFaucetClick() {
    if (!isAuthenticated || !principal) {
      setFaucetText("Login to claim");
      return;
    }
    try {
      setFaucetDisabled(true);
      const { token: authedToken } = await getAuthedActors();
      const result = await authedToken.payOut();
      setFaucetText(result);
      const balance = await authedToken.balanceOf(principal);
      const symbol = await authedToken.getSymbol();
      setMyBalance(`${balance.toLocaleString()} ${symbol}`);
      loadTransactions();
    } catch (error) {
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
      setBalanceResult("Error");
      setCryptoSymbol("");
      setBalanceHidden(false);
    }
  }

  async function handleTransfer() {
    if (!isAuthenticated) {
      setTransferFeedback("Please login to transfer");
      setTransferHidden(false);
      return;
    }
    setTransferHidden(true);
    setTransferDisabled(true);
    try {
      const { token: authedToken } = await getAuthedActors();
      const recipient = Principal.fromText(recipientId);
      const result = await authedToken.transfer(recipient, Number(transferAmount));
      setTransferFeedback(result);
      if (principal) {
        const balance = await authedToken.balanceOf(principal);
        const symbol = await authedToken.getSymbol();
        setMyBalance(`${balance.toLocaleString()} ${symbol}`);
        loadTransactions();
      }
      setTransferHidden(false);
      setTransferDisabled(false);
    } catch (error) {
      setTransferFeedback("Error: " + error.message);
      setTransferHidden(false);
      setTransferDisabled(false);
    }
  }

  return (
    <div className="wallet-modern">
      <div className="wallet-modern-inner">
        <h2 className="wallet-modern-title">DANG Wallet</h2>
        <p className="wallet-modern-subtitle">Manage your DANG tokens</p>

        {isAuthenticated && principal && (
          <div className="wallet-principal-wrap">
            <div className="wallet-principal-box">
              <span className="wallet-principal-label">Principal</span>
              <code className="wallet-principal-value" title={principal.toText()}>{principal.toText()}</code>
            </div>
          </div>
        )}

        <div className="wallet-cards-grid">
        {/* Balance Card */}
        <div className="wallet-card wallet-card-balance">
          <div className="wallet-card-icon">◆</div>
          <h3 className="wallet-card-title">Your Balance</h3>
          {isAuthenticated && myBalance ? (
            <p className="wallet-balance-amount">{myBalance}</p>
          ) : (
            <p className="wallet-balance-placeholder">Login to view balance</p>
          )}
          <button
            className="wallet-btn wallet-btn-primary"
            onClick={handleFaucetClick}
            disabled={faucetDisabled || !isAuthenticated}
            style={{display: "none"}}
          >
            {faucetText}
          </button>
          <p className="wallet-card-hint">Earn DANG by completing quizzes</p>
        </div>

        {/* Check Balance */}
        <div className="wallet-card wallet-card-check">
          <h3 className="wallet-card-title">Check Balance</h3>
          <p className="wallet-card-desc">Enter a Principal ID to look up balance</p>
          <input
            type="text"
            className="wallet-input"
            placeholder="Principal ID"
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value)}
          />
          <button className="wallet-btn wallet-btn-secondary" onClick={handleCheckBalance}>
            Check
          </button>
          {!balanceHidden && (
            <p className="wallet-result">
              Balance: {balanceResult} {cryptoSymbol}
            </p>
          )}
        </div>

        {/* Transfer */}
        <div className="wallet-card wallet-card-transfer">
          <h3 className="wallet-card-title">Transfer</h3>
          <p className="wallet-card-desc">Send DANG to another principal</p>
          <input
            type="text"
            className="wallet-input"
            placeholder="Recipient Principal ID"
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
          />
          <input
            type="number"
            className="wallet-input"
            placeholder="Amount"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
          />
          <button
            className="wallet-btn wallet-btn-primary"
            onClick={handleTransfer}
            disabled={transferDisabled}
          >
            Transfer
          </button>
          {!transferHidden && (
            <p className={`wallet-result ${transferFeedback.includes("Error") ? "wallet-result-error" : "wallet-result-success"}`}>
              {transferFeedback}
            </p>
          )}
        </div>

        {/* Transactions */}
        <div className="wallet-card wallet-card-transactions">
          <h3 className="wallet-card-title">Transaction History</h3>
          {!isAuthenticated ? (
            <p className="wallet-empty">Login to view transactions</p>
          ) : statementLoading ? (
            <div className="wallet-loading">
              <div className="lds-ellipsis">
                <div></div><div></div><div></div><div></div>
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <p className="wallet-empty">No transactions yet</p>
          ) : (
            <>
              <div className="wallet-transactions-wrap scroll-area-inner">
                <table className="wallet-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const desc = (tx.description || "").toLowerCase();
                      const isCredit = desc.includes("credit");
                      const isDebit = desc.includes("debit");
                      const date = new Date(Number(tx.timestamp) / 1_000_000);
                      return (
                        <tr key={tx.id}>
                          <td>{date.toLocaleDateString()} {date.toLocaleTimeString()}</td>
                          <td>{tx.description}</td>
                          <td className={isCredit ? "wallet-amount-credit" : isDebit ? "wallet-amount-debit" : ""}>
                            {isCredit ? "+" : isDebit ? "−" : ""}{tx.amount.toLocaleString()} {cryptoSymbol || "DANG"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button className="wallet-btn wallet-btn-ghost" onClick={loadTransactions}>
                Refresh
              </button>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

export default TokenWallet;
