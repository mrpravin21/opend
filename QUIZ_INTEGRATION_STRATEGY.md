# Quiz Integration Strategy

## Current Architecture Analysis

### NFT Project (`opend 2`)
- **Framework**: React + Webpack
- **Authentication**: Internet Identity (IC)
- **Frontend**: Deployed as IC asset canister
- **Backend**: Motoko canisters (opend, token)
- **Port**: 8080 (dev), IC canister (prod)

### Quiz Project (`/Downloads/quiz`)
- **Framework**: Next.js 16
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini for quiz generation
- **Features**: XP/Leveling, Leaderboard, Daily Cooldown
- **Port**: 3000 (default Next.js)

## Recommended Integration Approach: **API-Based (Microservices)**

### Why API-Based Integration?
✅ **Maintains independence** - Both projects can be developed/deployed separately  
✅ **No breaking changes** - Existing quiz functionality remains intact  
✅ **Scalability** - Can scale each service independently  
✅ **Technology flexibility** - Can use best tools for each service  
✅ **Easier maintenance** - Changes to one project don't affect the other  
✅ **Gradual migration** - Can migrate authentication later if needed

---

## Integration Architecture

```
┌─────────────────────────────────┐
│   NFT Marketplace Frontend      │
│   (React + IC Auth)             │
│   Port: 8080                    │
└─────────────┬───────────────────┘
              │
              │ HTTP API Calls
              │ (Principal ID mapping)
              ▼
┌─────────────────────────────────┐
│   Quiz Service                  │
│   (Next.js API Routes)          │
│   Port: 3000                    │
│   ┌─────────────────────────┐   │
│   │ /api/quiz/start         │   │
│   │ /api/quiz/submit        │   │
│   │ /api/leaderboard        │   │
│   │ /api/rewards/claim      │   │
│   └─────────────────────────┘   │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│   Supabase Database             │
│   (Quiz data, profiles, etc.)   │
└─────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│   IC Canisters                  │
│   (Token rewards distribution)  │
└─────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: User ID Mapping (Principal ↔ Supabase User)

Since the quiz uses Supabase Auth but NFT project uses Internet Identity, we need to map IC Principals to Supabase users.

**Option A: Create mapping on first quiz attempt**
1. User logs in with Internet Identity (gets Principal)
2. User starts quiz
3. Backend checks if Principal exists in mapping table
4. If not, creates Supabase user with Principal as username/email
5. Stores Principal → Supabase User ID mapping

**Option B: Allow users to link accounts**
1. User can optionally create Supabase account
2. Link IC Principal to Supabase User ID
3. Store mapping in Supabase `profiles` table

**Recommended: Option A (automatic)**

---

### Step 2: Update Quiz API Routes

Modify quiz API routes to accept IC Principal instead of Supabase session:

**New API Route: `/api/quiz/start`**
```typescript
// app/api/quiz/start/route.ts
export async function POST(req: Request) {
  const { principalId } = await req.json(); // IC Principal from NFT frontend
  
  // Map Principal to Supabase User ID
  let userId = await getOrCreateUserFromPrincipal(principalId);
  
  // Rest of existing logic...
  const profile = await getOrCreateProfile(userId);
  // ...
}
```

**New API Route: `/api/quiz/submit`**
```typescript
// app/api/quiz/submit/route.ts
export async function POST(req: Request) {
  const { principalId, answers, score, timeLeft } = await req.json();
  
  let userId = await getOrCreateUserFromPrincipal(principalId);
  // Process quiz submission...
  // Calculate rewards...
  
  return NextResponse.json({
    success: true,
    xpGained: calculatedXP,
    newLevel: newLevel,
    rewardEligible: isTopThree, // Based on leaderboard
    tokenReward: tokenAmount // 50, 30, or 20 tokens
  });
}
```

**New API Route: `/api/leaderboard`**
```typescript
// app/api/leaderboard/route.ts
export async function GET(req: Request) {
  // Return top 100 with Principal IDs mapped back
  const leaderboard = await getLeaderboardWithPrincipals();
  return NextResponse.json(leaderboard);
}
```

**New API Route: `/api/rewards/claim`**
```typescript
// app/api/rewards/claim/route.ts
export async function POST(req: Request) {
  const { principalId, quizId } = await req.json();
  
  // Verify user is eligible (top 3 in leaderboard)
  // Call IC canister to transfer DANG tokens
  // Mark reward as claimed
  
  // This will call your token canister:
  // await tokenActor.transfer(principalId, tokenAmount);
}
```

---

### Step 3: Create Helper Functions in Quiz Project

**`lib/ic-principal-mapper.ts`** (New file)
```typescript
import { supabase } from './supabase';
import { getOrCreateProfile } from './getOrCreateProfile';

