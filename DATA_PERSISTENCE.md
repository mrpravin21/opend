# Data Persistence Guide

## Understanding the Problem

When you use `dfx start --clean`, **all canister state is wiped**. However:
- ✅ **Internet Identity principals stay the same** (stored in browser, deterministic)
- ❌ **Canister data is lost** (NFTs, ownership maps, token balances)

## Solution Options

### Option 1: Don't Use `--clean` (Recommended for Local Development)

**Simplest solution**: Just use `dfx start` instead of `dfx start --clean`

```bash
# Preserves all data
dfx start

# Wipes everything (only use when you want to start fresh)
dfx start --clean
```

**Pros:**
- Zero code changes needed
- Data persists naturally
- Works immediately

**Cons:**
- Can't easily reset state
- Old test data accumulates

---

### Option 2: Use Stable Variables (For Production/Upgrades)

Convert `transient` variables to `stable` to persist data across **canister upgrades** (but NOT `--clean`).

**Current code (doesn't persist):**
```motoko
private transient var mapOfOwners = HashMap.HashMap<Principal, List.List<Principal>>(...);
```

**For persistence (across upgrades only):**
```motoko
private stable var ownerEntries : [(Principal, [Principal])] = [];
private var mapOfOwners = HashMap.HashMap<Principal, List.List<Principal>>(...);

system func preupgrade() {
    ownerEntries := Iter.toArray(
        Iter.map(mapOfOwners.entries(), func ((k, v) : (Principal, List.List<Principal>)) : (Principal, [Principal]) {
            (k, List.toArray(v))
        })
    );
};

system func postupgrade() {
    mapOfOwners := HashMap.fromIter<Principal, List.List<Principal>>(
        Iter.map(ownerEntries.vals(), func ((k, v) : (Principal, [Principal])) : (Principal, List.List<Principal>) {
            (k, List.fromArray(v))
        }),
        1, Principal.equal, Principal.hash
    );
    ownerEntries := [];
};
```

**Pros:**
- Data persists across canister upgrades
- Standard IC pattern
- Good for production

**Cons:**
- Still lost with `dfx start --clean`
- More complex code
- Need to handle all data structures

---

### Option 3: Export/Import State (Manual Backup)

Before using `--clean`, export canister state. After restart, import it back.

**Create export functions:**
```motoko
// In opend/main.mo
public query func exportState() : async {
    owners: [(Principal, [Principal])];
    listings: [(Principal, Listing)];
    // ... other data
} {
    // Export all state
};

public shared(msg) func importState(state: {...}) : async Text {
    // Only allow owner/admin
    // Import state
};
```

**Usage:**
```bash
# Before --clean
dfx canister call opend exportState > state.json

# After --clean and redeploy
dfx canister call opend importState "$(cat state.json)"
```

**Pros:**
- Works with `--clean`
- Full control over what to save

**Cons:**
- Manual process
- Need to implement export/import logic
- Complex data structures

---

### Option 4: External Database (For Production)

Use an external database (PostgreSQL, MongoDB, etc.) to store NFT data outside canisters.

**Architecture:**
- Canisters store minimal state
- Database stores: NFTs, owners, listings
- Canisters query database via HTTP outcall or periodic sync

**Pros:**
- True persistence
- Can query/analyze data externally
- Good for production

**Cons:**
- Major architecture change
- Need to maintain database
- Adds complexity
- Still need to map principals correctly

**Principal Mapping:**
- Internet Identity principals are deterministic (same device = same principal)
- Store principal as string: `principal.toText()`
- Always query by the same principal string

---

## Recommendation

**For Local Development:**
- Use `dfx start` (not `--clean`) when you want to keep data
- Use `dfx start --clean` only when you want to reset everything

**For Production:**
- Use stable variables (Option 2) for persistence across upgrades
- Deploy to IC mainnet where `--clean` isn't an option
- Consider database (Option 4) for complex queries/analytics

---

## Key Takeaway

**Internet Identity principals will ALWAYS be the same** (deterministic from device key in browser).

The challenge is **persisting canister state**, not principal mapping. Once you persist state (via any method above), the same principal will access the same data.

