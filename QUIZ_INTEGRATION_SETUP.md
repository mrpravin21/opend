# Quiz Integration Setup Guide

This guide explains how to set up and use the quiz integration between the NFT project and the quiz project.

## Overview

The integration follows **Approach C** (Points Sync):
- Users play quizzes and earn points
- Points are stored in Supabase linked to their IC Principal ID
- Users claim tokens in the NFT project based on their quiz points
- 1 point = 1 DANG token

## Prerequisites

1. **Quiz Project**: Next.js project with Supabase
2. **NFT Project**: IC-based NFT marketplace with token canister
3. **Supabase**: Database with `quiz_points` table

## Setup Steps

### 1. Database Setup (Supabase)

Run the SQL script to create the `quiz_points` table:

```bash
# In Supabase SQL Editor, run:
# File: quiz/QUIZ_POINTS_SCHEMA.sql
```

This creates:
- `quiz_points` table with `principal_id`, `points`, `last_updated`, `created_at`
- Indexes for fast lookups
- RLS policies for public access

### 2. Quiz Project Configuration

#### A. API Routes (Already Created)
- ✅ `/api/quiz/start` - Initialize quiz session
- ✅ `/api/quiz/submit` - Save quiz points
- ✅ `/api/quiz/points` - Get points for Principal ID
- ✅ `/api/quiz/claim` - Reset points after claim

#### B. Quiz Page for IC Users
- ✅ `/quiz/ic` - Quiz page that accepts `principalId` query parameter

#### C. Environment Variables
Make sure your quiz project has these Supabase env vars:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. NFT Project Configuration

#### A. New Components (Already Created)
- ✅ `QuizRewards.jsx` - Shows points and claim button
- ✅ Header updated with "Quiz" button

#### B. Token Canister Update
- ✅ Added `rewardQuiz(amount)` function to transfer tokens from owner to user

#### C. Environment Variable
Add to your NFT project's webpack config or `.env`:

```javascript
// In webpack.config.js or .env
QUIZ_API_URL=http://localhost:3000  // Your quiz project URL
```

### 4. Running Both Projects

#### Quiz Project:
```bash
cd /Users/pravinbhatta/Downloads/quiz
npm install
npm run dev
# Runs on http://localhost:3000
```

#### NFT Project:
```bash
cd "/Users/pravinbhatta/opend 2"
npm install
dfx start
npm start
# NFT project runs on dfx's local network
```

## Usage Flow

1. **User logs in** to NFT project with Internet Identity
2. **User clicks "Quiz"** in the header
3. **Quiz opens** in new window with Principal ID in URL
4. **User plays quiz** and earns points (1 point per correct answer)
5. **User returns** to NFT project
6. **User sees points** in Quiz Rewards page
7. **User clicks "Claim Tokens"** to convert points to DANG tokens
8. **Tokens transferred** from canister owner to user
9. **Points reset** to 0 after successful claim

## API Endpoints Reference

### GET `/api/quiz/points?principalId={principalId}`
Get current points for a Principal ID.

**Response:**
```json
{
  "principalId": "abc123...",
  "points": 100,
  "lastUpdated": "2024-01-01T00:00:00Z",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### POST `/api/quiz/start`
Initialize quiz session.

**Body:**
```json
{
  "principalId": "abc123..."
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "uuid",
  "principalId": "abc123...",
  "points": 0
}
```

### POST `/api/quiz/submit`
Submit quiz results and save points.

**Body:**
```json
{
  "principalId": "abc123...",
  "score": 4,
  "totalQuestions": 5
}
```

**Response:**
```json
{
  "success": true,
  "pointsEarned": 4,
  "totalPoints": 104,
  "previousPoints": 100
}
```

### POST `/api/quiz/claim`
Reset points after token claim.

**Body:**
```json
{
  "principalId": "abc123...",
  "amount": 100
}
```

**Response:**
```json
{
  "success": true,
  "pointsRemaining": 0,
  "pointsClaimed": 100
}
```

## Token Canister Functions

### `rewardQuiz(amount: Nat)`
Transfers tokens from owner's balance to caller (user).

**Usage:**
```javascript
const { token: authedToken } = await getAuthedActors();
const result = await authedToken.rewardQuiz(BigInt(points));
// Returns "Success" or "Insufficient Funds"
```

## Troubleshooting

### Quiz points not showing
- Check if quiz service is running
- Verify `QUIZ_API_URL` in NFT project matches quiz project URL
- Check browser console for CORS errors
- Verify Principal ID is correctly passed

### Token claim fails
- Check token canister has enough balance in owner account
- Verify user is authenticated
- Check token canister logs for errors

### Quiz page shows "Principal ID required"
- Make sure quiz is accessed via NFT project's "Start Quiz" button
- Verify Principal ID is in URL query parameter

## Future Enhancements

1. **Leaderboard**: Show top quiz players by Principal ID
2. **Point Multipliers**: Bonus points for streaks or perfect scores
3. **Categories**: Different point values per category
4. **Daily Limits**: Maximum points per day
5. **Notifications**: Alert users when points are ready to claim

## Notes

- Points are stored in Supabase, not on-chain (Approach C)
- Token transfers happen on-chain via IC canister
- Quiz can work standalone or integrated
- No Supabase auth required for IC users (Principal ID only)