/**
 * Maps IC Principal to Supabase User ID
 * Creates Supabase user if doesn't exist
 */
export async function getOrCreateUserFromPrincipal(principalId: string): Promise<string> {
  // Check if mapping exists in Supabase
  const { data: existing } = await supabase
    .from('principal_mappings')
    .select('supabase_user_id')
    .eq('principal_id', principalId)
    .single();

  if (existing) {
    return existing.supabase_user_id;
  }

  // Create new Supabase user
  // Note: Supabase requires email for user creation
  // We'll use a placeholder email format: principal@ic.local
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: `${principalId}@ic.local`,
    password: crypto.randomUUID(), // Random password (user won't login via Supabase)
    email_confirm: true,
    user_metadata: {
      principal_id: principalId,
      auth_provider: 'internet_computer'
    }
  });

  if (authError || !authData.user) {
    throw new Error(`Failed to create Supabase user: ${authError?.message}`);
  }

  // Store mapping
  await supabase
    .from('principal_mappings')
    .insert({
      principal_id: principalId,
      supabase_user_id: authData.user.id
    });

  // Create profile
  await getOrCreateProfile(authData.user.id);

  return authData.user.id;
}

/**
 * Get Principal ID from Supabase User ID
 */
export async function getPrincipalFromSupabaseUserId(supabaseUserId: string): Promise<string | null> {
  const { data } = await supabase
    .from('principal_mappings')
    .select('principal_id')
    .eq('supabase_user_id', supabaseUserId)
    .single();

  return data?.principal_id || null;
}
```

**Update Supabase Schema:**
```sql
-- Create principal_mappings table
CREATE TABLE principal_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  principal_id TEXT UNIQUE NOT NULL,
  supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_principal_id ON principal_mappings(principal_id);
CREATE INDEX idx_supabase_user_id ON principal_mappings(supabase_user_id);
```

---

### Step 4: Add IC Token Transfer to Quiz Project

Install IC SDK in quiz project:
```bash
cd /Users/pravinbhatta/Downloads/quiz
npm install @dfinity/agent @dfinity/auth-client @dfinity/principal
```

**`lib/ic-token-service.ts`** (New file)
```typescript
import { HttpAgent, Actor } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { idlFactory as tokenIdlFactory } from '../../declarations/token';

// Import token canister ID from environment
const TOKEN_CANISTER_ID = process.env.NEXT_PUBLIC_TOKEN_CANISTER_ID!;
const IC_HOST = process.env.NEXT_PUBLIC_IC_HOST || 'http://127.0.0.1:8000';

/**
 * Transfer DANG tokens to user (called from API route)
 * Note: This requires service identity, not user identity
 */
