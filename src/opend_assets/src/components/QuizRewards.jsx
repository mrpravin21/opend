import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../index";
import { getAuthedActors } from "../icpAuth";

const QUIZ_API_URL = typeof process !== "undefined" && process.env?.QUIZ_API_URL
  ? process.env.QUIZ_API_URL
  : "http://localhost:3000";

function QuizRewards() {
  const { isAuthenticated, principal, loading } = useContext(AuthContext);
  const [points, setPoints] = useState(0);
  const [loadingPoints, setLoadingPoints] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!loading && isAuthenticated && principal) {
      fetchPoints();
      const interval = setInterval(fetchPoints, 10000);
      return () => clearInterval(interval);
    } else {
      setLoadingPoints(false);
    }
  }, [isAuthenticated, principal, loading]);

  async function fetchPoints() {
    if (!isAuthenticated || !principal) {
      setPoints(0);
      setLoadingPoints(false);
      return;
    }
    try {
      const response = await fetch(`${QUIZ_API_URL}/api/quiz/points?principalId=${principal.toText()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      setPoints(data.points || 0);
      setLoadingPoints(false);
      setError("");
    } catch (err) {
      setError(`Failed to load points: ${err.message}. Ensure quiz service is running at ${QUIZ_API_URL}`);
      setLoadingPoints(false);
    }
  }

  async function handleClaimTokens() {
    if (!isAuthenticated || !principal || points === 0) {
      setError("No points to claim");
      return;
    }
    setClaiming(true);
    setError("");
    setSuccess("");
    try {
      const { token: authedToken } = await getAuthedActors();
      const result = await authedToken.rewardQuiz(BigInt(points));
      if (result === "Success") {
        const resetRes = await fetch(`${QUIZ_API_URL}/api/quiz/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ principalId: principal.toText(), amount: points }),
        });
        if (!resetRes.ok) throw new Error("Failed to reset points");
        setSuccess(`Successfully claimed ${points} DANG tokens!`);
        setPoints(0);
      } else {
        throw new Error(`Transfer failed: ${result}`);
      }
    } catch (err) {
      setError(`Failed to claim: ${err.message}`);
    } finally {
      setClaiming(false);
    }
  }

  function handleStartQuiz() {
    if (!isAuthenticated || !principal) {
      setError("Please login to start quiz");
      return;
    }
    const quizUrl = `${QUIZ_API_URL}/quiz/ic?principalId=${encodeURIComponent(principal.toText())}`;
    window.open(quizUrl, "_blank", "width=1200,height=800");
    setTimeout(fetchPoints, 30000);
  }

  if (loading) {
    return (
      <div className="quiz-page">
        <div className="quiz-container">
          <p className="quiz-label">Loading</p>
          <div className="lds-ellipsis">
            <div></div><div></div><div></div><div></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-page">
      <div className="quiz-container">
        <p className="quiz-label">Quiz Rewards</p>
        <h2 className="quiz-title">Earn DANG Tokens</h2>
        <p className="quiz-subtitle">Complete quizzes to earn points, then claim DANG tokens</p>

        {!isAuthenticated ? (
          <div className="quiz-card quiz-card-auth">
            <p className="quiz-auth-message">Please login to access quiz rewards.</p>
            <p className="quiz-auth-hint">Earn DANG tokens by completing quizzes and use them to purchase NFTs!</p>
          </div>
        ) : (
          <>
            <div className="quiz-card quiz-card-points">
              <h3 className="quiz-points-label">Your Quiz Points</h3>
              {loadingPoints ? (
                <div className="quiz-points-loading">
                  <div className="lds-ellipsis">
                    <div></div><div></div><div></div><div></div>
                  </div>
                </div>
              ) : (
                <p className="quiz-points-value">{points}</p>
              )}
              <p className="quiz-points-hint">1 point = 1 DANG token</p>
            </div>

            {error && <div className="quiz-alert quiz-alert-error">{error}</div>}
            {success && <div className="quiz-alert quiz-alert-success">{success}</div>}

            <div className="quiz-actions">
              <button className="quiz-btn quiz-btn-primary" onClick={handleStartQuiz}>
                Start Quiz
              </button>
              <button
                className="quiz-btn quiz-btn-secondary"
                onClick={handleClaimTokens}
                disabled={points === 0 || claiming}
              >
                {claiming ? "Claiming..." : `Claim ${points} Tokens`}
              </button>
              <button
                className="quiz-btn quiz-btn-ghost"
                onClick={fetchPoints}
                disabled={loadingPoints}
              >
                Refresh
              </button>
            </div>

            <div className="quiz-card quiz-card-info">
              <h3 className="quiz-info-title">How it works</h3>
              <ol className="quiz-info-list">
                <li>Click <strong>Start Quiz</strong> to open the quiz in a new window</li>
                <li>Answer questions correctly to earn points</li>
                <li>Return here and click <strong>Claim Tokens</strong> to convert points to DANG</li>
                <li>Use DANG tokens to purchase NFTs!</li>
              </ol>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default QuizRewards;
