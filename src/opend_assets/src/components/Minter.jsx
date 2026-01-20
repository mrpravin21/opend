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

  // Check originality of image before minting (optional, non-blocking)
  async function checkOriginality(imageFile, name) {
    if (!isAuthenticated || !principal) {
      return null;
    }

    try {
      setOriginalityChecking(true);
      setOriginalityCheckResult(null);

      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('principalId', principal.toText());
      formData.append('name', name);

      console.log('Calling originality check API:', `${QUIZ_API_URL}/api/nft/check-originality`);
      
      const response = await fetch(`${QUIZ_API_URL}/api/nft/check-originality`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Originality check API error:', response.status, errorText);
        throw new Error(`Originality check failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Originality check result:', result);
      setOriginalityCheckResult(result);
      return result;
    } catch (error) {
      console.error("Error checking originality:", error);
      // Don't block minting if originality check fails - just log it
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
        embedding: null, // Will be generated server-side if needed
        originalityScore: checkResult?.originalityScore ? parseFloat(checkResult.originalityScore) : null,
        similarityScore: checkResult?.similarityScore ? parseFloat(checkResult.similarityScore) : null,
        mostSimilarNftPrincipalId: checkResult?.mostSimilarNft?.nft_principal_id || null,
      };

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
          setErrorMessage(
            `Cannot mint NFT: ${originalityResult.message}.${existingNftInfo} ` +
            `Minting has been blocked to prevent duplicates.`
          );
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
      <div className="minter-container">
        <div hidden={loaderHidden} className="lds-ellipsis">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
        <h3 className="makeStyles-title-99 Typography-h3 form-Typography-gutterBottom">
          Create NFT
        </h3>
        {!isAuthenticated && (
          <div style={{ color: "red", marginBottom: "10px" }}>
            Please login to mint NFTs
          </div>
        )}
        {cyclesWarning && (
          <div style={{ 
            color: cyclesWarning.includes("⚠️") ? "orange" : "blue", 
            marginBottom: "10px",
            padding: "10px",
            backgroundColor: cyclesWarning.includes("⚠️") ? "#fff3cd" : "#d1ecf1",
            borderRadius: "4px",
            fontSize: "14px"
          }}>
            {cyclesWarning}
          </div>
        )}
        {originalityChecking && (
          <div style={{ 
            color: "blue", 
            marginBottom: "10px",
            padding: "10px",
            backgroundColor: "#d1ecf1",
            borderRadius: "4px",
            fontSize: "14px"
          }}>
            🔍 Checking image originality...
          </div>
        )}
        {originalityCheckResult && originalityCheckResult.approved === false && (
          <div style={{ 
            color: "red", 
            marginBottom: "10px",
            padding: "10px",
            backgroundColor: "#f8d7da",
            borderRadius: "4px",
            fontSize: "14px",
            border: "1px solid #dc3545"
          }}>
            ❌ Duplicate Detected: {originalityCheckResult.message}
            {originalityCheckResult.existingNft && (
              <div style={{ marginTop: "8px", fontSize: "12px", color: "#721c24" }}>
                <strong>Existing NFT:</strong> "{originalityCheckResult.existingNft.name || 'Unknown'}"
                {originalityCheckResult.existingNft.nft_principal_id && (
                  <span> (ID: {originalityCheckResult.existingNft.nft_principal_id.substring(0, 20)}...)</span>
                )}
              </div>
            )}
            {originalityCheckResult.originalityScore && (
              <div style={{ marginTop: "5px", fontSize: "12px", color: "#721c24" }}>
                Originality Score: {originalityCheckResult.originalityScore}%
              </div>
            )}
            <div style={{ marginTop: "8px", fontSize: "12px", fontWeight: "bold", color: "#721c24" }}>
              ⛔ Minting has been blocked to prevent duplicates.
            </div>
          </div>
        )}
        {originalityCheckResult && originalityCheckResult.approved === true && (
          <div style={{ 
            color: "green", 
            marginBottom: "10px",
            padding: "10px",
            backgroundColor: "#d4edda",
            borderRadius: "4px",
            fontSize: "14px"
          }}>
            ✅ Image passed originality check (Score: {originalityCheckResult.originalityScore}%)
          </div>
        )}
        {originalityCheckResult && originalityCheckResult.reason === 'error' && (
          <div style={{ 
            color: "gray", 
            marginBottom: "10px",
            padding: "10px",
            backgroundColor: "#e9ecef",
            borderRadius: "4px",
            fontSize: "14px"
          }}>
            ℹ️ {originalityCheckResult.message}
          </div>
        )}
        {errorMessage && (
          <div style={{ 
            color: "red", 
            marginBottom: "10px",
            padding: "10px",
            backgroundColor: "#f8d7da",
            borderRadius: "4px"
          }}>
            {errorMessage}
          </div>
        )}
        <h6 className="form-Typography-root makeStyles-subhead-102 form-Typography-subtitle1 form-Typography-gutterBottom">
          Upload Image
        </h6>
        <form className="makeStyles-form-109" noValidate="" autoComplete="off">
          <div className="upload-container">
            <input
              {...register("image", { required: true })}
              className="upload"
              type="file"
              accept="image/x-png,image/jpeg,image/gif,image/svg+xml,image/webp"
            />
          </div>
          <h6 className="form-Typography-root makeStyles-subhead-102 form-Typography-subtitle1 form-Typography-gutterBottom">
            Collection Name
          </h6>
          <div className="form-FormControl-root form-TextField-root form-FormControl-marginNormal form-FormControl-fullWidth">
            <div className="form-InputBase-root form-OutlinedInput-root form-InputBase-fullWidth form-InputBase-formControl">
              <input
                {...register("name", { required: true })}
                placeholder="e.g. CryptoDunks"
                type="text"
                className="form-InputBase-input form-OutlinedInput-input"
              />
              <fieldset className="PrivateNotchedOutline-root-60 form-OutlinedInput-notchedOutline"></fieldset>
            </div>
          </div>
          <div className="form-ButtonBase-root form-Chip-root makeStyles-chipBlue-108 form-Chip-clickable">
            <span onClick={handleSubmit(onSubmit)} className="form-Chip-label">
              Mint NFT
            </span>
          </div>
        </form>
      </div>
    );
  } else {
    return (
      <div className="minter-container">
        <h3 className="Typography-root makeStyles-title-99 Typography-h3 form-Typography-gutterBottom">
          Minted!
        </h3>
        <div className="horizontal-center">
          <Item id={nftPrincipal.toText()} />
        </div>
      </div>
    );
  }
}

export default Minter;
