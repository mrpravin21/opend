# Database Architecture Recommendation

## Executive Summary

**Recommended Approach: Hybrid Architecture (On-Chain + Off-Chain)**

You should use a **hybrid approach** combining:
- **Internet Computer (IC) Canisters** for critical, trustless data (ownership, transactions, balances)
- **PostgreSQL Database** for heavy computation, large data storage, and analytics

This maintains decentralization for core functionality while handling computationally expensive operations efficiently.

---

## Decentralization Analysis

### ✅ Keep On-Chain (IC Canisters)

These are **critical trustless operations** that must remain decentralized:

1. **NFT Ownership** - Users must trust the blockchain, not a central authority
2. **Token Balances** - Financial state must be verifiable and tamper-proof
3. **Transaction History** - Transparency and auditability
4. **NFT Listings & Sales** - Market operations must be trustless
5. **Quiz Reward Distribution** - Token payouts must be on-chain for trust
6. **User Authentication** - Already using Internet Identity (decentralized)

### ⚠️ Use Off-Chain Database (PostgreSQL)

These require heavy computation or large storage that's impractical on-chain:

1. **Quiz Questions & Answers** - Large text data, doesn't need decentralization
2. **Quiz Submissions & Attempts** - High write frequency, better performance off-chain
3. **Image Embeddings** - ML model outputs (512-2048 dimension vectors), too large for on-chain
4. **pHash Values** - Duplicate detection database (can grow to millions of entries)
5. **Similarity Scores** - Computed values that can be cached
6. **Leaderboard Calculations** - Real-time rankings (compute off-chain, sync rewards on-chain)
7. **Analytics & Reporting** - Historical data analysis

**Decentralization Note**: Using PostgreSQL for these features does NOT compromise your project's decentralization because:
- Core value (NFTs, tokens) remains on-chain
- Quiz rewards are distributed on-chain
- Users can verify their on-chain data independently
- The database is only used for enhanced features (quizzes, originality checks)

---

## Database Schema Design (PostgreSQL)

### 1. Users Table
```sql
CREATE TABLE users (
    principal_id TEXT PRIMARY KEY,  -- Internet Identity Principal (e.g., "umunu-kh777...")
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_quiz_score BIGINT DEFAULT 0,
    total_nfts_minted INT DEFAULT 0,
    INDEX idx_principal (principal_id)
);
```

**Purpose**: Track user metadata and stats (on-chain data is source of truth, this is for analytics)

---

### 2. NFTs Table (Reference/Cache)
```sql
CREATE TABLE nfts (
    nft_principal_id TEXT PRIMARY KEY,  -- NFT canister Principal
    minted_by_principal TEXT NOT NULL,  -- Original minter
    name TEXT NOT NULL,
    minted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    image_hash TEXT,  -- SHA-256 hash of image bytes for quick lookup
    phash TEXT,  -- Perceptual hash for duplicate detection
    embedding VECTOR(512),  -- ML embedding (adjust dimension based on model)
    originality_score DECIMAL(5,2),  -- 0.00 to 100.00
    similarity_to_existing DECIMAL(5,2),  -- Highest similarity found
    is_verified BOOLEAN DEFAULT FALSE,  -- Originality check passed
    mint_status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
    rejection_reason TEXT,
    FOREIGN KEY (minted_by_principal) REFERENCES users(principal_id),
    INDEX idx_image_hash (image_hash),
    INDEX idx_phash (phash),
    INDEX idx_minted_by (minted_by_principal),
    INDEX idx_mint_status (mint_status)
);

-- For pgvector extension (PostgreSQL extension for vector similarity search)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX idx_embedding ON nfts USING ivfflat (embedding vector_cosine_ops);
```

**Purpose**: 
- Store pHash and embeddings for originality checking
- Cache NFT metadata for faster queries
- Track originality scores before minting approval

**Note**: Actual ownership is on-chain. This table is for indexing and originality checks.

---

### 3. Quiz Table
```sql
CREATE TABLE quizzes (
    quiz_id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    duration_minutes INT NOT NULL,  -- Time limit for quiz
    reward_first INT DEFAULT 50,  -- Tokens for 1st place
    reward_second INT DEFAULT 30,  -- Tokens for 2nd place
    reward_third INT DEFAULT 20,  -- Tokens for 3rd place
    status TEXT DEFAULT 'scheduled',  -- 'scheduled', 'active', 'completed', 'cancelled'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_time (start_time, end_time)
);
```

---

### 4. Quiz Questions Table
```sql
CREATE TABLE quiz_questions (
    question_id SERIAL PRIMARY KEY,
    quiz_id INT NOT NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer CHAR(1) NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
    points INT DEFAULT 1,
    question_order INT NOT NULL,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
    INDEX idx_quiz_id (quiz_id)
);
```

