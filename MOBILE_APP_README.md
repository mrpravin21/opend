# OpenD Mobile App — Comprehensive Build Guide

A complete guide to building a React Native mobile application for the OpenD NFT marketplace on the Internet Computer (IC). This document covers setup, architecture, IC integration, Internet Identity, Face ID, and a phased implementation roadmap.

---

## Table of Contents

1. [Overview](#overview)
2. [Feasibility & Backend Compatibility](#feasibility--backend-compatibility)
3. [Prerequisites](#prerequisites)
4. [Tech Stack](#tech-stack)
5. [Architecture](#architecture)
6. [Project Setup](#project-setup)
7. [IC Integration](#ic-integration)
8. [Internet Identity & Face ID](#internet-identity--face-id)
9. [Implementation Roadmap](#implementation-roadmap)
10. [File Structure](#file-structure)
11. [Environment Configuration](#environment-configuration)
12. [Troubleshooting](#troubleshooting)
13. [References](#references)

---

## Overview

OpenD (MintVault) is an NFT marketplace on the Internet Computer with originality checks, DANG token wallet, and quiz rewards. This guide enables you to build an **iOS and Android** mobile app that:

- Uses the **same canisters** as the web app (no backend changes)
- Supports **Internet Identity** login
- Integrates **Face ID** for app unlock
- Reuses logic and design from the existing React web app

---

## Feasibility & Backend Compatibility

| Question | Answer |
|----------|--------|
| Can mobile apps talk to IC canisters? | **Yes.** Canisters are backend-agnostic; they accept standard Candid over HTTPS. |
| Are backend changes required? | **No.** The OpenD, Token, and NFT canisters work with any client. |
| Internet Identity on mobile? | **Yes.** II uses WebAuthn; iOS/Android browsers support platform authenticators (Face ID, fingerprint). |
| Face ID integration? | **Yes.** For II login (via WebAuthn in a browser/WebView) and for app unlock after login. |

---

## Prerequisites

### Mac (Recommended for iOS Development)

- **Xcode** 14+ (for iOS builds and simulator)
- **Xcode Command Line Tools**: `xcode-select --install`
- **CocoaPods**: `sudo gem install cocoapods`
- **Node.js** 18+ and npm

### Android (Optional)

- **Android Studio** with SDK 33+
- **Java 17** (via Android Studio or `brew install openjdk@17`)

### IC / OpenD Project

- **dfx** installed and working: `dfx --version`
- OpenD project running locally: `dfx start` and `dfx deploy`
- Canister IDs from `.dfx/local/canister_ids.json` or production network

### Accounts

- **Apple Developer Account** (for TestFlight and App Store)
- **Internet Identity** anchor (create at https://identity.ic0.app for mainnet, or via local II for dev)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React Native (Expo or bare workflow) |
| **Language** | TypeScript |
| **IC SDK** | @dfinity/agent, @dfinity/auth-client, @dfinity/identity |
| **Navigation** | React Navigation 6 |
| **State** | React Context + hooks (mirror web app) |
| **Biometrics** | react-native-biometrics |
| **Secure Storage** | react-native-keychain |

**Why React Native?**

- Reuse React components and logic from the web app
- IC JavaScript SDK works out of the box
- Single codebase for iOS and Android
- Strong ecosystem and community support

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     OpenD Mobile App (React Native)                       │
├─────────────────────────────────────────────────────────────────────────┤
│  Screens                                                                 │
│  • Landing  • Discover  • NFT Detail  • My NFTs  • Minter  • Wallet     │
│  • Quiz     • Profile   • Settings                                        │
├─────────────────────────────────────────────────────────────────────────┤
│  Shared Logic (from web / reusable)                                      │
│  • IC Agent setup  • Auth context  • NFT/Token/OpenD actor calls         │
│  • Candid bindings (opend, token, nft declarations)                      │
├─────────────────────────────────────────────────────────────────────────┤
│  Native Modules                                                          │
│  • Face ID (react-native-biometrics)  • Keychain  • Deep Links           │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ HTTPS / Candid
┌─────────────────────────────────────────────────────────────────────────┐
│                    Internet Computer (unchanged)                          │
│  • Internet Identity  • OpenD  • Token  • NFT canisters  • opend_assets  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Project Setup

### 1. Create React Native Project

```bash
# Using React Native CLI (recommended for native modules like Face ID)
npx @react-native-community/cli init OpenDMobile --template react-native-template-typescript

cd OpenDMobile
```

### 2. Install IC Dependencies

```bash
npm install @dfinity/agent @dfinity/auth-client @dfinity/identity @dfinity/principal @dfinity/candid
```

### 3. Install Navigation & UI

```bash
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context
```

### 4. Install Biometrics & Secure Storage

```bash
npm install react-native-biometrics react-native-keychain
cd ios && pod install && cd ..
```

### 5. Copy Declarations

Copy the Candid/TypeScript declarations from the web app so the mobile app can call the same canisters:

```bash
# From project root
mkdir -p mobile/OpenDMobile/src/declarations
cp -r src/declarations/opend src/declarations/token src/declarations/nft mobile/OpenDMobile/src/declarations/
```

---

## IC Integration

### Host Configuration

| Environment | Host |
|-------------|------|
| Local dev | `http://127.0.0.1:8000` (or `http://localhost:8000`) |
| Mainnet | `https://mainnet.dfinity.network` |
| Identity | `https://identity.ic0.app` (mainnet) or local II for dev |

### Canister IDs

Obtain from `dfx canister id <canister_name>` or `.dfx/<network>/canister_ids.json`:

```typescript
// src/config/canisters.ts
export const CANISTER_IDS = {
  opend: process.env.OPEND_CANISTER_ID || 'rrkah-fqaaa-aaaaa-aaaaq-cai',
  token: process.env.TOKEN_CANISTER_ID || '...',
  opend_assets: process.env.OPEND_ASSETS_CANISTER_ID || '...',
};

export const IC_HOST = process.env.IC_HOST || 'http://127.0.0.1:8000';
export const IDENTITY_PROVIDER = process.env.IDENTITY_PROVIDER || 'https://identity.ic0.app';
```

### Agent Setup (Shared Pattern)

```typescript
// src/ic/agent.ts
import { HttpAgent } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { IDENTITY_PROVIDER, IC_HOST } from '../config/canisters';

export async function createAgent() {
  const authClient = await AuthClient.create();
  const identity = await authClient.getIdentity();
  const agent = new HttpAgent({
    identity,
    host: IC_HOST,
  });
  await agent.fetchRootKey(); // Remove for mainnet
  return { agent, authClient, identity };
}
```

### Actor Creation

```typescript
// src/ic/actors.ts
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory as opendIdl } from '../declarations/opend';
import { idlFactory as tokenIdl } from '../declarations/token';
import { CANISTER_IDS } from '../config/canisters';

export function createOpenDActor(agent: HttpAgent) {
  return Actor.createActor(opendIdl, {
    agent,
    canisterId: CANISTER_IDS.opend,
  });
}

export function createTokenActor(agent: HttpAgent) {
  return Actor.createActor(tokenIdl, {
    agent,
    canisterId: CANISTER_IDS.token,
  });
}
```

---

## Internet Identity & Face ID

### How II Works on Mobile

1. App opens the II URL in a WebView or in-app browser.
2. User enters anchor or creates one.
3. II triggers WebAuthn; the device can use Face ID or Touch ID as the platform authenticator.
4. On success, II redirects back with a delegation; the app stores it and creates an authenticated agent.

### Implementation Approach

1. **Login flow**: Use `AuthClient.login()` which opens a browser window. On mobile, ensure the in-app browser (e.g. `expo-web-browser` or `react-native-webview`) handles the redirect correctly.
2. **Delegation storage**: Store the delegation in Keychain via `react-native-keychain`.
3. **Face ID for app unlock**: After login, optionally require Face ID to unlock the app and load the stored identity.

### Face ID App Unlock (Optional)

```typescript
// src/services/biometrics.ts
import ReactNativeBiometrics from 'react-native-biometrics';

const rnBiometrics = new ReactNativeBiometrics();

export async function isBiometricAvailable(): Promise<boolean> {
  const { available } = await rnBiometrics.isSensorAvailable();
  return available;
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  const { success } = await rnBiometrics.simplePrompt({
    promptMessage: 'Unlock OpenD',
    cancelButtonText: 'Cancel',
  });
  return success;
}
```

### Keychain for Identity

```typescript
// src/services/keychain.ts
import * as Keychain from 'react-native-keychain';

const IDENTITY_KEY = 'opend_identity';

export async function saveIdentity(serializedIdentity: string) {
  await Keychain.setGenericPassword(IDENTITY_KEY, serializedIdentity, {
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadIdentity(): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword();
  return credentials ? credentials.password : null;
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1–2)

- [ ] Create React Native project
- [ ] Add IC SDK and copy declarations
- [ ] Configure canister IDs and hosts
- [ ] Implement Internet Identity login flow
- [ ] Verify auth, principal, and basic canister calls

**Deliverable:** User can log in with II and see their principal.

---

### Phase 2: Core Screens (Weeks 3–5)

- [ ] **Landing** – Hero, features, CTA
- [ ] **Discover** – NFT grid, load from `getListedNFTs`
- [ ] **NFT Detail** – Image, name, owner, price, Buy button
- [ ] **My NFTs** – `getOwnedNFTs`, grid with Sell
- [ ] **Wallet** – Balance, Claim DANG, Transfer, transaction list
- [ ] **Minter** – Upload image, name, mint
- [ ] **Quiz** – Link or WebView to quiz service

**Deliverable:** Main flows (discover, buy, sell, mint, wallet) working.

---

### Phase 3: Native UX (Weeks 6–7)

- [ ] Bottom tab navigation
- [ ] Pull-to-refresh on lists
- [ ] Image caching and lazy loading
- [ ] Safe area and notch handling
- [ ] Dark theme aligned with web
- [ ] Basic haptics

**Deliverable:** Polished, native-feeling UI.

---

### Phase 4: Biometrics & Security (Week 8)

- [ ] Add `react-native-biometrics` and `react-native-keychain`
- [ ] Optional Face ID app unlock
- [ ] Secure storage for identity
- [ ] Clear permission and fallback flows

**Deliverable:** Optional biometric unlock and secure storage.

---

### Phase 5: Polish (Weeks 9–10)

- [ ] Animations and transitions
- [ ] Share NFT (deep link or image)
- [ ] Deep links (`opend://nft/{id}`)
- [ ] App Store / Play Store assets and metadata

**Deliverable:** TestFlight / internal testing ready.

---

## File Structure

```
OpenDMobile/
├── src/
│   ├── config/
│   │   └── canisters.ts
│   ├── declarations/          # Copied from web app
│   │   ├── opend/
│   │   ├── token/
│   │   └── nft/
│   ├── ic/
│   │   ├── agent.ts
│   │   └── actors.ts
│   ├── contexts/
│   │   └── AuthContext.tsx
│   ├── screens/
│   │   ├── LandingScreen.tsx
│   │   ├── DiscoverScreen.tsx
│   │   ├── NFTDetailScreen.tsx
│   │   ├── MyNFTsScreen.tsx
│   │   ├── MinterScreen.tsx
│   │   ├── WalletScreen.tsx
│   │   └── QuizScreen.tsx
│   ├── components/
│   │   ├── NFTCard.tsx
│   │   ├── Header.tsx
│   │   └── ...
│   ├── services/
│   │   ├── biometrics.ts
│   │   └── keychain.ts
│   └── App.tsx
├── ios/
├── android/
├── .env
└── package.json
```

---

## Environment Configuration

Create `.env` in the mobile project root:

```env
# Local development
IC_HOST=http://127.0.0.1:8000
IDENTITY_PROVIDER=https://identity.ic0.app

# Canister IDs (from dfx canister id <name>)
OPEND_CANISTER_ID=rrkah-fqaaa-aaaaa-aaaaq-cai
TOKEN_CANISTER_ID=...
OPEND_ASSETS_CANISTER_ID=...

# Quiz API (if used)
QUIZ_API_URL=http://localhost:3000
```

For mainnet, use mainnet host and canister IDs.

---

## Troubleshooting

### "Cannot connect to IC"

- Ensure `dfx start` is running (local) or you use mainnet host.
- On simulator/emulator, use `http://10.0.2.2:8000` (Android) or `http://127.0.0.1:8000` (iOS) for local replica.

### Internet Identity redirect fails

- Ensure the app's custom URL scheme or universal links are set for the II callback.
- Test in a WebView that supports redirects and cookies.

### Face ID not prompting

- Check `Info.plist` for `NSFaceIDUsageDescription`.
- Verify `react-native-biometrics` is linked: `cd ios && pod install`.

### "Agent root key" / certificate errors

- For local dev, call `agent.fetchRootKey()`.
- For mainnet, do **not** call `fetchRootKey()`.

### Metro / build errors with IC packages

- Add polyfills if needed (e.g. `buffer`, `process`) — React Native may require them for some IC SDK code.
- Consider `react-native-get-random-values` for crypto.

---

## References

- [Internet Computer Docs](https://internetcomputer.org/docs)
- [IC SDK (JavaScript)](https://github.com/dfinity/agent-js)
- [Internet Identity](https://identity.ic0.app)
- [React Native](https://reactnative.dev)
- [React Navigation](https://reactnavigation.org)
- [react-native-biometrics](https://github.com/SelfLender/react-native-biometrics)
- [react-native-keychain](https://github.com/oblador/react-native-keychain)

---

## Quick Start Commands

```bash
# 1. Create project
npx @react-native-community/cli init OpenDMobile --template react-native-template-typescript
cd OpenDMobile

# 2. Install deps
npm install @dfinity/agent @dfinity/auth-client @dfinity/identity @dfinity/principal
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-biometrics react-native-keychain
cd ios && pod install && cd ..

# 3. Run
npx react-native run-ios
# or
npx react-native run-android
```

---

*Last updated: February 2025*
