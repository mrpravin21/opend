import { AuthClient } from "@dfinity/auth-client";
import { HttpAgent } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";

import {
  canisterId as opendCanisterId,
  createActor as createOpendActor,
} from "../../declarations/opend";

import {
  canisterId as tokenCanisterId,
  createActor as createTokenActor,
} from "../../declarations/token";

const HOST = "http://127.0.0.1:8000";

// Internet Identity URL configuration
// IMPORTANT: For local development, you MUST deploy Internet Identity locally
// Production II cannot be used with local canisters due to certificate verification issues
export function getIdentityProviderUrl() {
  // Check if we're in development mode
  const isLocal = window.location.hostname === "localhost" || 
                  window.location.hostname === "127.0.0.1" ||
                  window.location.port === "8080" ||
                  window.location.port === "8000";
  
  if (isLocal) {
    // Check if canister ID is set via environment variable (from webpack)
    // Webpack automatically reads from .dfx/local/canister_ids.json
    const localIICanisterId = process.env.INTERNET_IDENTITY_CANISTER_ID;
    const canisterId = (localIICanisterId && localIICanisterId !== "undefined") 
      ? localIICanisterId 
      : "uxrrr-q7777-77774-qaaaq-cai"; // Fallback to deployed canister ID
    
    // Use the dfx port (8000) for Internet Identity
    // This is because Internet Identity is deployed on dfx's local replica
    return `http://localhost:8000/?canisterId=${canisterId}`;
  }
  
  // Production: use the official Internet Identity service
  return "https://identity.ic0.app";
}

export async function getAuthClient() {
  return await AuthClient.create();
}

// Session timeout: 24 hours in milliseconds
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Store login timestamp
 */
function setLoginTimestamp() {
  localStorage.setItem('login_timestamp', Date.now().toString());
}

/**
 * Check if session has expired
 */
function isSessionExpired() {
  const loginTimestamp = localStorage.getItem('login_timestamp');
  if (!loginTimestamp) {
    return true; // No timestamp means not logged in
  }
  
  const loginTime = parseInt(loginTimestamp, 10);
  const now = Date.now();
  const elapsed = now - loginTime;
  
  return elapsed > SESSION_TIMEOUT_MS;
}

/**
 * Clear login timestamp
 */
function clearLoginTimestamp() {
  localStorage.removeItem('login_timestamp');
}

/**
 * Login with Internet Identity using biometric authentication
 * 
 * NOTE: AuthClient.login() uses a redirect flow by default, which means:
 * - The page will redirect to Internet Identity
 * - After authentication, Internet Identity redirects back
 * - The Promise here won't resolve (page context is lost during redirect)
 * - Authentication is detected on page load via checkAuth() in index.jsx
 */
export async function login() {
  const authClient = await AuthClient.create();
  const identityProviderUrl = getIdentityProviderUrl();
  
  // Check if already authenticated
  if (await authClient.isAuthenticated()) {
    setLoginTimestamp();
    return authClient.getIdentity();
  }
  
  // Store a flag in localStorage to indicate we're starting a login
  localStorage.setItem('ii_login_initiated', 'true');
  
  // This will redirect the entire window to Internet Identity
  // When Internet Identity redirects back, checkAuthentication() in index.jsx will detect it
  authClient.login({
    identityProvider: identityProviderUrl,
    onSuccess: () => {
      localStorage.removeItem('ii_login_initiated');
      setLoginTimestamp(); // Store login time
    },
    onError: () => {
      localStorage.removeItem('ii_login_initiated');
    },
    maxTimeToLive: BigInt(7 * 24 * 60 * 60 * 1000 * 1000 * 1000), // 7 days
  });
  
  // Return a promise that never resolves (page redirects before it can)
  return new Promise(() => {});
}

/**
 * Logout from Internet Identity
 */
export async function logout() {
  const authClient = await AuthClient.create();
  await authClient.logout();
  clearLoginTimestamp(); // Clear login timestamp on logout
}

/**
 * Check if session has expired and logout if needed
 */
