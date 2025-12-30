# Safe dfx Upgrade Guide

## Before Upgrading

1. **Backup your project:**
   ```bash
   cp dfx.json dfx.json.backup
   cp -r .dfx .dfx.backup  # Optional: backup canister state
   ```

2. **Note your current dfx version:**
   ```bash
   dfx --version  # Should show: dfx 0.9.3
   ```

## Upgrade Steps

1. **Upgrade dfx:**
   ```bash
   dfx upgrade
   ```

2. **Verify upgrade:**
   ```bash
   dfx --version  # Should show newer version (0.15.x or later)
   ```

3. **Test your project:**
   ```bash
   # Stop any running dfx
   dfx stop
   
   # Clean start
   dfx start --clean
   
   # Deploy your canisters
   dfx deploy
   ```

4. **If something breaks:**
   ```bash
   # Restore backup
   cp dfx.json.backup dfx.json
   
   # Or revert dfx version (if using dfxup)
   dfxup install 0.9.3
   ```

## What to Expect

- ✅ Your Motoko code will work unchanged
- ✅ Your dfx.json should work with minor or no changes
- ✅ Internet Identity will deploy successfully
- ⚠️ Local canister IDs will be regenerated (this is fine for local dev)
- ⚠️ You may need to redeploy canisters after upgrade

## Alternative: Keep dfx 0.9.3

If you prefer to stay on 0.9.3:
- Use production Internet Identity (has certificate issues)
- Or wait until you're ready to upgrade

The upgrade is recommended because:
- Better Internet Identity support
- Security updates
- Bug fixes
- Better error messages

