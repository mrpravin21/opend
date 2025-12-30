
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
# Deploy token first
dfx deploy token

# Deploy opend (no arguments needed - it manages NFTs dynamically)
dfx deploy opend

# Deploy opend_assets (depends on opend)
dfx deploy opend_assets
```

**Note:** 
- The `opend` canister doesn't need initialization arguments - it creates NFTs dynamically via the `mint` function
- If you see a panic about "Failed to set stderr output color", this is a known display issue in dfx 0.30.1 and doesn't affect deployment. The canisters will still deploy successfully.
- The `nft`j canister in dfx.json is a template/class used by opend to create NFT instances dynamically - you don't need to deploy it separately



# Creating NFT for Testing

1. Mint an NFT on the command line to get NFT into mapOfNFTs:

```
dfx canister call opend mint '(vec {137; 80; 78; 71; 13; 10; 26; 10; 0; 0; 0; 13; 73; 72; 68; 82; 0; 0; 0; 10; 0; 0; 0; 10; 8; 6; 0; 0; 0; 141; 50; 207; 189; 0; 0; 0; 1; 115; 82; 71; 66; 0; 174; 206; 28; 233; 0; 0; 0; 68; 101; 88; 73; 102; 77; 77; 0; 42; 0; 0; 0; 8; 0; 1; 135; 105; 0; 4; 0; 0; 0; 1; 0; 0; 0; 26; 0; 0; 0; 0; 0; 3; 160; 1; 0; 3; 0; 0; 0; 1; 0; 1; 0; 0; 160; 2; 0; 4; 0; 0; 0; 1; 0; 0; 0; 10; 160; 3; 0; 4; 0; 0; 0; 1; 0; 0; 0; 10; 0; 0; 0; 0; 59; 120; 184; 245; 0; 0; 0; 113; 73; 68; 65; 84; 24; 25; 133; 143; 203; 13; 128; 48; 12; 67; 147; 94; 97; 30; 24; 0; 198; 134; 1; 96; 30; 56; 151; 56; 212; 85; 68; 17; 88; 106; 243; 241; 235; 39; 42; 183; 114; 137; 12; 106; 73; 236; 105; 98; 227; 152; 6; 193; 42; 114; 40; 214; 126; 50; 52; 8; 74; 183; 108; 158; 159; 243; 40; 253; 186; 75; 122; 131; 64; 0; 160; 192; 168; 109; 241; 47; 244; 154; 152; 112; 237; 159; 252; 105; 64; 95; 48; 61; 12; 3; 61; 167; 244; 38; 33; 43; 148; 96; 3; 71; 8; 102; 4; 43; 140; 164; 168; 250; 23; 219; 242; 38; 84; 91; 18; 112; 63; 0; 0; 0; 0; 73; 69; 78; 68; 174; 66; 96; 130;}, "CryptoDunks #123")'
```

2. List the item into mapOfListings:

```
dfx canister call opend listItem '(principal "rdmx6-jaaaa-aaaaa-aaadq-cai", 20)'
```

3. Get OpenD canister ID:

```
dfx canister id opend
```

4. Transfer NFT to OpenD:

```
dfx canister call rdmx6-jaaaa-aaaaa-aaadq-cai transferOwnership '(principal "ryjl3-tyaaa-aaaaa-aaaba-cai", true)'
```

# Conneting to the Token Canister

1. Copy over the token declarations folder

2. Set the token canister id into the <REPLACE WITH TOKEN CANISTER ID>

```
const dangPrincipal = Principal.fromText("<REPLACE WITH TOKEN CANISTER ID>");
```
5. Set the canister id to a local variable:

```
CANISTER_PUBLIC_KEY="principal \"$( \dfx canister id token )\""
```

6. Transfer half a billion tokens to the canister Principal ID:

```
dfx canister call token transfer "($CANISTER_PUBLIC_KEY, 500_000_000)"
```

7. Claim the tokens from the faucet on the frontend website.

8. Get token canister id:

```
dfx canister id token
```
