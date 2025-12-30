import React, { useState, useContext } from "react";
import { useForm } from "react-hook-form";
import { opend } from "../../../declarations/opend";
import { Principal } from "@dfinity/principal";
import Item from "./Item";
import { AuthContext } from "../index";
import { getAuthedActors } from "../icpAuth";
import { NFTRefreshContext } from "./Header";

function Minter() {
  const { isAuthenticated, principal } = useContext(AuthContext);
  const { refreshNFTs } = useContext(NFTRefreshContext);
  const { register, handleSubmit } = useForm();
  const [nftPrincipal, setNFTPrincipal] = useState("");
  const [loaderHidden, setLoaderHidden] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function onSubmit(data) {
    if (!isAuthenticated || !principal) {
      setErrorMessage("Please login to mint NFTs");
      return;
    }

    setLoaderHidden(false);
    setErrorMessage("");

    try {
      const name = data.name;
      const image = data.image[0];
      const imageArray = await image.arrayBuffer();
      const imageByteData = [...new Uint8Array(imageArray)];

      // Use authenticated actors for minting
      const { opend: authedOpend } = await getAuthedActors();
      
      // Call mint - it uses msg.caller to determine the owner
      const newNFTID = await authedOpend.mint(imageByteData, name);
      console.log("Minted NFT ID:", newNFTID.toText());
      console.log("Expected owner should be:", principal?.toText());
      
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
      setErrorMessage("Failed to mint NFT. Please try again: " + error.message);
      setLoaderHidden(true);
    }
  }

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
        {errorMessage && (
          <div style={{ color: "red", marginBottom: "10px" }}>
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