---

### 5. Quiz Submissions Table
```sql
CREATE TABLE quiz_submissions (
    submission_id SERIAL PRIMARY KEY,
    quiz_id INT NOT NULL,
    principal_id TEXT NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_taken_seconds INT,
    total_score INT DEFAULT 0,
    total_points_possible INT,
    is_completed BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id),
    FOREIGN KEY (principal_id) REFERENCES users(principal_id),
    UNIQUE(quiz_id, principal_id),  -- One submission per user per quiz
    INDEX idx_quiz_score (quiz_id, total_score DESC),
    INDEX idx_user (principal_id)
);
```

---

### 6. Quiz Answers Table
```sql
CREATE TABLE quiz_answers (
    answer_id SERIAL PRIMARY KEY,
    submission_id INT NOT NULL,
    question_id INT NOT NULL,
    selected_answer CHAR(1) CHECK (selected_answer IN ('A', 'B', 'C', 'D')),
    is_correct BOOLEAN,
    points_earned INT DEFAULT 0,
    FOREIGN KEY (submission_id) REFERENCES quiz_submissions(submission_id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES quiz_questions(question_id),
    INDEX idx_submission (submission_id)
);
```

---

### 7. Leaderboard Table (Materialized View / Cache)
```sql
-- Materialized view for real-time leaderboard
CREATE MATERIALIZED VIEW quiz_leaderboard AS
SELECT 
    qs.quiz_id,
    qs.principal_id,
    u.principal_id,
    qs.total_score,
    qs.submitted_at,
    ROW_NUMBER() OVER (PARTITION BY qs.quiz_id ORDER BY qs.total_score DESC, qs.submitted_at ASC) as rank
FROM quiz_submissions qs
JOIN users u ON qs.principal_id = u.principal_id
WHERE qs.is_completed = TRUE
ORDER BY qs.quiz_id, rank;

CREATE UNIQUE INDEX idx_leaderboard_unique ON quiz_leaderboard (quiz_id, principal_id);
CREATE INDEX idx_leaderboard_rank ON quiz_leaderboard (quiz_id, rank);

-- Refresh function (call after each quiz submission)
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY quiz_leaderboard;
END;
$$ LANGUAGE plpgsql;
```

---

### 8. Reward Claims Table
```sql
CREATE TABLE reward_claims (
    claim_id SERIAL PRIMARY KEY,
    quiz_id INT NOT NULL,
    principal_id TEXT NOT NULL,
    rank INT NOT NULL,  -- 1, 2, or 3
    token_amount INT NOT NULL,
    claimed_at TIMESTAMP,
    on_chain_tx_hash TEXT,  -- Reference to on-chain transaction
    status TEXT DEFAULT 'pending',  -- 'pending', 'processing', 'claimed', 'failed'
    FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id),
    FOREIGN KEY (principal_id) REFERENCES users(principal_id),
    INDEX idx_status (status),
    INDEX idx_user (principal_id)
);
```

**Purpose**: Track quiz rewards. Actual token transfer happens on-chain, this table tracks the process.

---

### 9. Originality Checks Table (Audit Log)
```sql
CREATE TABLE originality_checks (
    check_id SERIAL PRIMARY KEY,
    nft_principal_id TEXT,  -- NULL if check failed before minting
    image_hash TEXT NOT NULL,
    phash TEXT NOT NULL,
    embedding VECTOR(512),
    originality_score DECIMAL(5,2),
    similarity_score DECIMAL(5,2),
    similar_nft_principal_id TEXT,  -- Reference to similar NFT found
    check_result TEXT NOT NULL,  -- 'approved', 'rejected_duplicate', 'rejected_derivative'
    rejection_reason TEXT,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_image_hash (image_hash),
    INDEX idx_phash (phash),
    INDEX idx_result (check_result)
);
```

---

## Architecture Flow

### NFT Minting with Originality Check

```
1. User uploads image → Frontend
2. Frontend sends image to Backend API
3. Backend API:
   a. Compute pHash
   b. Generate image embedding (ML model)
   c. Query database for similar images:
      - Check pHash for exact duplicates
      - Vector similarity search on embeddings for derivatives
   d. Calculate originality score
   e. If score > threshold:
      - Store check result in originality_checks table
      - Return approval to frontend
      - Frontend calls on-chain mint()
   f. If score < threshold:
      - Store rejection reason
      - Return rejection to frontend
4. After successful mint:
   - Store NFT metadata in nfts table
   - Store pHash and embedding for future checks
```

### Quiz Flow

