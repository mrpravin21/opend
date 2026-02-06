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
      <div className="minter-container">
        <h3 className="Typography-root makeStyles-title-99 Typography-h3 form-Typography-gutterBottom">
          <span role="img" aria-label="brain emoji" style={{ marginRight: "10px" }}>
            🧠
          </span>
          Quiz Rewards
        </h3>
        <div className="lds-ellipsis" style={{ marginTop: "40px" }}>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>
    );
  }

  return (
    <div className="minter-container">
      <h3 className="Typography-root makeStyles-title-99 Typography-h3 form-Typography-gutterBottom">
        <span role="img" aria-label="brain emoji" style={{ marginRight: "10px" }}>
          🧠
        </span>
        Quiz Rewards
      </h3>

      {!isAuthenticated ? (
        <div style={{ 
          padding: "30px", 
          textAlign: "center",
          color: "#777e90"
        }}>
          <p style={{ fontSize: "1.1rem", marginBottom: "20px" }}>Please login to access quiz rewards.</p>
          <p style={{ fontSize: "0.9rem" }}>Earn DANG tokens by completing quizzes and use them to purchase NFTs!</p>
        </div>
      ) : (
        <div>
          {/* Points Display Card */}
          <div style={{ 
            marginBottom: "30px", 
            padding: "30px", 
            border: "1px solid #353945", 
            borderRadius: "8px", 
            backgroundColor: "#1a1a1a",
            textAlign: "center"
          }}>
            <label style={{ 
              display: "block", 
              marginBottom: "15px", 
              fontWeight: "500",
              fontSize: "0.9rem",
              color: "#777e90",
              textTransform: "uppercase",
              letterSpacing: "1px"
            }}>
              Your Quiz Points
            </label>
            {loadingPoints ? (
              <div className="lds-ellipsis" style={{ marginTop: "20px", marginBottom: "20px" }}>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
              </div>
            ) : (
              <div style={{ 
                fontSize: "3.5rem", 
                fontWeight: "bold", 
                color: "#5f64b5", 
                margin: "20px 0",
                textShadow: "0 0 20px rgba(95, 100, 181, 0.3)"
              }}>
                {points}
              </div>
            )}
            <p style={{ 
              fontSize: "0.95rem", 
              color: "#777e90", 
              marginTop: "15px",
              marginBottom: 0
            }}>
              Earn points by playing quizzes. 1 point = 1 DANG token.
            </p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div style={{ 
              padding: "15px 20px", 
              backgroundColor: "rgba(204, 0, 0, 0.1)", 
              color: "#ff6b6b", 
              borderRadius: "8px", 
              marginBottom: "20px",
              border: "1px solid rgba(204, 0, 0, 0.3)",
              fontSize: "0.9rem"
            }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ 
              padding: "15px 20px", 
              backgroundColor: "rgba(0, 170, 0, 0.1)", 
              color: "#51cf66", 
              borderRadius: "8px", 
              marginBottom: "20px",
              border: "1px solid rgba(0, 170, 0, 0.3)",
              fontSize: "0.9rem",
              fontWeight: "500"
            }}>
              {success}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ 
            display: "flex", 
            gap: "15px", 
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: "40px"
          }}>
            <div className="Chip-root makeStyles-chipBlue-108 Chip-clickable" style={{ marginTop: 0 }}>
              <span onClick={handleStartQuiz} className="form-Chip-label" style={{ cursor: "pointer" }}>
                Start Quiz
              </span>
            </div>
            <div 
              className={`Chip-root makeStyles-chipBlue-108 ${points === 0 || claiming ? '' : 'Chip-clickable'}`}
              style={{ 
                marginTop: 0,
                opacity: (points === 0 || claiming) ? 0.5 : 1,
                cursor: (points === 0 || claiming) ? 'not-allowed' : 'pointer'
              }}
            >
              <span 
                onClick={points === 0 || claiming ? undefined : handleClaimTokens} 
                className="form-Chip-label"
                style={{ cursor: (points === 0 || claiming) ? 'not-allowed' : 'pointer' }}
              >
                {claiming ? "Claiming..." : `Claim ${points} Tokens`}
              </span>
            </div>
            <div 
              className={`Chip-root makeStyles-chipBlue-108 ${loadingPoints ? '' : 'Chip-clickable'}`}
              style={{ 
                marginTop: 0,
                opacity: loadingPoints ? 0.5 : 1,
                cursor: loadingPoints ? 'not-allowed' : 'pointer'
              }}
            >
              <span 
                onClick={loadingPoints ? undefined : fetchPoints} 
                className="form-Chip-label"
                style={{ cursor: loadingPoints ? 'not-allowed' : 'pointer' }}
              >
                Refresh
              </span>
            </div>
          </div>

          {/* Info Section */}
          <div style={{ 
            marginTop: "40px", 
            padding: "25px", 
            border: "1px solid #353945", 
            borderRadius: "8px",
            backgroundColor: "#1a1a1a"
          }}>
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: "20px",
              color: "#fcfcfd",
              fontSize: "1.3rem",
              fontWeight: "500"
            }}>
              How it works:
            </h3>
            <ol style={{ 
              paddingLeft: "25px", 
              margin: 0,
              color: "#777e90",
              lineHeight: "1.8"
            }}>
              <li style={{ marginBottom: "12px", fontSize: "0.95rem" }}>
                Click <span style={{ color: "#5f64b5", fontWeight: "500" }}>"Start Quiz"</span> to open the quiz in a new window
              </li>
              <li style={{ marginBottom: "12px", fontSize: "0.95rem" }}>
                Answer questions correctly to earn points
              </li>
              <li style={{ marginBottom: "12px", fontSize: "0.95rem" }}>
                Return here and click <span style={{ color: "#5f64b5", fontWeight: "500" }}>"Claim Tokens"</span> to convert points to DANG tokens
              </li>
              <li style={{ fontSize: "0.95rem" }}>
                Use your DANG tokens to purchase NFTs!
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuizRewards;
