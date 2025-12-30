
# To Install and Run the Project

## Pre-Steps

i. Delete the ```.dfx, dist, and node_module``` folders

ii. Run ```npm install``` on terminal

## Internet Identity Setup (For Biometric Login)

This project uses Internet Identity for secure, biometric authentication. 

**IMPORTANT for Local Development:**
- **You MUST deploy Internet Identity locally** - production Internet Identity cannot be used with local canisters due to certificate verification issues
- The app is configured to use local Internet Identity by default (canister ID: `rdmx6-jaaaa-aaaaa-aaadq-cai`)
- If you see 403 errors, it means Internet Identity is not deployed locally

**Browser Compatibility Notes:**

- **Safari (Recommended for Local Development)**: 
  - Internet Identity login works well
  - After authentication, the page automatically reloads once to sync authentication state
  - This is normal and happens automatically

- **Chrome**: 
  - **Setup Required**: Chrome requires specific settings to work with local Internet Identity
  - **See [CHROME_SETUP.md](./CHROME_SETUP.md) for detailed setup instructions**
  - Quick checklist:
    1. ✅ Enable "Allow all cookies" in Chrome Settings
    2. ✅ Allow insecure content for `[*.]localhost` and `[*.]127.0.0.1`
    3. ✅ Clear all browsing data (cookies, cache, site settings)
    4. ✅ Disable ALL extensions temporarily
    5. ✅ Test Internet Identity directly: `http://localhost:8000/?canisterId=uxrrr-q7777-77774-qaaaq-cai`
  - **If Internet Identity page still doesn't load**: Chrome's security policies may be blocking it. Use Safari for local development instead.
  - **Alternative**: For Chrome testing, you can use production Internet Identity (see CHROME_SETUP.md), but this will cause certificate issues with local canisters
  
**Note**: After successful login, the page automatically reloads once to sync authentication state. If it doesn't reload automatically, manually refresh the page.

**IMPORTANT: dfx 0.9.3 Compatibility Issue**

**The Problem:** dfx 0.9.3 is too old to run modern Internet Identity WASM files. You'll get "Unknown opcode 194" errors.

**Solutions (choose one):**

### Option 1: Upgrade dfx (RECOMMENDED)
```bash
# Install dfxup if you don't have it
curl -L https://github.com/kritzcreek/dfxup/releases/latest/download/dfxup-x86_64-apple-darwin -o ~/bin/dfxup
chmod +x ~/bin/dfxup

# Or if using homebrew
brew install dfinity/tap/dfx

# Upgrade dfx
dfx upgrade
```

Then follow the normal deployment steps.

### Option 2: Use Production Internet Identity (Workaround)
For local testing, you can temporarily use production Internet Identity, but you'll need to:
1. Comment out the certificate verification (already attempted in code)
2. Accept that some operations may have limitations

### Option 3: Skip Authentication for Local Testing
Temporarily modify the code to use anonymous identity for local testing only.

**Current Status:** Internet Identity cannot be deployed locally with dfx 0.9.3 due to WASM compatibility. You must either upgrade dfx or use production II with workarounds.

**For Production:**
- The app will automatically use `https://identity.ic0.app` when deployed to the Internet Computer

## Main Steps


1. start local dfx

```
dfx start --clean
```

2. Run NPM server

```
npm start
```

3. Deploy canisters (in order):

**Note:** With newer dfx versions, deploy canisters individually:

```bash
# Deploy internet_identity first
dfx deploy internet_identity

# Deploy token
dfx deploy token

# Deploy opend (no arguments needed - it manages NFTs dynamically)
dfx deploy opend

# Deploy opend_assets (depends on opend)
dfx deploy opend_assets
```


