import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../index";
import { getAuthedActors } from "../icpAuth";

// Quiz API URL - Defaults to localhost:3000, can be overridden via environment variable
const QUIZ_API_URL = typeof process !== 'undefined' && process.env?.QUIZ_API_URL 
  ? process.env.QUIZ_API_URL 
  : "http://localhost:3000";

function QuizRewards() {
  const { isAuthenticated, principal, loading } = useContext(AuthContext);
  const [points, setPoints] = useState(0);
  const [loadingPoints, setLoadingPoints] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch quiz points for the current principal
  useEffect(() => {
    if (!loading && isAuthenticated && principal) {
      fetchPoints();
      // Poll for points every 10 seconds
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
      const principalId = principal.toText();
      const response = await fetch(`${QUIZ_API_URL}/api/quiz/points?principalId=${principalId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setPoints(data.points || 0);
      setLoadingPoints(false);
      setError(""); // Clear any previous errors on success
    } catch (error) {
      console.error("Error fetching quiz points:", error);
      const errorMessage = error.message || "Unknown error";
      setError(`Failed to load quiz points: ${errorMessage}. Make sure the quiz service is running at ${QUIZ_API_URL}`);
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
      const principalId = principal.toText();
      const { token: authedToken } = await getAuthedActors();

      // Transfer tokens (1 point = 1 token) using rewardQuiz function
      const tokenAmount = BigInt(points);
      
      // Use rewardQuiz to transfer from owner's balance to user
      const transferResult = await authedToken.rewardQuiz(tokenAmount);

      if (transferResult === "Success") {
        // Reset points in quiz service
        const resetResponse = await fetch(`${QUIZ_API_URL}/api/quiz/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            principalId,
            amount: points
          })
        });

        if (!resetResponse.ok) {
          throw new Error("Failed to reset points in quiz service");
        }

        setSuccess(`Successfully claimed ${points} DANG tokens!`);
        setPoints(0);
      } else {
        throw new Error(`Token transfer failed: ${transferResult}`);
      }
    } catch (error) {
      console.error("Error claiming tokens:", error);
      setError(`Failed to claim tokens: ${error.message}`);
    } finally {
      setClaiming(false);
    }
  }

  function handleStartQuiz() {
    if (!isAuthenticated || !principal) {
      setError("Please login to start quiz");
      return;
    }

    const principalId = principal.toText();
    // Open quiz in new window/tab with Principal ID
    const quizUrl = `${QUIZ_API_URL}/quiz/ic?principalId=${encodeURIComponent(principalId)}`;
    window.open(quizUrl, "_blank", "width=1200,height=800");
    
    // Start polling for new points after a delay (user might complete quiz)
    setTimeout(() => {
      fetchPoints();
    }, 30000); // Check after 30 seconds
  }

  if (loading) {
    return (
      <div className="window white">
        <h2>
          <span role="img" aria-label="brain emoji">
            🧠
          </span>
          {" "}Quiz Rewards
        </h2>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="window white">
      <h2>
        <span role="img" aria-label="brain emoji">
          🧠
        </span>
        {" "}Quiz Rewards
      </h2>

      {!isAuthenticated ? (
        <div>
          <p>Please login to access quiz rewards.</p>
        </div>
      ) : (
        <div>
          {/* Points Display */}
          <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #353945", borderRadius: "4px", backgroundColor: "#1a1a1a" }}>
            <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>Your Quiz Points</label>
            {loadingPoints ? (
              <p>Loading points...</p>
            ) : (
              <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#5f64b5", margin: "10px 0" }}>
                {points} {points === 1 ? "point" : "points"}
              </div>
            )}
            <p style={{ fontSize: "0.9rem", color: "#888", marginTop: "10px" }}>
              Earn points by playing quizzes. 1 point = 1 DANG token.
            </p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div style={{ 
              padding: "10px", 
              backgroundColor: "#2d1b1b", 
              color: "#ff6b6b", 
              borderRadius: "4px", 
              marginBottom: "15px",
              border: "1px solid #cc0000"
            }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ 
              padding: "10px", 
              backgroundColor: "#1b2d1b", 
              color: "#51cf66", 
              borderRadius: "4px", 
              marginBottom: "15px",
              border: "1px solid #00aa00"
            }}>
              {success}
            </div>
          )}

          {/* Actions */}
          <div className="trade-buttons">
            <button
              id="btn-start-quiz"
              onClick={handleStartQuiz}
            >
              Start Quiz
            </button>
            <button
              id="btn-claim-tokens"
              onClick={handleClaimTokens}
              disabled={points === 0 || claiming}
            >
              {claiming ? "Claiming..." : `Claim ${points} Tokens`}
            </button>
            <button
              id="btn-refresh-points"
              onClick={fetchPoints}
              disabled={loadingPoints}
            >
              Refresh
            </button>
          </div>

          {/* Info Section */}
          <div style={{ 
            marginTop: "30px", 
            padding: "15px", 
            border: "1px solid #353945", 
            borderRadius: "4px",
            backgroundColor: "#1a1a1a"
          }}>
            <h3 style={{ marginTop: 0, marginBottom: "10px" }}>How it works:</h3>
            <ol style={{ paddingLeft: "20px", margin: 0 }}>
              <li style={{ marginBottom: "8px" }}>Click "Start Quiz" to open the quiz in a new window</li>
              <li style={{ marginBottom: "8px" }}>Answer questions correctly to earn points</li>
              <li style={{ marginBottom: "8px" }}>Return here and click "Claim Tokens" to convert points to DANG tokens</li>
              <li>Use your DANG tokens to purchase NFTs!</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuizRewards;