```
1. Admin creates quiz → Store in quizzes, quiz_questions tables
2. Quiz becomes active → Status updated to 'active'
3. Users take quiz → Store submissions in quiz_submissions, quiz_answers
4. Quiz ends → Calculate leaderboard (refresh materialized view)
5. Top 3 users identified → Create entries in reward_claims table
6. Users claim rewards → Backend calls on-chain token transfer
7. On-chain transfer completes → Update reward_claims.status to 'claimed'
```

---

## Technology Stack Recommendations

### Database
- **PostgreSQL 15+** with extensions:
  - `pgvector` - For vector similarity search (image embeddings)
  - `pg_trgm` - For text similarity (optional, for quiz question search)

### Backend API
- **Node.js/Express** or **Python/FastAPI**
- Connect to PostgreSQL using connection pooling
- Connect to IC canisters using `@dfinity/agent` or `ic-py`

### ML/AI Services
- **Python** for image processing:
  - `pHash` library (e.g., `imagehash` in Python)
  - Pre-trained image embedding models:
    - CLIP (OpenAI) - 512 dimensions
    - ResNet-50 - 2048 dimensions
    - EfficientNet - 512 dimensions (recommended for balance)

### Deployment
- Backend API and PostgreSQL can be deployed on:
  - AWS (RDS for PostgreSQL, EC2/ECS for API)
  - Google Cloud (Cloud SQL, Cloud Run)
  - Azure (Azure Database for PostgreSQL, App Service)
  - Or self-hosted

---

## Data Synchronization Strategy

### On-Chain ↔ Off-Chain Sync

1. **NFT Minting**:
   - Originality check happens off-chain FIRST
   - If approved, mint on-chain
   - After successful mint, sync NFT metadata to database

2. **Ownership Changes**:
   - Source of truth: On-chain
   - Optionally cache in database for faster queries (with periodic sync)

3. **Token Balances**:
   - Source of truth: On-chain
   - Cache in database for analytics only

4. **Quiz Rewards**:
   - Calculate off-chain (leaderboard)
   - Distribute on-chain (token transfer)
   - Track claim status in database

---

## Implementation Priority

### Phase 1: Core Database Setup
1. Set up PostgreSQL with pgvector extension
2. Create users, nfts, originality_checks tables
3. Build API endpoint for originality checking
4. Integrate pHash and embedding generation

### Phase 2: Quiz System
1. Create quiz-related tables
2. Build admin interface for quiz creation
3. Build quiz-taking interface
4. Implement leaderboard calculation

### Phase 3: Reward Distribution
1. Create reward_claims table
2. Build reward claiming interface
3. Integrate on-chain token transfer
4. Add transaction tracking

---

## Decentralization Best Practices

1. **Never store critical financial data exclusively off-chain**
   - Token balances, ownership: Always on-chain
   - Database is for optimization and analytics only

2. **Provide data verification**
   - Users can verify their on-chain data independently
   - Database should include on-chain transaction references

3. **Transparent quiz results**
   - Store all quiz submissions with timestamps
   - Allow users to verify their scores
   - Leaderboard calculations should be reproducible

4. **Originality check transparency**
   - Store all originality check results (approved and rejected)
   - Allow users to see why their NFT was rejected
   - Maintain audit trail

---

## Cost Considerations

### On-Chain (IC) Costs
- Cycle consumption for:
  - NFT canister creation: ~2 trillion cycles per NFT
  - Query calls: Minimal
  - Update calls: More expensive
- Estimated: ~$0.01-0.05 per NFT mint (depends on cycle prices)

### Off-Chain Costs
- PostgreSQL hosting: $10-100/month (depends on size)
- Backend API hosting: $10-50/month
- ML model inference: Minimal (can run on same server)

---

## Alternative: Fully On-Chain Approach (Not Recommended)

You *could* store everything on-chain, but:

❌ **Challenges**:
- Image embeddings (512-2048 dimensions) are too large for efficient on-chain storage
- Vector similarity search is computationally expensive on-chain
- Quiz submissions would cost cycles for each answer
- Leaderboard calculations would be slow and expensive

✅ **Hybrid approach benefits**:
- Faster queries
- Lower costs
- Better user experience
- Maintains decentralization for critical operations

---

## Conclusion

**Recommendation: Use PostgreSQL for quiz system and originality checking, keep core NFT/token operations on-chain.**

This hybrid approach:
- ✅ Maintains decentralization for critical features (NFTs, tokens)
- ✅ Provides efficient storage for large/complex data
- ✅ Enables advanced features (ML-based originality checks, real-time leaderboards)
- ✅ Keeps costs reasonable
- ✅ Allows for scalability

The database serves as a **performance and feature layer**, while the IC blockchain remains the **trust and value layer**.




