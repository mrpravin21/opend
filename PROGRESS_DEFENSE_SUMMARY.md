# OpenD NFT Marketplace - Technical Progress Defense Summary

## Executive Summary

This project implements a decentralized NFT marketplace on the Internet Computer Protocol (ICP) with integrated originality verification, token-based economy, and gamified quiz rewards. The system uses a microservices architecture combining on-chain smart contracts (Motoko canisters) with off-chain services (Next.js API, Supabase database, Python ML service) to provide a complete NFT minting, trading, and verification platform.

---

## 1. Project Architecture Overview

### 1.1 System Components

The project consists of three main subsystems:

1. **NFT Marketplace (ICP Canisters)** - On-chain smart contracts for NFT management
2. **Quiz Application (Next.js)** - Independent quiz service with points system
3. **Originality Verification Service** - ML-based duplicate detection system

### 1.2 Technology Stack

- **Blockchain**: Internet Computer Protocol (ICP)
- **Smart Contracts**: Motoko programming language
- **Frontend**: React.js with Webpack bundling
- **Backend API**: Next.js 13+ (App Router) with TypeScript
- **Database**: Supabase (PostgreSQL with pgvector extension)
- **ML Service**: Python FastAPI microservice
- **Authentication**: Internet Identity (ICP's native authentication)

---

## 2. Blockchain Implementation: ICP Canisters

### 2.1 What are ICP Canisters?

ICP Canisters are **stateful smart contracts** that run on the Internet Computer blockchain. Unlike traditional blockchains where smart contracts are stateless, ICP canisters maintain persistent state and can store data directly on-chain. Each canister is an isolated WebAssembly (WASM) runtime that can:
- Store persistent data
- Execute complex business logic
- Interact with other canisters
- Serve web content directly

### 2.2 Canister Architecture in This Project

The project uses **four main canisters**:

#### 2.2.1 NFT Canister (`nft.mo`)
- **Type**: Actor class (factory pattern)
- **Purpose**: Individual NFT instances
- **State**: Each NFT stores its own:
  - Name (Text)
  - Owner (Principal ID)
  - Image content ([Nat8] - raw image bytes)
- **Functions**:
  - `getName()`: Returns NFT name
  - `getOwner()`: Returns current owner's Principal ID
  - `getAsset()`: Returns image bytes
  - `transferOwnership(newOwner)`: Transfers ownership (only current owner can call)

**Key Design**: Each NFT is deployed as its own canister, providing true decentralization and ownership isolation.

#### 2.2.2 OpenD Canister (`opend/main.mo`)
- **Type**: Persistent actor (main marketplace)
- **Purpose**: NFT marketplace orchestrator
- **State**:
  - `mapOfNFTs`: HashMap mapping NFT Principal IDs to NFT actor instances
  - `mapOfOwners`: HashMap mapping user Principal IDs to their owned NFT lists
  - `mapOfListings`: HashMap mapping NFT IDs to listing information (owner, price)
- **Key Functions**:
  - `mint(imgData, name)`: Creates new NFT canister, allocates cycles, stores reference
  - `listItem(id, price)`: Lists NFT for sale
  - `getListedNFTs()`: Returns all NFTs currently for sale
  - `completePurchase(id, ownerId, newOwnerId)`: Executes purchase and transfers ownership
  - `getOwnedNFTs(user)`: Returns user's NFT collection

**Cycles Management**: The OpenD canister manages ICP cycles (computation cost) for NFT creation. Each mint requires ~2.5 trillion cycles (2.5 TC) to deploy the new NFT canister.

#### 2.2.3 Token Canister (`token/main.mo`)
- **Type**: Persistent actor
- **Purpose**: ERC-20-like fungible token (DANG tokens)
- **State**:
  - `balances`: HashMap of Principal → token balance
  - `transactions`: HashMap of Principal → transaction history
  - `totalSupply`: 1 billion DANG tokens (initialized to owner)
- **Functions**:
  - `balanceOf(who)`: Query user's token balance
  - `transfer(to, amount)`: Transfer tokens between users
  - `transferWithDescription(to, amount, description)`: Transfer with transaction description
  - `rewardQuiz(amount)`: Owner transfers tokens as quiz rewards
  - `payOut()`: Faucet function for new users (10,000 tokens)
  - `getTransactions(user)`: Returns user's transaction history

**Transaction System**: All transfers are logged with timestamps, amounts, and descriptions for both sender (debit) and receiver (credit).

#### 2.2.4 OpenD Assets Canister (`opend_assets`)
- **Type**: Asset canister (static files)
- **Purpose**: Serves frontend React application
- **Content**: Bundled JavaScript, CSS, HTML, images

### 2.3 Canister Deployment Process

1. **Development Setup**:
   ```bash
   dfx start --clean  # Start local ICP replica
   ```

2. **Deployment Order** (due to dependencies):
   ```bash
   dfx deploy internet_identity  # Authentication service
   dfx deploy token              # Token canister
   dfx deploy opend              # Main marketplace (creates NFT canisters dynamically)
   dfx deploy opend_assets       # Frontend (depends on opend)
   ```

3. **Build Process**:
   - Motoko code compiles to WebAssembly (WASM)
   - `dfx.json` defines canister configurations
   - Each canister gets a unique Principal ID (e.g., `vg3po-ix777-77774-qaafa-cai`)

4. **State Persistence**:
   - Canisters use `preupgrade()` and `postupgrade()` hooks
   - State serialized to stable variables before upgrades
   - Data persists across canister upgrades

### 2.4 How NFTs Are Put On-Chain

**Minting Flow**:

1. **User Action**: User uploads image and name via frontend (`Minter.jsx`)

2. **Originality Check** (off-chain, see Section 4):
   - Frontend calls `/api/nft/check-originality`
   - ML service generates pHash and embedding
   - Database checked for duplicates
   - If duplicate found, minting is **blocked**

3. **On-Chain Minting** (if originality check passes):
   ```motoko
   // In opend/main.mo
   public shared(msg) func mint(imgData: [Nat8], name: Text) : async Principal {
     // 1. Check cycles balance (need ~2.5 TC)
     // 2. Add cycles for new NFT canister creation
     Cycles.add(2_000_000_000_000);
     
     // 3. Create new NFT canister instance
     let newNFT = await NFTActorClass.NFT(name, msg.caller, imgData);
     
     // 4. Get the new NFT's Principal ID
     let newNFTPrincipal = await newNFT.getCanisterId();
     
     // 5. Store reference in marketplace
     mapOfNFTs.put(newNFTPrincipal, newNFT);
     addToOwnershipMap(msg.caller, newNFTPrincipal);
     
     return newNFTPrincipal;
   }
   ```

4. **NFT Storage**:
   - Image bytes stored **directly in the NFT canister** (on-chain)
   - No external IPFS or centralized storage needed
   - Each NFT is a self-contained canister with its own Principal ID

5. **Metadata Storage** (off-chain):
   - After successful mint, frontend calls `/api/nft/store-metadata`
   - Stores pHash, embedding, originality scores in Supabase
   - Used for future duplicate detection

---

## 3. NFT Standard

### 3.1 Custom NFT Standard (Not ICRC-7)

**Important**: This project uses a **custom NFT standard**, not ICRC-7 or any other standard protocol.

**ICRC-7** is a proposed token standard for NFTs on ICP (similar to ERC-721 on Ethereum), but this project implements a simpler, custom interface.

### 3.2 Our NFT Interface (Candid Definition)

```candid
type NFT = service {
  getAsset: () -> (vec nat8) query;           // Returns image bytes
  getCanisterId: () -> (principal) query;    // Returns NFT's Principal ID
  getName: () -> (text) query;                // Returns NFT name
  getOwner: () -> (principal) query;          // Returns current owner
  transferOwnership: (principal) -> (text);  // Transfers ownership
};
```

### 3.3 Design Decisions

1. **One NFT = One Canister**: Each NFT is its own canister, providing:
   - True decentralization (no single point of failure)
   - Independent upgradeability
   - Isolated state and computation

2. **On-Chain Storage**: Images stored directly in canister state (not IPFS)
   - Pros: No external dependencies, guaranteed availability
   - Cons: Higher cycle costs for large images

3. **Simple Ownership Model**: Direct ownership transfer (no approval system like ERC-721)

---

## 4. Originality Verification: pHash and ML Detection

### 4.1 Problem Statement

Prevent users from minting:
- **Exact duplicates**: Same image file
- **Near-duplicates**: Slightly modified images (cropped, filtered, resized)
- **Derivatives**: Heavily edited but visually similar images

### 4.2 Three-Layer Detection System

#### Layer 1: Exact Duplicate Detection (SHA-256 Hash)

**Algorithm**: SHA-256 cryptographic hash of raw image bytes

**Implementation**:
```typescript
const imageHash = crypto.createHash('sha256')
  .update(imageBuffer)
  .digest('hex');
```

**How it works**:
- Any change to image bytes (even 1 pixel) produces completely different hash
- Perfect for detecting identical files
- **Limitation**: Cannot detect visually similar but different files

**Database Query**:
```sql
SELECT * FROM nfts WHERE image_hash = 'abc123...' LIMIT 1;
```

If match found → **Block minting immediately**

---

#### Layer 2: Perceptual Hash (pHash) with Hamming Distance

**What is pHash?**

pHash (perceptual hash) is an algorithm that generates a hash based on **visual content** rather than raw bytes. Similar images produce similar hashes, even if:
- Image is resized
- Colors are adjusted
- Minor edits are made
- Format is converted (PNG → JPEG)

**Algorithm Used**: **DCT-based pHash** (Discrete Cosine Transform)

**Implementation** (Python ML Service):
```python
from PIL import Image
import imagehash

# Generate 16x16 pHash (256-bit hash)
h = imagehash.phash(img, hash_size=16)
# Returns hex string like: "9e65331964c69b39ce5961b36736669b..."
```

**How DCT pHash Works**:

1. **Image Preprocessing**:
   - Convert to grayscale
   - Resize to small size (e.g., 32x32 pixels)

2. **DCT Transformation**:
   - Apply 2D Discrete Cosine Transform
   - DCT converts image from spatial domain to frequency domain
   - Low-frequency components represent overall structure/shape
   - High-frequency components represent fine details

3. **Hash Generation**:
   - Extract low-frequency DCT coefficients (top-left region)
   - Compare each coefficient to median value
   - Generate binary hash: 1 if coefficient > median, 0 otherwise
   - Convert to hex string

4. **Why DCT?**
   - DCT is used in JPEG compression
   - Captures perceptual features humans notice
   - Robust to minor edits (brightness, contrast, small crops)

**Hamming Distance Calculation**:

```typescript
function hammingDistance(phash1: string, phash2: string): number {
  if (phash1.length !== phash2.length) return Infinity;
  
  let dist = 0;
  for (let i = 0; i < phash1.length; i++) {
    if (phash1[i] !== phash2[i]) dist++;
  }
  return dist;
}
```

**Hamming Distance** = Number of differing characters between two pHash strings

**Example**:
- pHash 1: `"9e65331964c69b39ce5961b36736669b..."`
- pHash 2: `"9e67331964c69b398e5961b3673666db..."`
- Hamming Distance: 4 (4 characters differ)

**Threshold**: `PHASH_DUPLICATE_THRESHOLD = 8`
- If Hamming Distance ≤ 8 → **Block minting** (too similar)
- If Hamming Distance > 8 → Allow (sufficiently different)

**Similarity Score Calculation**:
```typescript
const maxLen = phash.length;  // e.g., 64 characters
const similarity = ((maxLen - hammingDistance) / maxLen) * 100;
const originality = 100 - similarity;
```

**Database Comparison**:
```typescript
// Fetch all NFTs with valid pHashes
const allNftPHashes = await supabase
  .from('nfts')
  .select('nft_principal_id, name, phash')
  .filter('phash', 'length', '>=', 32);  // Only real pHashes

// Compare against all existing NFTs
for (const existingNFT of allNftPHashes) {
  const dist = hammingDistance(newPHash, existingNFT.phash);
  if (dist < minHamming) {
    minHamming = dist;
    closestNFT = existingNFT;
  }
}
```

---

#### Layer 3: ML Embedding Similarity (Vector Search)

**What is an Embedding?**

An embedding is a **high-dimensional vector** (512 dimensions) that represents an image's semantic content. Similar images have similar vectors (high cosine similarity).

**Current Implementation**: **Simple Grayscale Downsample** (not deep learning)

**Algorithm** (Python):
```python
def compute_simple_embedding(img: Image.Image) -> np.ndarray:
    # 1. Convert to grayscale
    img_gray = img.convert("L")
    
    # 2. Resize to 32x16 (512 pixels total)
    img_resized = img_gray.resize((32, 16))
    
    # 3. Flatten to 512-dim vector
    arr = np.asarray(img_resized, dtype=np.float32).reshape(-1)
    
    # 4. Normalize (zero mean, unit variance)
    arr = arr - arr.mean()
    arr = arr / (arr.std() + 1e-8)
    
    # 5. L2 normalize for cosine similarity
    arr = arr / (np.linalg.norm(arr) + 1e-8)
    
    return arr  # 512-dim vector
```

**Why This Approach?**
- **Offline**: No internet required (no pretrained model downloads)
- **Fast**: Simple pixel-based computation
- **Lightweight**: No GPU required
- **Limitation**: Less sophisticated than ResNet/ViT embeddings

**Vector Similarity Search** (PostgreSQL with pgvector):

```sql
-- Create vector index
CREATE INDEX idx_nfts_embedding ON nfts 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Find similar NFTs
CREATE FUNCTION find_similar_nfts(
  query_embedding VECTOR(512),
  similarity_threshold DECIMAL DEFAULT 0.90,
  limit_count INT DEFAULT 5
)
RETURNS TABLE (...) AS $$
  SELECT 
    nft_principal_id,
    name,
    (1 - (embedding <=> query_embedding))::DECIMAL as similarity_score
  FROM nfts
  WHERE (1 - (embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY embedding <=> query_embedding  -- Cosine distance
  LIMIT limit_count;
$$;
```

**Cosine Similarity**:
- `<=>` operator = cosine distance (0 = identical, 1 = completely different)
- `similarity = 1 - distance` (0 = different, 1 = identical)
- Threshold: `similarity_threshold = 0.90` (90% similar)

**Approval Logic**:
```typescript
const APPROVAL_THRESHOLD = 10;  // Minimum 10% originality
const approved = originalityScore >= APPROVAL_THRESHOLD 
                 && similarityScore < 90;
```

---

### 4.3 Complete Detection Flow

```
User uploads image
    ↓
1. SHA-256 hash → Check exact duplicate
    ├─ Match found? → BLOCK MINTING
    └─ No match → Continue
    ↓
2. Generate pHash (via ML service)
    ↓
3. Compare pHash with all existing NFTs (Hamming Distance)
    ├─ Distance ≤ 8? → BLOCK MINTING
    └─ Distance > 8 → Continue
    ↓
4. Generate embedding (via ML service)
    ↓
5. Vector similarity search (pgvector)
    ├─ Similarity ≥ 90%? → BLOCK MINTING
    └─ Similarity < 90% → APPROVE MINTING
    ↓
6. Store metadata in database (for future checks)
```

---

## 5. Backend Architecture and API Design

### 5.1 Microservices Architecture

The system uses a **loosely coupled microservices** approach:

```
┌─────────────────┐
│  NFT Frontend   │ (React, ICP Canisters)
│  (opend_assets) │
└────────┬────────┘
         │
         ├─→ ICP Canisters (on-chain)
         │   ├─ OpenD (marketplace)
         │   ├─ NFT (individual NFTs)
         │   └─ Token (DANG tokens)
         │
         └─→ Next.js API (off-chain)
             ├─ /api/nft/check-originality
             ├─ /api/nft/store-metadata
             └─ /api/quiz/*
                 │
                 ├─→ Supabase (PostgreSQL)
                 │   ├─ nfts table
                 │   ├─ originality_checks table
                 │   └─ quiz_points table
                 │
                 └─→ Python ML Service (FastAPI)
                     ├─ /phash
                     └─ /embedding
```

### 5.2 API Endpoints

#### 5.2.1 NFT Originality Check API

**Endpoint**: `POST /api/nft/check-originality`

**Request**:
```typescript
FormData {
  image: File,
  principalId: string,
  name: string
}
```

**Process**:
1. Receive image file
2. Generate SHA-256 hash
3. Check database for exact duplicate
4. Call ML service for pHash generation
5. Compare pHash with all existing NFTs (Hamming Distance)
6. Call ML service for embedding generation
7. Vector similarity search (if embedding available)
8. Return approval/rejection with scores

**Response**:
```json
{
  "approved": false,
  "reason": "duplicate",
  "message": "Image is very similar to an existing NFT",
  "existingNft": {
    "nft_principal_id": "vg3po-ix777-77774-qaafa-cai",
    "name": "Existing NFT"
  },
  "similarityScore": "95.50",
  "originalityScore": "4.50",
  "phashHammingDistance": 4,
  "phash": "9e65331964c69b39...",
  "embedding": [0.123, -0.456, ...]  // 512-dim vector
}
```

**CORS Configuration**:
```typescript
headers: {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}
```

#### 5.2.2 NFT Metadata Storage API

**Endpoint**: `POST /api/nft/store-metadata`

**Request**:
```json
{
  "nftPrincipalId": "vg3po-ix777-77774-qaafa-cai",
  "mintedByPrincipal": "tkc75-5ckrv-bxf3y-...",
  "name": "My NFT",
  "imageHash": "abc123...",
  "phash": "9e65331964c69b39...",
  "embedding": [0.123, -0.456, ...],
  "originalityScore": 95.5,
  "similarityScore": 4.5
}
```

**Process**:
1. Insert NFT metadata into `nfts` table
2. Update user analytics (increment NFT count)
3. Return success confirmation

**Database Schema**:
```sql
CREATE TABLE nfts (
  nft_principal_id TEXT PRIMARY KEY,
  minted_by_principal TEXT NOT NULL,
  name TEXT NOT NULL,
  image_hash TEXT,           -- SHA-256
  phash TEXT,                -- Perceptual hash
  embedding VECTOR(512),     -- ML embedding (pgvector)
  originality_score DECIMAL(5,2),
  similarity_to_existing DECIMAL(5,2),
  most_similar_nft_principal_id TEXT,
  is_verified BOOLEAN,
  mint_status TEXT,
  minted_at TIMESTAMP
);
```

#### 5.2.3 Quiz Points API

**Endpoints**:
- `GET /api/quiz/points?principalId=...` - Fetch user's quiz points
- `POST /api/quiz/start` - Initialize/retrieve quiz session
- `POST /api/quiz/submit` - Submit quiz results, update points
- `POST /api/quiz/claim` - Reset points after token claim

**Integration Flow**:
```
1. User completes quiz → Points stored in Supabase
2. NFT frontend polls /api/quiz/points
3. User clicks "Claim Tokens" → Calls token canister's rewardQuiz()
4. Token transferred on-chain
5. Frontend calls /api/quiz/claim → Points reset to 0
```

### 5.3 ML Service (Python FastAPI)

**Service**: `http://localhost:8001`

**Endpoints**:

1. **POST /phash**
   ```json
   Request: { "image_base64": "iVBORw0KGgo..." }
   Response: { "phash": "9e65331964c69b39..." }
   ```

2. **POST /embedding**
   ```json
   Request: { "image_base64": "iVBORw0KGgo..." }
   Response: { "embedding": [0.123, -0.456, ...] }  // 512-dim
   ```

**Technology**:
- FastAPI framework
- Pillow (PIL) for image processing
- imagehash library (DCT-based pHash)
- NumPy for vector operations

**Deployment**:
```bash
cd ml-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8001
```

---

## 6. Complete Task Summary

### 6.1 Core NFT Marketplace Features

1. **NFT Minting**
   - Users upload images and mint NFTs on-chain
   - Each NFT deployed as individual canister
   - Images stored directly on-chain (no IPFS)
   - Cycle management and balance checking

2. **NFT Trading**
   - List NFTs for sale with DANG token pricing
   - Buy NFTs using token transfers
   - Ownership transfer on-chain
   - Transaction history tracking

3. **Token Economy**
   - DANG token (fungible) with 1 billion supply
   - Token transfers with descriptions
   - Transaction history per user
   - Faucet for new users (10,000 tokens)

### 6.2 Originality Verification System

4. **Three-Layer Detection**
   - SHA-256 exact duplicate detection
   - pHash (DCT-based) with Hamming Distance comparison
   - ML embedding vector similarity search

5. **ML Service Integration**
   - Python FastAPI microservice
   - pHash generation (16x16, 256-bit)
   - Embedding generation (512-dim grayscale downsample)
   - Offline, lightweight implementation

6. **Database Schema**
   - NFT metadata storage (Supabase PostgreSQL)
   - Originality checks audit log
   - User analytics tracking
   - pgvector extension for vector search

### 6.3 Quiz Integration

7. **Quiz Application**
   - Independent Next.js application
   - Principal ID-based authentication (no Supabase auth)
   - Points system synchronized with NFT project

8. **Points-to-Tokens Conversion**
   - Quiz points stored in Supabase
   - API endpoints for points management
   - Token canister `rewardQuiz()` function
   - Points reset after token claim

9. **UI Integration**
   - Quiz button in NFT marketplace header
   - QuizRewards component for claiming tokens
   - Styling matching platform theme

### 6.4 Technical Infrastructure

10. **Canister Deployment**
    - Internet Identity for authentication
    - OpenD marketplace canister
    - Token canister
    - NFT factory pattern
    - Frontend asset canister

11. **State Persistence**
    - Preupgrade/postupgrade hooks
    - Stable variable serialization
    - Database backup for metadata

12. **CORS Configuration**
    - Cross-origin API access
    - OPTIONS preflight handling
    - Development and production support

---

## 7. Technical Highlights

### 7.1 Decentralization

- **No Centralized Storage**: Images stored on-chain in NFT canisters
- **No Single Point of Failure**: Each NFT is independent canister
- **Trustless Trading**: Ownership verified on-chain

### 7.2 Scalability Considerations

- **Vector Indexing**: IVFFlat index for fast similarity search
- **Efficient pHash Comparison**: Only compare with valid pHashes
- **Non-Blocking Metadata**: Originality checks don't block minting if API fails

### 7.3 Security

- **Principal-Based Authentication**: ICP's native identity system
- **Ownership Verification**: Only owner can transfer/sell NFTs
- **Cycle Management**: Prevents canister exhaustion attacks

---

## 8. Future Enhancements (Not Implemented)

1. **ICRC-7 Standard Compliance**: Migrate to official NFT standard
2. **Deep Learning Embeddings**: Replace simple embedding with ResNet/ViT
3. **IPFS Integration**: Optional off-chain storage for large images
4. **Auction System**: Time-based auctions for NFT sales
5. **Royalty System**: Creator royalties on secondary sales

---

## 9. Conclusion

This project demonstrates a complete NFT marketplace implementation on ICP with:
- **On-chain storage** and **decentralized ownership**
- **Multi-layer originality verification** using cryptographic hashes, perceptual hashing, and ML embeddings
- **Microservices architecture** combining blockchain and traditional web services
- **Integrated gamification** through quiz rewards

The system successfully prevents duplicate and derivative NFT minting while maintaining a user-friendly experience and decentralized architecture.

---

## Appendix: Key Technical Terms

- **Principal ID**: ICP's unique identifier for users and canisters (e.g., `tkc75-5ckrv-bxf3y-...`)
- **Cycles**: ICP's computation cost unit (similar to gas in Ethereum)
- **Candid**: Interface Definition Language (IDL) for ICP canisters
- **Motoko**: Programming language for ICP smart contracts
- **DCT (Discrete Cosine Transform)**: Mathematical transform used in JPEG compression and pHash
- **Hamming Distance**: Number of differing characters between two strings
- **Cosine Similarity**: Measure of similarity between two vectors (0 = different, 1 = identical)
- **pgvector**: PostgreSQL extension for vector similarity search
- **IVFFlat**: Approximate nearest neighbor index for fast vector search
