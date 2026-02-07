import React, { useEffect, useState, useContext, useRef } from "react";
import { BrowserRouter, Link, Switch, Route } from "react-router-dom";
import Minter from "./Minter";
import LandingPage from "./LandingPage";
import Gallery from "./Gallery";
import PageWithGradient from "./PageWithGradient";
import { opend } from "../../../declarations/opend";
import { AuthContext } from "../index";
import TokenWallet from "./TokenWallet";
import QuizRewards from "./QuizRewards";
import { getAuthedActors } from "../icpAuth";

// Create a context to share refresh function
export const NFTRefreshContext = React.createContext({
  refreshNFTs: () => {},
});

function Header() {
  const { isAuthenticated, principal, login, logout, loading } = useContext(AuthContext);
  const [userOwnedGallery, setOwnedGallery] = useState();
  const [listingGallery, setListingGallery] = useState();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  async function getNFTs() {
    // Only fetch NFTs if we have a valid principal
    if (!principal || !principal.toText || principal.toText() === "2vxsx-fae") {
      // Anonymous principal or no principal - show empty galleries
      setOwnedGallery(
        <PageWithGradient>
          <Gallery title="My NFTs" ids={[]} role="collection" />
        </PageWithGradient>
      );

      // Still fetch listed NFTs for discover section (these are public)
      try {
        const listedNFTIds = await opend.getListedNFTs();
        console.log("Listed NFTs:", listedNFTIds);
        setListingGallery(
          <PageWithGradient>
            <Gallery title="Discover" ids={listedNFTIds} role="discover" />
          </PageWithGradient>
        );
      } catch (error) {
        console.error("Error fetching listed NFTs:", error);
        setListingGallery(
          <PageWithGradient>
            <Gallery title="Discover" ids={[]} role="discover" />
          </PageWithGradient>
        );
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
        setOwnedGallery(
          <PageWithGradient>
            <Gallery title="My NFTs" ids={[]} role="collection" />
          </PageWithGradient>
        );
        setListingGallery(
          <PageWithGradient>
            <Gallery title="Discover" ids={[]} role="discover" />
          </PageWithGradient>
        );
        return;
      }

      const userNFTIds = await opendActor.getOwnedNFTs(principal);
      console.log("User NFTs:", userNFTIds);
      setOwnedGallery(
        <PageWithGradient>
          <Gallery title="My NFTs" ids={userNFTIds} role="collection" />
        </PageWithGradient>
      );

      const listedNFTIds = await opendActor.getListedNFTs();
      console.log("Listed NFTs:", listedNFTIds);
      setListingGallery(
        <PageWithGradient>
          <Gallery title="Discover" ids={listedNFTIds} role="discover" />
        </PageWithGradient>
      );
    } catch (error) {
      console.error("Error fetching NFTs:", error);
      setOwnedGallery(
        <PageWithGradient>
          <Gallery title="My NFTs" ids={[]} role="collection" />
        </PageWithGradient>
      );
      setListingGallery(
        <PageWithGradient>
          <Gallery title="Discover" ids={[]} role="discover" />
        </PageWithGradient>
      );
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

  const closeMobileMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const navLinks = [
    { to: "/discover", label: "Discover" },
    { to: "/minter", label: "Minter" },
    { to: "/collection", label: "My NFTs" },
    { to: "/wallet", label: "Wallet" },
    { to: "/quiz", label: "Quiz" },
  ];

  return (
    <NFTRefreshContext.Provider value={refreshContextValue}>
      <BrowserRouter forceRefresh={true}>
        <div className="app-root-1">
        <header className="Paper-root AppBar-root AppBar-positionStatic AppBar-colorPrimary Paper-elevation4 header-main">
          <div className="Toolbar-root Toolbar-regular header-appBar-13 Toolbar-gutters header-toolbar">
            <div className="header-left-4"></div>
            <Link to="/" className="header-brand" onClick={closeMobileMenu}>
              <h5 className="Typography-root header-logo-text">MV</h5>
            </Link>
            <div className="header-empty-6"></div>
            <div className="header-space-8"></div>
            <nav className="header-nav">
              {navLinks.map(({ to, label }) => (
                <Link key={to} to={to} className="header-nav-link" onClick={closeMobileMenu}>
                  {label}
                </Link>
              ))}
            </nav>
            <div className="header-auth">
              {loading ? (
                <span className="header-nav-link" style={{ opacity: 0.7 }}>Loading...</span>
              ) : isAuthenticated ? (
                <div className="header-user-menu" ref={userMenuRef}>
                  <button
                    className="header-user-btn"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    aria-label="Account menu"
                    aria-expanded={userMenuOpen}
                  >
                    <svg className="header-user-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                    </svg>
                  </button>
                  {userMenuOpen && (
                    <div className="header-user-dropdown">
                      <div
                        className="header-user-dropdown-section header-user-dropdown-principal-wrap"
                        onClick={() => navigator.clipboard?.writeText(principal?.toText() || "")}
                        title="Click to copy"
                      >
                        <div className="header-user-dropdown-principal-box">
                          <span className="wallet-principal-label">Principal</span>
                          <code className="wallet-principal-value" title={principal?.toText()}>{principal?.toText()}</code>
                          <span className="header-user-copy-icon" aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </span>
                        </div>
                      </div>
                      <button
                        className="header-user-dropdown-item header-user-dropdown-logout"
                        onClick={() => { handleLogout(); setUserMenuOpen(false); }}
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button className="header-nav-link header-btn header-btn-primary" onClick={handleLogin}>
                  Login
                </button>
              )}
            </div>
            <button
              className="header-hamburger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <span className={`header-hamburger-bar ${mobileMenuOpen ? "open" : ""}`} />
              <span className={`header-hamburger-bar ${mobileMenuOpen ? "open" : ""}`} />
              <span className={`header-hamburger-bar ${mobileMenuOpen ? "open" : ""}`} />
            </button>
          </div>
        </header>
        {/* Mobile sidebar overlay */}
        <div
          className={`header-mobile-overlay ${mobileMenuOpen ? "open" : ""}`}
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
        <aside className={`header-mobile-sidebar ${mobileMenuOpen ? "open" : ""}`}>
          <nav className="header-mobile-nav">
            <Link to="/" className="header-mobile-link" onClick={closeMobileMenu}>Home</Link>
            {navLinks.map(({ to, label }) => (
              <Link key={to} to={to} className="header-mobile-link" onClick={closeMobileMenu}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="header-mobile-auth">
            {loading ? (
              <span className="header-mobile-link">Loading...</span>
            ) : isAuthenticated ? (
              <div className="header-mobile-user-section">
                <div className="header-mobile-principal-block">
                  <span className="header-mobile-principal-label">Principal ID</span>
                  <code className="header-mobile-principal-value">{principal?.toText()}</code>
                </div>
                <button className="header-mobile-link header-mobile-btn" onClick={() => { handleLogout(); closeMobileMenu(); }}>Logout</button>
              </div>
            ) : (
              <button className="header-mobile-link header-mobile-btn header-mobile-btn-primary" onClick={() => { handleLogin(); closeMobileMenu(); }}>Login</button>
            )}
          </div>
        </aside>
      </div>
      <Switch>
        <Route exact path="/">
          <LandingPage />
        </Route>
        <Route path="/discover">{listingGallery}</Route>
        <Route path="/minter">
          <PageWithGradient>
            <Minter />
          </PageWithGradient>
        </Route>
        <Route path="/collection">{userOwnedGallery}</Route>
        <Route path="/wallet">
          <PageWithGradient>
            <TokenWallet />
          </PageWithGradient>
        </Route>
        <Route path="/quiz">
          <PageWithGradient>
            <QuizRewards />
          </PageWithGradient>
        </Route>

      </Switch>
    </BrowserRouter>
    </NFTRefreshContext.Provider>
  );
}

export default Header;