export async function transferTokensToUser(
  principalId: string, 
  amount: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // Create anonymous agent (service identity)
    const agent = new HttpAgent({ host: IC_HOST });
    
    if (IC_HOST.includes('localhost') || IC_HOST.includes('127.0.0.1')) {
      await agent.fetchRootKey();
    }

    // Create token actor
    const tokenActor = Actor.createActor(tokenIdlFactory, {
      agent,
      canisterId: Principal.fromText(TOKEN_CANISTER_ID),
    });

    // Transfer tokens
    // Note: This uses transferWithDescription for proper transaction tracking
    const principal = Principal.fromText(principalId);
    const result = await tokenActor.transferWithDescription(
      principal,
      BigInt(amount),
      `Quiz reward - Top leaderboard position`
    );

    if (result === 'Success') {
      return { success: true };
    } else {
      return { success: false, error: result };
    }
  } catch (error: any) {
    console.error('Token transfer error:', error);
    return { success: false, error: error.message };
  }
}
```

---

### Step 5: Create NFT Frontend Components

In your NFT project (`src/opend_assets/src/components/`), create:

**`QuizWidget.jsx`** - Quiz entry point
```javascript
import React, { useState, useContext, useEffect } from "react";
import { AuthContext } from "../index";
import { getAuthedActors } from "../icpAuth";

const QUIZ_API_URL = process.env.QUIZ_API_URL || "http://localhost:3000/api";

function QuizWidget() {
  const { isAuthenticated, principal } = useContext(AuthContext);
  const [canStartQuiz, setCanStartQuiz] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && principal) {
      checkQuizEligibility();
      fetchLeaderboard();
    }
  }, [isAuthenticated, principal]);

  async function checkQuizEligibility() {
    try {
      const response = await fetch(`${QUIZ_API_URL}/quiz/eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principalId: principal.toText() })
      });
      const data = await response.json();
      setCanStartQuiz(data.canStart);
    } catch (error) {
      console.error('Error checking eligibility:', error);
    }
  }

  async function fetchLeaderboard() {
    try {
      const response = await fetch(`${QUIZ_API_URL}/leaderboard`);
      const data = await response.json();
      setLeaderboard(data.slice(0, 10)); // Top 10
      
      // Find user's rank
      const userIndex = data.findIndex(
        entry => entry.principalId === principal.toText()
      );
      if (userIndex !== -1) {
        setUserRank(userIndex + 1);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  }

  function startQuiz() {
    // Open quiz in new window or iframe
    const quizUrl = `${QUIZ_API_URL.replace('/api', '')}/quiz?principal=${principal.toText()}`;
    window.open(quizUrl, '_blank', 'width=1200,height=800');
  }

  async function claimReward() {
    setLoading(true);
    try {
      const response = await fetch(`${QUIZ_API_URL}/rewards/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principalId: principal.toText() })
      });
      const data = await response.json();
      
      if (data.success) {
        alert(`Successfully claimed ${data.tokenAmount} DANG tokens!`);
        fetchLeaderboard(); // Refresh
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error claiming reward:', error);
      alert('Failed to claim reward. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="quiz-widget">
        <p>Please login to participate in quizzes and earn DANG tokens!</p>
      </div>
    );
  }

  return (
    <div className="quiz-widget">
      <h3>Daily Quiz Challenge</h3>
      {canStartQuiz ? (
        <button onClick={startQuiz} className="quiz-start-btn">
          Start Quiz
        </button>
      ) : (
        <p>Quiz is on cooldown. Come back tomorrow!</p>
      )}

      <div className="leaderboard-section">
        <h4>Leaderboard</h4>
        {userRank && (
          <p>Your Rank: #{userRank}</p>
        )}
        <ol>
          {leaderboard.map((entry, index) => (
            <li key={index}>
              {index + 1}. {entry.principalId.substring(0, 8)}... - Level {entry.level} - {entry.xp} XP
              {index < 3 && <span className="medal">🏆</span>}
            </li>
          ))}
        </ol>
      </div>

      {userRank && userRank <= 3 && (
        <button onClick={claimReward} disabled={loading}>
          {loading ? 'Claiming...' : `Claim ${[50, 30, 20][userRank - 1]} DANG Tokens`}
        </button>
      )}
    </div>
  );
}

export default QuizWidget;
```

**Add to `App.jsx` or `Header.jsx`:**
```javascript
import QuizWidget from "./QuizWidget";

