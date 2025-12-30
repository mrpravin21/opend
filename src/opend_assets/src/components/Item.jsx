import React, { useEffect, useState, useContext } from "react";
import logo from "../../assets/logo.png";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../declarations/nft";
import { idlFactory as tokenIdlFactory } from "../../../declarations/token";
import { Principal } from "@dfinity/principal";
import { opend } from "../../../declarations/opend";
import Button from "./Button";
import { AuthContext } from "../index";
import PriceLabel from "./PriceLabel";
import { getAuthedActors, makeAgent } from "../icpAuth";
import { NFTRefreshContext } from "./Header";

function Item(props) {
  const { isAuthenticated, principal } = useContext(AuthContext);
  const { refreshNFTs } = useContext(NFTRefreshContext);
  const [name, setName] = useState();
  const [owner, setOwner] = useState();
  const [image, setImage] = useState();
  const [button, setButton] = useState();
  const [priceInput, setPriceInput] = useState();
  const [loaderHidden, setLoaderHidden] = useState(true);
  const [blur, setBlur] = useState();
  const [sellStatus, setSellStatus] = useState("");
  const [priceLabel, setPriceLabel] = useState();
  const [shouldDisplay, setDisplay] = useState(true);
  const [NFTActor, setNFTActor] = useState(null);

  // Handle both string and Principal ID formats
  const id = typeof props.id === "string" ? Principal.fromText(props.id) : props.id;

  async function loadNFT() {
    setLoaderHidden(false);
    try {
      // Convert id to Principal if it's a string
      let nftPrincipal;
      try {
        nftPrincipal = typeof props.id === "string" ? Principal.fromText(props.id) : props.id;
      } catch (error) {
        console.error("Invalid NFT ID:", props.id, error);
        setLoaderHidden(true);
        return;
      }
      
      // For NFT queries (read operations like getName, getOwner, getAsset),
      // we use an anonymous agent to avoid certificate verification issues
      // Authenticated agent is only needed for write operations
      const agent = new HttpAgent({ host: "http://127.0.0.1:8000" });
      await agent.fetchRootKey();

      const nftActor = await Actor.createActor(idlFactory, {
        agent,
        canisterId: nftPrincipal,
      });
      setNFTActor(nftActor);

      // Fetch NFT data with error handling
      const name = await nftActor.getName();
      setName(name);
      
      const owner = await nftActor.getOwner();
      
      const imageData = await nftActor.getAsset();
      const imageContent = new Uint8Array(imageData);
      const imageBlob = new Blob([imageContent.buffer], { type: "image/png" });
      const imageUrl = URL.createObjectURL(imageBlob);
      setImage(imageUrl);

      // Use authenticated actors for opend calls
      let opendActor = opend;
      if (isAuthenticated) {
        const { opend: authedOpend } = await getAuthedActors();
        opendActor = authedOpend;
      }

      // Convert id to Principal for opend calls
      const nftIdForOpend = typeof props.id === "string" ? Principal.fromText(props.id) : props.id;
      
      if (props.role == "collection") {
        const nftIsListed = await opendActor.isListed(nftIdForOpend);

        if (nftIsListed) {
          setOwner("OpenD");
          setBlur({ filter: "blur(4px)" });
          setSellStatus("Listed");
        } else {
          // Display the actual owner
          setOwner(owner.toText());
          // Only show sell button if user is authenticated and owns the NFT
          // Compare principals properly - owner is a Principal object, convert both to strings
          if (isAuthenticated && principal && owner.toText() === principal.toText()) {
            setButton(<Button handleClick={handleSell} text={"Sell"} />);
          }
        }
      } else if (props.role == "discover") {
        // For discover section, show the original owner (seller) instead of OpenD
        const originalOwner = await opendActor.getOriginalOwner(nftIdForOpend);
        setOwner(originalOwner.toText());
        
        // Show buy button if user is authenticated and doesn't own the NFT
        if (isAuthenticated && principal && originalOwner.toText() !== principal.toText()) {
          setButton(<Button handleClick={handleBuy} text={"Buy"} />);
        } else if (!isAuthenticated) {
          setButton(<Button handleClick={() => alert("Please login to buy NFTs")} text={"Login to Buy"} />);
        }

        const price = await opendActor.getListedNFTPrice(nftIdForOpend);
        setPriceLabel(<PriceLabel sellPrice={price.toString()} />);
      }
      
      setLoaderHidden(true);
    } catch (error) {
      console.error("Error loading NFT:", error);
      setLoaderHidden(true);
      // Show error message to user
      setName("Error loading NFT");
      setOwner("Unknown");
      setImage(undefined);
    }
  }

  useEffect(() => {
    loadNFT();
  }, [isAuthenticated, principal]);

  let price;
  function handleSell() {
    console.log("Sell clicked");
    setPriceInput(
      <input
        placeholder="Price in DANG"
        type="number"
        className="price-input"
        value={price}
        onChange={(e) => (price = e.target.value)}
      />
    );
    setButton(<Button handleClick={sellItem} text={"Confirm"} />);
  }

  async function sellItem() {
    if (!isAuthenticated || !principal) {
      alert("Please login to sell NFTs");
      return;
    }

    setBlur({ filter: "blur(4px)" });
    setLoaderHidden(false);
    console.log("set price = " + price);
    
    try {
      // Convert id to Principal
      const nftIdForOpend = typeof props.id === "string" ? Principal.fromText(props.id) : props.id;
      
      // Create authenticated actors (both opend and agent for NFT)
      const { opend: authedOpend, agent: authedAgent } = await getAuthedActors();
      
      // Create NFT actor with authenticated agent for transferOwnership
      const nftActor = await Actor.createActor(idlFactory, {
        agent: authedAgent,
        canisterId: nftIdForOpend,
      });
      
      const listingResult = await authedOpend.listItem(nftIdForOpend, Number(price));
      console.log("listing: " + listingResult);
      
      if (listingResult == "Success") {
        const openDId = await authedOpend.getOpenDCanisterID();
        const transferResult = await nftActor.transferOwnership(openDId);
        console.log("transfer: " + transferResult);
        
        if (transferResult == "Success") {
          setLoaderHidden(true);
          setButton();
          setPriceInput();
          setOwner("OpenD");
          setSellStatus("Listed");
          // Refresh galleries to show the NFT in Discover section
          if (refreshNFTs) {
            refreshNFTs();
          }
        } else {
          setLoaderHidden(true);
          alert("Transfer failed: " + transferResult);
        }
      } else {
        setLoaderHidden(true);
        alert("Listing failed: " + listingResult);
      }
    } catch (error) {
      console.error("Error selling NFT:", error);
      setLoaderHidden(true);
      alert("Error selling NFT: " + error.message);
    }
  }

  async function handleBuy() {
    if (!isAuthenticated || !principal) {
      alert("Please login to buy NFTs");
      return;
    }

    console.log("Buy was triggered");
    setLoaderHidden(false);

    try {
      // Use authenticated actors
      const { opend: authedOpend, token: authedToken } = await getAuthedActors();
      const nftIdForOpend = typeof props.id === "string" ? Principal.fromText(props.id) : props.id;

      const sellerId = await authedOpend.getOriginalOwner(nftIdForOpend);
      const itemPrice = await authedOpend.getListedNFTPrice(nftIdForOpend);

      // Transfer tokens from buyer to seller with description
      // Note: The transaction will be recorded for both buyer (debit) and seller (credit)
      // Buyer sees: "Amount debited for NFT purchase from <seller>"
      // Seller sees: "Amount credited for NFT sold to <buyer>"
      const description = `NFT purchase from ${sellerId.toText()}`;
      const result = await authedToken.transferWithDescription(sellerId, itemPrice, description);
      
      if (result == "Success") {
        // Complete the purchase with authenticated user as new owner
        const transferResult = await authedOpend.completePurchase(
          nftIdForOpend,
          sellerId,
          principal
        );
        console.log("purchase: " + transferResult);
        
        if (transferResult == "Success") {
          setLoaderHidden(true);
          setDisplay(false);
          // Refresh galleries to update My NFTs and Discover sections
          if (refreshNFTs) {
            // Wait a moment for the canister to update
            setTimeout(() => {
              refreshNFTs();
            }, 1000);
          } else {
            // Fallback to reload if refreshNFTs is not available
            window.location.reload();
          }
        } else {
          setLoaderHidden(true);
          alert("Purchase failed: " + transferResult);
        }
      } else {
        setLoaderHidden(true);
        alert("Token transfer failed: " + result);
      }
    } catch (error) {
      console.error("Error buying NFT:", error);
      setLoaderHidden(true);
      alert("Error buying NFT: " + error.message);
    }
  }

  return (
    <div
      style={{ display: shouldDisplay ? "inline" : "none" }}
      className="disGrid-item"
    >
      <div className="disPaper-root disCard-root makeStyles-root-17 disPaper-elevation1 disPaper-rounded">
        {image ? (
          <img
            className="disCardMedia-root makeStyles-image-19 disCardMedia-media disCardMedia-img"
            src={image}
            style={blur}
            alt={name || "NFT"}
          />
        ) : (
          <div className="disCardMedia-root makeStyles-image-19 disCardMedia-media" style={{ 
            minHeight: "200px", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            backgroundColor: "#f0f0f0"
          }}>
            {loaderHidden ? "Image not available" : "Loading..."}
          </div>
        )}
        <div className="lds-ellipsis" hidden={loaderHidden}>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
        <div className="disCardContent-root">
          {priceLabel}
          <h2 className="disTypography-root makeStyles-bodyText-24 disTypography-h5 disTypography-gutterBottom">
            {name}
            <span className="purple-text"> {sellStatus}</span>
          </h2>
          <p className="disTypography-root makeStyles-bodyText-24 disTypography-body2 disTypography-colorTextSecondary">
            Owner: {owner}
          </p>
          {priceInput}
          {button}
        </div>
      </div>
    </div>
  );
}

export default Item;
