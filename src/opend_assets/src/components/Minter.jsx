import React, { useState, useContext, useEffect } from "react";
import { useForm } from "react-hook-form";
import { opend } from "../../../declarations/opend";
import { Principal } from "@dfinity/principal";
import Item from "./Item";
import { AuthContext } from "../index";
import { getAuthedActors } from "../icpAuth";
import { NFTRefreshContext } from "./Header";

// Quiz API URL - same as used in QuizRewards
const QUIZ_API_URL = typeof process !== 'undefined' && process.env?.QUIZ_API_URL 
  ? process.env.QUIZ_API_URL 
  : "http://localhost:3000";

function OriginalityLayerCharts({ layers, currentStage, isChecking, finalApproved, finalMessage, similarNft, originalityScore, similarityScore }) {
  const layerList = [1, 2, 3].map((i) => {
    const layer = layers?.[`layer${i}`];
    if (!layer) return null;
    const isPassed = layer.passed === true;
    const isFailed = layer.passed === false;
    const isPending = layer.passed === null;
    const isCurrent = currentStage === i && isChecking;
    const score = layer.scorePercent != null ? layer.scorePercent : 0;
    return { i, layer, isPassed, isFailed, isPending, isCurrent, score };
  }).filter(Boolean);

  return (
    <div className="originality-charts-card">
      <div className="originality-charts-header">
        <span className="originality-charts-title">Originality verification</span>
        {finalApproved !== undefined && finalApproved !== null && (
          <span className={`originality-charts-badge ${finalApproved ? 'passed' : 'failed'}`}>
            {finalApproved ? '✓ Passed' : '✕ Failed'}
          </span>
        )}
      </div>
      {finalMessage && finalApproved !== undefined && (
        <p className="originality-charts-summary">{finalMessage}</p>
      )}
      {finalApproved === true && (originalityScore != null || similarityScore != null) && (
        <div className="originality-scores-row">
          <span className="originality-score-badge originality">Originality: {originalityScore ?? '—'}%</span>
          <span className="originality-score-badge similarity">Similarity: {similarityScore ?? '0'}%</span>
        </div>
      )}
      {finalApproved === false && similarNft && (
        <div className="originality-existing-nft">
          <strong>Similar NFT:</strong> "{similarNft.name || 'Unknown'}"
          {similarNft.nft_principal_id && (
            <span> (ID: {similarNft.nft_principal_id.substring(0, 20)}...)</span>
          )}
        </div>
      )}
      {finalApproved === false && (
        <div className="originality-blocked-badge">⛔ Minting blocked</div>
      )}
      <div className="originality-charts-bars">
        {layerList.map(({ i, layer, isPassed, isFailed, isPending, isCurrent, score }) => (
          <div
            key={i}
            className={`originality-chart-row ${isPassed ? 'passed' : ''} ${isFailed ? 'failed' : ''} ${isPending ? 'pending' : ''} ${isCurrent ? 'checking' : ''}`}
          >
            <div className="originality-chart-label">
              <span className="originality-chart-lnum">L{i}</span>
              <span className="originality-chart-name">{layer.name}</span>
            </div>
            <div className="originality-chart-bar-wrap">
              <div
                className="originality-chart-bar-fill"
                style={{
                  width: isCurrent ? '40%' : (isPending ? '0%' : `${Math.min(100, Math.max(0, score))}%`),
                  backgroundColor: isFailed ? '#dc3545' : isPassed ? '#28a745' : isCurrent ? 'var(--purple)' : '#555',
                }}
              />
              <div className="originality-chart-bar-bg" />
            </div>
            <div className="originality-chart-value">
              {isPending && !isCurrent ? '—' : isCurrent ? '...' : `${Number(score).toFixed(1)}%`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Minter() {
  const { isAuthenticated, principal } = useContext(AuthContext);
  const { refreshNFTs } = useContext(NFTRefreshContext);
  const { register, handleSubmit } = useForm();
  const [nftPrincipal, setNFTPrincipal] = useState("");
  const [loaderHidden, setLoaderHidden] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [cyclesWarning, setCyclesWarning] = useState("");
  const [originalityCheckResult, setOriginalityCheckResult] = useState(null);
  const [originalityChecking, setOriginalityChecking] = useState(false);
  const [originalityLiveLayers, setOriginalityLiveLayers] = useState(null); // Progressive layer state during check

  async function checkCycles() {
    try {
      const { opend: authedOpend } = await getAuthedActors();
      const canMintResult = await authedOpend.canMint();
      const currentBalance = await authedOpend.getCyclesBalance();
      const requiredCycles = await authedOpend.getRequiredCyclesForMint();
      
      // Format cycles for display (convert to TC - trillion cycles)
      const balanceTC = Number(currentBalance) / 1_000_000_000_000;
      const requiredTC = Number(requiredCycles) / 1_000_000_000_000;
      
      if (!canMintResult) {
        setCyclesWarning(
          `⚠️ Insufficient cycles! Current: ${balanceTC.toFixed(3)} TC, Required: ${requiredTC.toFixed(3)} TC. ` +
          `Please top up the canister with cycles using: dfx wallet send $(dfx canister id opend) ${requiredTC.toFixed(0)}_000_000_000_000`
        );
        return false;
      } else {
        setCyclesWarning("");
        // Show info if balance is getting low
        if (balanceTC < requiredTC * 2) {
          setCyclesWarning(
            `ℹ️ Low cycles: ${balanceTC.toFixed(3)} TC remaining. You can mint ~${Math.floor(balanceTC / requiredTC)} more NFTs.`
          );
        }
        return true;
      }
    } catch (error) {
      console.error("Error checking cycles:", error);
      // Don't block minting if check fails, but log it
      return true;
    }
  }

  // Check originality in 3 stages for live UI updates
  async function checkOriginality(imageFile, name) {
    if (!isAuthenticated || !principal) return null;

    const appendForm = (stage) => {
      const fd = new FormData();
      fd.append('image', imageFile);
      fd.append('principalId', principal.toText());
      fd.append('name', name);
      fd.append('stage', String(stage));
      return fd;
    };

    const fetchStage = async (stage) => {
      const res = await fetch(`${QUIZ_API_URL}/api/nft/check-originality`, {
        method: 'POST',
        body: appendForm(stage),
      });
      if (!res.ok) throw new Error(`Stage ${stage} failed: ${res.statusText}`);
      return res.json();
    };

    try {
      setOriginalityChecking(true);
      setOriginalityCheckResult(null);
      setOriginalityLiveLayers(null);

      // Stage 1
      setOriginalityLiveLayers({ stage: 1, layers: null, checking: true });
      const r1 = await fetchStage(1);
      setOriginalityLiveLayers({ stage: 1, result: r1, layers: r1.layers, checking: false });
      if (r1.approved === false) {
        setOriginalityLiveLayers(null);
        setOriginalityCheckResult(r1);
        return r1;
      }

      // Stage 2
      setOriginalityLiveLayers({ stage: 2, result: r1, layers: r1.layers, checking: true });
      const r2 = await fetchStage(2);
      setOriginalityLiveLayers({ stage: 2, result: r2, layers: r2.layers, checking: false });

      // Stage 3 (final)
      setOriginalityLiveLayers({ stage: 3, result: r2, layers: r2.layers, checking: true });
      const r3 = await fetchStage(3);
      setOriginalityLiveLayers(null);
      setOriginalityCheckResult(r3);
      return r3;
    } catch (error) {
      console.error("Error checking originality:", error);
      setOriginalityLiveLayers(null);
      setOriginalityCheckResult({
        approved: null,
        reason: 'error',
        message: 'Originality check unavailable. Proceeding with mint.',
        error: error.message,
      });
      return null;
    } finally {
      setOriginalityChecking(false);
    }
  }

  // Store NFT metadata after successful minting
  async function storeNFTMetadata(nftPrincipalId, name, imageArrayBuffer, checkResult) {
    if (!isAuthenticated || !principal) {
      return;
    }

    try {
      // Convert Uint8Array to base64 for storage (without using Buffer)
      const uint8Array = new Uint8Array(imageArrayBuffer);
      const binaryString = Array.from(uint8Array)
        .map(byte => String.fromCharCode(byte))
        .join('');
      const imageBase64 = btoa(binaryString);

      const metadata = {
        nftPrincipalId: nftPrincipalId,
        mintedByPrincipal: principal.toText(),
        name: name,
        imageData: imageBase64,
        imageHash: checkResult?.imageHash || null,
        phash: checkResult?.phash || null,
        embedding: checkResult?.embedding || null,
        embedding_model: checkResult?.embedding_model || 'simple',
        originalityScore: checkResult?.originalityScore ? parseFloat(checkResult.originalityScore) : null,
        similarityScore: checkResult?.similarityScore ? parseFloat(checkResult.similarityScore) : null,
        mostSimilarNftPrincipalId: checkResult?.mostSimilarNft?.nft_principal_id || null,
      };

      console.log("Storing metadata with phash length:", checkResult?.phash?.length, "embedding:", checkResult?.embedding ? "present" : "null");

      const response = await fetch(`${QUIZ_API_URL}/api/nft/store-metadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      });

      if (!response.ok) {
        console.warn("Failed to store NFT metadata:", response.statusText);
        // Don't fail the mint if metadata storage fails
      } else {
        console.log("NFT metadata stored successfully");
      }
    } catch (error) {
      console.error("Error storing NFT metadata:", error);
      // Don't fail the mint if metadata storage fails
    }
  }

  async function onSubmit(data) {
    if (!isAuthenticated || !principal) {
      setErrorMessage("Please login to mint NFTs");
      return;
    }

    setLoaderHidden(false);
    setErrorMessage("");
    setCyclesWarning("");
    setOriginalityCheckResult(null);

    try {
      // Check cycles before proceeding
      const hasEnoughCycles = await checkCycles();
      if (!hasEnoughCycles) {
        setLoaderHidden(true);
        setErrorMessage("Cannot mint NFT: Insufficient cycles in canister. Please top up cycles first.");
        return;
      }

      const name = data.name;
      const image = data.image[0];
      const imageArray = await image.arrayBuffer();
      const imageByteData = [...new Uint8Array(imageArray)];

      // Check originality before minting (blocking if duplicate found)
      let originalityResult = null;
      try {
        originalityResult = await checkOriginality(image, name);
        
        console.log("Originality check completed:", originalityResult);
        
        // If originality check explicitly rejected (duplicate found), block minting
        if (originalityResult && originalityResult.approved === false) {
          // Duplicate or derivative detected - block minting
          console.log("Duplicate detected - blocking mint");
          setLoaderHidden(true);

          const existingNftInfo = originalityResult.existingNft
            ? ` Existing NFT: "${originalityResult.existingNft.name || 'Unknown'}"`
            : '';

          const originalityInfo =
            originalityResult.originalityScore || originalityResult.similarityScore
              ? ` Originality: ${originalityResult.originalityScore || 'N/A'}%, Similarity: ${originalityResult.similarityScore || 'N/A'}%.`
              : '';

          //setErrorMessage(
            //`Cannot mint NFT: ${originalityResult.message}.${existingNftInfo}${originalityInfo} ` +
           // `Minting has been blocked to prevent duplicates.`
          //);
          return; // Stop minting process
        }
        
        // If originality check passed or was null (API error), proceed
        if (originalityResult && originalityResult.approved === true) {
          console.log("Originality check passed - proceeding with mint");
        } else if (!originalityResult) {
          console.warn("Originality check returned null - proceeding anyway (API may be down)");
        }
      } catch (error) {
        console.warn("Originality check unavailable, proceeding with mint:", error);
        // Continue with mint only if originality check fails due to API error
        // This maintains backward compatibility if the API service is down
      }

      // Use authenticated actors for minting
      const { opend: authedOpend } = await getAuthedActors();
      
      // Call mint - it uses msg.caller to determine the owner
      const newNFTID = await authedOpend.mint(imageByteData, name);
      
      // Check if minting failed (returns invalid principal "aaaaa-aa")
      if (newNFTID.toText() === "aaaaa-aa") {
        throw new Error("Minting failed: Insufficient cycles. Please top up the canister with cycles.");
      }
      
      console.log("Minted NFT ID:", newNFTID.toText());
      console.log("Expected owner should be:", principal?.toText());
      
      // Store NFT metadata in database (non-blocking but important for duplicate detection)
      storeNFTMetadata(newNFTID.toText(), name, imageByteData, originalityResult).catch(err => {
        console.error("Metadata storage failed - this will affect duplicate detection:", err);
        // Show warning but don't block
        alert("Warning: Failed to store NFT metadata. Duplicate detection may not work for this NFT.");
      });
      
      setNFTPrincipal(newNFTID);
      setLoaderHidden(true);
      
      // Refresh NFT list after minting
      if (refreshNFTs) {
        setTimeout(() => {
          refreshNFTs();
        }, 2000); // Wait 2 seconds for the canister to update
      }
    } catch (error) {
      console.error("Error minting NFT:", error);
      
      // Check if error is related to cycles
      const errorMessage = error.message || String(error);
      if (errorMessage.includes("out of cycles") || errorMessage.includes("Insufficient cycles")) {
        setErrorMessage(
          "Cannot mint NFT: The canister is out of cycles. " +
          "Please top up using: dfx wallet send $(dfx canister id opend) 5_000_000_000_000"
        );
      } else {
        setErrorMessage("Failed to mint NFT. Please try again: " + errorMessage);
      }
      setLoaderHidden(true);
    }
  }

  // Check cycles on component mount
  useEffect(() => {
    if (isAuthenticated) {
      checkCycles();
    }
  }, [isAuthenticated]);

  if (nftPrincipal == "") {
    return (
      <div className="minter-page">
        <div className="minter-container">
          {!loaderHidden && (
            <div className="minter-loader-wrap">
              <div className="lds-ellipsis">
                <div></div><div></div><div></div><div></div>
              </div>
            </div>
          )}
          <p className="minter-label">Create NFT</p>
          <h2 className="minter-title">Mint Your NFT</h2>
          <p className="minter-desc">Upload an image and verify originality before minting</p>

          {!isAuthenticated && (
            <div className="minter-alert minter-alert-error">Please login to mint NFTs</div>
          )}
          {cyclesWarning && (
            <div className={`minter-alert ${cyclesWarning.includes("⚠️") ? "minter-alert-warning" : "minter-alert-info"}`}>
              {cyclesWarning}
            </div>
          )}
          {(originalityChecking || originalityLiveLayers) && (
            <div className="originality-checking-banner">
              <div className="originality-checking-pulse" />
              <span>
                {originalityLiveLayers
                  ? `Verifying Layer ${originalityLiveLayers.stage}...`
                  : "Checking image originality..."}
              </span>
            </div>
          )}
          {(originalityLiveLayers?.layers || originalityCheckResult?.layers) && (
            <OriginalityLayerCharts
              layers={originalityLiveLayers?.layers || originalityCheckResult?.layers}
              currentStage={originalityLiveLayers?.stage}
              isChecking={!!originalityLiveLayers?.checking}
              finalApproved={originalityCheckResult?.approved}
              finalMessage={originalityCheckResult?.message}
              similarNft={originalityCheckResult?.existingNft || originalityCheckResult?.mostSimilarNft}
              originalityScore={originalityCheckResult?.originalityScore}
              similarityScore={originalityCheckResult?.similarityScore}
            />
          )}
          {originalityCheckResult && originalityCheckResult.reason === "error" && (
            <div className="minter-alert minter-alert-info">ℹ️ {originalityCheckResult.message}</div>
          )}
          {errorMessage && (
            <div className="minter-alert minter-alert-error">{errorMessage}</div>
          )}

          <form className="minter-form" noValidate autoComplete="off">
            <label className="minter-field-label">Upload Image</label>
            <div className="minter-upload-wrap">
              <input
                {...register("image", { required: true })}
                className="minter-upload"
                type="file"
                accept="image/x-png,image/jpeg,image/gif,image/svg+xml,image/webp"
              />
            </div>
            <label className="minter-field-label">Collection Name</label>
            <input
              {...register("name", { required: true })}
              className="minter-input"
              placeholder="e.g. CryptoDunks"
              type="text"
            />
            <button type="button" className="minter-btn" onClick={handleSubmit(onSubmit)}>
              Mint NFT
            </button>
          </form>
        </div>
      </div>
    );
  } else {
    return (
      <div className="minter-page">
        <div className="minter-container minter-success">
          <p className="minter-label">Success</p>
          <h2 className="minter-title">NFT Minted!</h2>
          <div className="minter-minted-preview">
            <Item id={nftPrincipal.toText()} />
          </div>
        </div>
      </div>
    );
  }
}

export default Minter;