// Add quiz tab/button to navigation
<QuizWidget />
```

---

### Step 6: Create Quiz Bridge Page (Next.js)

Create a special page in quiz project that accepts Principal and handles IC authentication:

**`app/quiz/ic-bridge/page.tsx`**
```typescript
'use client'

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ICBridgeQuiz() {
  const searchParams = useSearchParams();
  const principalId = searchParams.get('principal');
  const [mapped, setMapped] = useState(false);

  useEffect(() => {
    if (principalId) {
      // Create Supabase session for this Principal
      // Then redirect to quiz page
      handleICAuth(principalId);
    }
  }, [principalId]);

  async function handleICAuth(principal: string) {
    // Call API to map Principal to Supabase user
    const res = await fetch('/api/auth/ic-bridge', {
      method: 'POST',
      body: JSON.stringify({ principalId: principal })
    });
    
    const { sessionToken } = await res.json();
    
    // Set Supabase session (if needed)
    // Redirect to quiz page
    window.location.href = '/quiz';
  }

  return <div>Connecting...</div>;
}
```

---

## Deployment Strategy

### Development
1. **NFT Project**: `npm start` on port 8080
2. **Quiz Project**: `npm run dev` on port 3000
3. Set `QUIZ_API_URL=http://localhost:3000/api` in NFT project env

### Production
1. **NFT Project**: Deploy as IC asset canister
2. **Quiz Project**: Deploy to Vercel/Railway/your hosting
3. Set `QUIZ_API_URL=https://your-quiz-domain.com/api` in NFT project
4. Set `NEXT_PUBLIC_IC_HOST=https://ic0.app` in quiz project

---

## Environment Variables

### Quiz Project (`.env.local`)
```bash
# Existing
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# New - IC Integration
NEXT_PUBLIC_TOKEN_CANISTER_ID=your_token_canister_id
NEXT_PUBLIC_IC_HOST=https://ic0.app  # or http://127.0.0.1:8000 for local
```

### NFT Project (webpack config or `.env`)
```bash
QUIZ_API_URL=http://localhost:3000/api  # dev
# or
QUIZ_API_URL=https://your-quiz-domain.com/api  # prod
```

---

## Database Schema Updates (Supabase)

Run these SQL commands in Supabase SQL Editor:

```sql
-- Create principal mappings table
CREATE TABLE IF NOT EXISTS principal_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  principal_id TEXT UNIQUE NOT NULL,
  supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_principal_id ON principal_mappings(principal_id);
CREATE INDEX IF NOT EXISTS idx_supabase_user_id ON principal_mappings(supabase_user_id);

-- Add principal_id to profiles table (optional, for quick lookups)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS principal_id TEXT REFERENCES principal_mappings(principal_id);
```

---

## Testing Checklist

- [ ] Principal mapping works (creates Supabase user automatically)
- [ ] Quiz can be started with IC Principal
- [ ] Quiz submission calculates XP/levels correctly
- [ ] Leaderboard shows Principal IDs
- [ ] Top 3 users can claim DANG tokens
- [ ] Token transfer to IC canister works
- [ ] Daily cooldown enforced per Principal
- [ ] Error handling for network failures

---

## Alternative: Monorepo Approach

If you want everything in one project:

1. Move quiz folder into NFT project: `opend 2/quiz/`
2. Create shared package for common utilities
3. Use Next.js API routes as backend for NFT frontend
4. Deploy both together (but this is more complex)

**Not recommended** because:
- Mixing Next.js and Webpack bundlers is complex
- Deployment becomes more complicated
- Less flexibility

---

## Next Steps

1. ✅ Review this strategy
2. Create `principal_mappings` table in Supabase
3. Implement `getOrCreateUserFromPrincipal()` in quiz project
4. Update quiz API routes to accept Principal ID
5. Add IC token transfer service to quiz project
6. Create `QuizWidget.jsx` in NFT project
7. Test integration locally
8. Deploy quiz project
9. Update NFT project with production quiz API URL

Would you like me to help implement any of these steps?