export async function checkSessionTimeout() {
  if (isSessionExpired()) {
    const authClient = await AuthClient.create();
    if (await authClient.isAuthenticated()) {
      await authClient.logout();
      clearLoginTimestamp();
      return true; // Session expired, user logged out
    }
  }
  return false; // Session valid or not authenticated
}

/**
 * Check if user is authenticated
 * AuthClient.create() automatically processes any pending callbacks from localStorage
 */
export async function checkAuth() {
  try {
    // Check if session has expired
    if (isSessionExpired()) {
      // Session expired, logout if authenticated
      const authClient = await AuthClient.create();
      if (await authClient.isAuthenticated()) {
        await authClient.logout();
        clearLoginTimestamp();
      }
      return null;
    }
    
    const authClient = await AuthClient.create();
    const isAuthenticated = await authClient.isAuthenticated();
    
    if (isAuthenticated) {
      // Update login timestamp if authenticated (to refresh session on activity)
      setLoginTimestamp();
      return authClient.getIdentity();
    } else {
      // Not authenticated, clear timestamp
      clearLoginTimestamp();
    }
    return null;
  } catch (error) {
    console.error("Error in checkAuth:", error);
    return null;
  }
}

/**
 * Get current authenticated user's principal
 */
export async function getCurrentPrincipal() {
  const identity = await checkAuth();
  if (identity) {
    return identity.getPrincipal();
  }
  return null;
}

/**
 * Build and return an HttpAgent bound to the given identity.
 */
export async function makeAgent(identity) {
  const agent = new HttpAgent({ 
    identity, 
    host: HOST,
  });

  // Disable verification for local development
  const isLocal = HOST.includes("localhost") || HOST.includes("127.0.0.1");
  if (isLocal) {
    try {
      if (agent.verifyQuerySignatures !== undefined) {
        agent.verifyQuerySignatures = false;
      }
      if (agent.verifyUpdateSignatures !== undefined) {
        agent.verifyUpdateSignatures = false;
      }
    } catch (e) {
      console.warn("Could not disable signature verification:", e);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    await agent.fetchRootKey();
  }

  return agent;
}

/**
 * Create authenticated actors using the same identity (and local host).
 */
export async function makeAuthedActors(identity) {
  if (!identity) {
    throw new Error("Identity is required to create authenticated actors");
  }

  // Canister IDs are injected by webpack via process.env
  // They should be available if the app was built/started with webpack
  if (!opendCanisterId) {
    console.error("opendCanisterId is undefined. Make sure you've run 'npm start' or 'npm run build'");
    throw new Error("opendCanisterId is not defined. Please run 'npm start' or rebuild the app with webpack.");
  }

  if (!tokenCanisterId) {
    console.error("tokenCanisterId is undefined. Make sure you've run 'npm start' or 'npm run build'");
    throw new Error("tokenCanisterId is not defined. Please run 'npm start' or rebuild the app with webpack.");
  }

  const isLocal = HOST.includes("localhost") || HOST.includes("127.0.0.1");
  
  // Create agent with the authenticated identity
  const agent = new HttpAgent({
    identity,
    host: HOST,
  });
  
  // Disable verification for local development
  if (isLocal) {
    try {
      if (agent.verifyQuerySignatures !== undefined) {
        agent.verifyQuerySignatures = false;
      }
      if (agent.verifyUpdateSignatures !== undefined) {
        agent.verifyUpdateSignatures = false;
      }
    } catch (e) {
      // Ignore if not supported
    }
  }
  
  // Fetch root key for local development
  if (process.env.NODE_ENV !== "production" || isLocal) {
    await agent.fetchRootKey();
  }

  // Create actors using the agent we created (this preserves the identity)
  const opend = createOpendActor(opendCanisterId, {
    agent,
  });

  const token = createTokenActor(tokenCanisterId, {
    agent,
  });

  return { agent, opend, token };
}

/**
 * Get authenticated actors for current user
 */
export async function getAuthedActors() {
  const identity = await checkAuth();
  if (!identity) {
    throw new Error("User not authenticated. Please login first.");
  }
  
  const principal = identity.getPrincipal();
  if (!principal) {
    throw new Error("Identity does not have a valid principal.");
  }
  
  console.log("Creating authenticated actors for principal:", principal.toText());
  return await makeAuthedActors(identity);
}

