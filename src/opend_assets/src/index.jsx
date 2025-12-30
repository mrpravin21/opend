import React, { createContext, useState, useEffect } from "react";
import ReactDOM from "react-dom";
import App from "./components/App";
import { Principal } from "@dfinity/principal";
import { checkAuth, login, logout, getCurrentPrincipal, checkSessionTimeout } from "./icpAuth";

// Create Auth Context
export const AuthContext = createContext({
  isAuthenticated: false,
  principal: null,
  login: async () => {},
  logout: async () => {},
  loading: true,
});

// Default anonymous principal (fallback)
const ANONYMOUS_PRINCIPAL = Principal.fromText("2vxsx-fae");
export default ANONYMOUS_PRINCIPAL;

function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [principal, setPrincipal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let retryTimeout = null;
    let retryCount = 0;
    const MAX_RETRIES = 20; // Check up to 20 times after login (10 seconds total)
    
    // Check authentication status on mount
    async function checkAuthentication() {
      try {
        // Check if we initiated a login (stored in localStorage before redirect)
        const loginInitiated = localStorage.getItem('ii_login_initiated');
        
        // Check authentication (this also checks session timeout)
        const identity = await checkAuth();
        
        if (identity) {
          // User is authenticated
          const currentPrincipal = identity.getPrincipal();
          setPrincipal(currentPrincipal);
          setIsAuthenticated(true);
          if (loginInitiated) {
            localStorage.removeItem('ii_login_initiated');
          }
          setLoading(false);
          // Clear any retry timeout
          if (retryTimeout) {
            clearTimeout(retryTimeout);
            retryTimeout = null;
          }
          retryCount = 0; // Reset retry count on success
        } else {
          // Not authenticated
          setPrincipal(ANONYMOUS_PRINCIPAL);
          setIsAuthenticated(false);
          
          // If we initiated a login but aren't authenticated yet, keep checking
          if (loginInitiated && retryCount < MAX_RETRIES) {
            retryCount++;
            // Wait a bit and check again (AuthClient may need time to process callback)
            retryTimeout = setTimeout(checkAuthentication, 500);
            return; // Don't set loading to false yet
          } else if (loginInitiated) {
            // Max retries reached, give up and remove flag
            localStorage.removeItem('ii_login_initiated');
            setLoading(false);
          } else {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        setPrincipal(ANONYMOUS_PRINCIPAL);
        setIsAuthenticated(false);
        localStorage.removeItem('ii_login_initiated');
        setLoading(false);
        if (retryTimeout) {
          clearTimeout(retryTimeout);
        }
      }
    }

    checkAuthentication();

    // Set up periodic session timeout check (every 5 minutes)
    const sessionCheckInterval = setInterval(async () => {
      const expired = await checkSessionTimeout();
      if (expired) {
        setPrincipal(ANONYMOUS_PRINCIPAL);
        setIsAuthenticated(false);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    // Listen for window focus to check auth when user returns to tab
    const handleFocus = async () => {
      const expired = await checkSessionTimeout();
      if (expired) {
        setPrincipal(ANONYMOUS_PRINCIPAL);
        setIsAuthenticated(false);
      } else {
        // Re-check authentication status
        const identity = await checkAuth();
        if (identity) {
          const currentPrincipal = identity.getPrincipal();
          setPrincipal(currentPrincipal);
          setIsAuthenticated(true);
        } else {
          setPrincipal(ANONYMOUS_PRINCIPAL);
          setIsAuthenticated(false);
        }
      }
    };

    // Listen for visibility change (when tab becomes visible again after II redirect)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const loginInitiated = localStorage.getItem('ii_login_initiated');
        if (loginInitiated) {
          // User just returned from Internet Identity, check auth
          const identity = await checkAuth();
          if (identity) {
            const currentPrincipal = identity.getPrincipal();
            setPrincipal(currentPrincipal);
            setIsAuthenticated(true);
            localStorage.removeItem('ii_login_initiated');
            setLoading(false);
          }
        } else {
          // Check session timeout
          handleFocus();
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      clearInterval(sessionCheckInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleLogin = async () => {
    try {
      // login() will redirect the entire page to Internet Identity
      // The page will reload after authentication, and checkAuthentication() will detect it
      await login();
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed. Please try again.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setPrincipal(ANONYMOUS_PRINCIPAL);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const value = {
    isAuthenticated,
    principal,
    login: handleLogin,
    logout: handleLogout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const init = async () => {
  ReactDOM.render(
    <AuthProvider>
      <App />
    </AuthProvider>,
    document.getElementById("root")
  );
};

init();
