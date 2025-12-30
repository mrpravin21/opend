import React, { useEffect, useState, useContext } from "react";
import logo from "../../assets/logo.png";
import homeImage from "../../assets/home-img.png";
import { BrowserRouter, Link, Switch, Route } from "react-router-dom";
import Minter from "./Minter";
import Gallery from "./Gallery";
import { opend } from "../../../declarations/opend";
import { AuthContext } from "../index";
import TokenWallet from "./TokenWallet";
import { getAuthedActors } from "../icpAuth";

// Create a context to share refresh function
export const NFTRefreshContext = React.createContext({
  refreshNFTs: () => {},
});

function Header() {
  const { isAuthenticated, principal, login, logout, loading } = useContext(AuthContext);
  const [userOwnedGallery, setOwnedGallery] = useState();
  const [listingGallery, setListingGallery] = useState();

  async function getNFTs() {
    // Only fetch NFTs if we have a valid principal
    if (!principal || !principal.toText || principal.toText() === "2vxsx-fae") {
      // Anonymous principal or no principal - show empty galleries
      setOwnedGallery(<Gallery title="My NFTs" ids={[]} role="collection" />);
      
      // Still fetch listed NFTs for discover section (these are public)
      try {
        const listedNFTIds = await opend.getListedNFTs();
        console.log("Listed NFTs:", listedNFTIds);
        setListingGallery(
          <Gallery title="Discover" ids={listedNFTIds} role="discover" />
        );
      } catch (error) {
        console.error("Error fetching listed NFTs:", error);
        setListingGallery(<Gallery title="Discover" ids={[]} role="discover" />);
      }
      return;
    }

    try {
      // Use authenticated actors if user is logged in
      let opendActor = opend;
      if (isAuthenticated && principal) {
        const { opend: authedOpend } = await getAuthedActors();
        opendActor = authedOpend;
      }

      // Ensure principal is valid before calling getOwnedNFTs
      if (!principal || !principal.toText) {
        console.error("Invalid principal:", principal);
        setOwnedGallery(<Gallery title="My NFTs" ids={[]} role="collection" />);
        setListingGallery(<Gallery title="Discover" ids={[]} role="discover" />);
        return;
      }

      const userNFTIds = await opendActor.getOwnedNFTs(principal);
      console.log("User NFTs:", userNFTIds);
      setOwnedGallery(
        <Gallery title="My NFTs" ids={userNFTIds} role="collection" />
      );

      const listedNFTIds = await opendActor.getListedNFTs();
      console.log("Listed NFTs:", listedNFTIds);
      setListingGallery(
        <Gallery title="Discover" ids={listedNFTIds} role="discover" />
      );
    } catch (error) {
      console.error("Error fetching NFTs:", error);
      setOwnedGallery(<Gallery title="My NFTs" ids={[]} role="collection" />);
      setListingGallery(<Gallery title="Discover" ids={[]} role="discover" />);
    }
  }

  useEffect(() => {
    if (!loading) {
      getNFTs();
    }
  }, [isAuthenticated, principal, loading]);

  const handleLogin = async () => {
    await login();
    // getNFTs will be called automatically via useEffect when principal changes
  };

  const handleLogout = async () => {
    await logout();
    // Reset galleries
    setOwnedGallery(null);
    setListingGallery(null);
  };

  // Provide refresh function via context
  const refreshContextValue = {
    refreshNFTs: getNFTs,
  };

  return (
    <NFTRefreshContext.Provider value={refreshContextValue}>
      <BrowserRouter forceRefresh={true}>
        <div className="app-root-1">
        <header className="Paper-root AppBar-root AppBar-positionStatic AppBar-colorPrimary Paper-elevation4">
          <div className="Toolbar-root Toolbar-regular header-appBar-13 Toolbar-gutters">
            <div className="header-left-4"></div>
            <img className="header-logo-11" src={logo} />
            <div className="header-vertical-9"></div>
            <Link to="/">
              <h5 className="Typography-root header-logo-text">OpenD</h5>
            </Link>
            <div className="header-empty-6"></div>
            <div className="header-space-8"></div>
            <button className="ButtonBase-root Button-root Button-text header-navButtons-3">
              <Link to="/discover">Discover</Link>
            </button>
            <button className="ButtonBase-root Button-root Button-text header-navButtons-3">
              <Link to="/minter">Minter</Link>
            </button>
            <button className="ButtonBase-root Button-root Button-text header-navButtons-3">
              <Link to="/collection">My NFTs</Link>
            </button>
            <button className="ButtonBase-root Button-root Button-text header-navButtons-3">
               <Link to="/wallet">Wallet</Link>
            </button>
            {loading ? (
              <button className="ButtonBase-root Button-root Button-text header-navButtons-3" disabled>
                Loading...
              </button>
            ) : isAuthenticated ? (
              <>
                <button className="ButtonBase-root Button-root Button-text header-navButtons-3">
                  <span style={{ fontSize: "0.8rem", color: "#666" }}>
                    {principal?.toText().substring(0, 8)}...
                  </span>
                </button>
                <button 
                  className="ButtonBase-root Button-root Button-text header-navButtons-3"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </>
            ) : (
              <button 
                className="ButtonBase-root Button-root Button-text header-navButtons-3"
                onClick={handleLogin}
              >
                Login
              </button>
            )}

          </div>
        </header>
      </div>
      <Switch>
        <Route exact path="/">
          <img className="bottom-space" src={homeImage} />
        </Route>
        <Route path="/discover">{listingGallery}</Route>
        <Route path="/minter">
          <Minter />
        </Route>
        <Route path="/collection">{userOwnedGallery}</Route>
        <Route path="/wallet">
          <TokenWallet />
        </Route>

      </Switch>
    </BrowserRouter>
    </NFTRefreshContext.Provider>
  );
}

export default Header;
