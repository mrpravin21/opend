# Backend API Structure Recommendation

## API Endpoints Overview

### Base URL
```
Production: https://api.yourproject.com/v1
Development: http://localhost:3000/v1
```

---

## 1. Originality Checking Endpoints

### POST `/nft/check-originality`
Check if an uploaded image is original before minting.

**Request:**
```json
{
  "image": "<base64_encoded_image>",
  "imageHash": "sha256_hash"
}
```

**Response (Approved):**
```json
{
  "status": "approved",
  "originalityScore": 95.5,
  "similarityScore": 12.3,
  "message": "Image passed originality check"
}
```

**Response (Rejected - Duplicate):**
```json
{
  "status": "rejected",
  "reason": "duplicate",
  "originalityScore": 5.0,
  "similarityScore": 98.5,
  "similarNftId": "umunu-kh777-77774-qaaca-cai",
  "message": "Image is a duplicate of existing NFT"
}
```

**Response (Rejected - Derivative):**
```json
{
  "status": "rejected",
  "reason": "derivative",
  "originalityScore": 45.2,
  "similarityScore": 78.9,
  "similarNftId": "umunu-kh777-77774-qaaca-cai",
  "message": "Image is too similar to existing NFT"
}
```

**Implementation Notes:**
- Compute pHash
- Generate image embedding using ML model
- Query database for similar images
- Return result immediately (don't store until approved)

---

### POST `/nft/sync-after-mint`
Sync NFT metadata to database after successful on-chain minting.

**Request:**
```json
{
  "nftPrincipalId": "umunu-kh777-77774-qaaca-cai",
  "principalId": "rdmx6-jaaaa-aaaaa-aaadq-cai",
  "name": "My NFT Name",
  "imageHash": "sha256_hash",
  "onChainTxHash": "transaction_reference"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "NFT metadata synced to database"
}
```

---

## 2. Quiz Management Endpoints (Admin)

### POST `/quiz/create`
Create a new quiz.

**Request:**
```json
{
  "title": "General Knowledge Quiz #1",
  "description": "Test your knowledge",
  "startTime": "2024-01-15T10:00:00Z",
  "endTime": "2024-01-15T12:00:00Z",
  "durationMinutes": 30,
  "rewardFirst": 50,
  "rewardSecond": 30,
  "rewardThird": 20,
  "questions": [
    {
      "questionText": "What is the capital of France?",
      "optionA": "London",
      "optionB": "Berlin",
      "optionC": "Paris",
      "optionD": "Madrid",
      "correctAnswer": "C",
      "points": 10,
      "questionOrder": 1
    }
    // ... more questions
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "quizId": 1,
  "message": "Quiz created successfully"
}
```

---

### GET `/quiz/:quizId`
Get quiz details (without answers).

**Response:**
```json
{
  "quizId": 1,
  "title": "General Knowledge Quiz #1",
  "description": "Test your knowledge",
  "startTime": "2024-01-15T10:00:00Z",
  "endTime": "2024-01-15T12:00:00Z",
  "durationMinutes": 30,
  "status": "active",
  "questions": [
    {
      "questionId": 1,
      "questionText": "What is the capital of France?",
      "optionA": "London",
      "optionB": "Berlin",
      "optionC": "Paris",
      "optionD": "Madrid",
      "points": 10,
      "questionOrder": 1
    }
  ]
}
```

---

### GET `/quiz/active`
Get all active quizzes.

**Response:**
```json
{
  "quizzes": [
    {
      "quizId": 1,
      "title": "General Knowledge Quiz #1",
      "startTime": "2024-01-15T10:00:00Z",
      "endTime": "2024-01-15T12:00:00Z",
      "durationMinutes": 30,
      "status": "active"
    }
  ]
}
```

---

## 3. Quiz Taking Endpoints

### POST `/quiz/:quizId/submit`
Submit quiz answers.

**Request:**
```json
{
  "principalId": "rdmx6-jaaaa-aaaaa-aaadq-cai",
  "answers": [
    {
      "questionId": 1,
      "selectedAnswer": "C"
    },
    {
      "questionId": 2,
      "selectedAnswer": "A"
    }
  ],
  "timeTakenSeconds": 1250
}
```

**Response:**
```json
{
  "status": "success",
  "submissionId": 123,
  "totalScore": 85,
  "totalPointsPossible": 100,
  "correctAnswers": 8,
  "totalQuestions": 10,
  "message": "Quiz submitted successfully"
}
```

---

### GET `/quiz/:quizId/submission`
Get user's submission for a quiz (with correct answers revealed).

**Query Parameters:**
- `principalId`: User's principal ID

**Response:**
```json
{
  "submissionId": 123,
  "quizId": 1,
  "totalScore": 85,
  "totalPointsPossible": 100,
  "submittedAt": "2024-01-15T11:30:00Z",
  "timeTakenSeconds": 1250,
  "answers": [
    {
      "questionId": 1,
      "questionText": "What is the capital of France?",
      "selectedAnswer": "C",
      "correctAnswer": "C",
      "isCorrect": true,
      "pointsEarned": 10
    },
    {
      "questionId": 2,
      "questionText": "What is 2+2?",
      "selectedAnswer": "A",
      "correctAnswer": "B",
      "isCorrect": false,
      "pointsEarned": 0
    }
  ]
}
```

---

## 4. Leaderboard Endpoints

### GET `/quiz/:quizId/leaderboard`
Get leaderboard for a quiz.

**Query Parameters:**
- `limit` (optional): Number of top entries to return (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "quizId": 1,
  "totalParticipants": 150,
  "leaderboard": [
    {
      "rank": 1,
      "principalId": "rdmx6-jaaaa-aaaaa-aaadq-cai",
      "totalScore": 100,
      "submittedAt": "2024-01-15T10:15:00Z",
      "willReceiveReward": 50
    },
    {
      "rank": 2,
      "principalId": "umunu-kh777-77774-qaaca-cai",
      "totalScore": 95,
      "submittedAt": "2024-01-15T10:20:00Z",
      "willReceiveReward": 30
    },
    {
      "rank": 3,
      "principalId": "abc12-xyz34-56789-abcdef-cai",
      "totalScore": 90,
      "submittedAt": "2024-01-15T10:25:00Z",
      "willReceiveReward": 20
    }
  ]
}
```

---

### GET `/quiz/:quizId/leaderboard/live`
Get live leaderboard (WebSocket or SSE for real-time updates).

**Response:** Same as above, but updates in real-time as submissions come in.

---

## 5. Reward Claiming Endpoints

### GET `/reward/claimable`
Get claimable rewards for a user.

**Query Parameters:**
- `principalId`: User's principal ID

**Response:**
```json
{
  "claimableRewards": [
    {
      "claimId": 1,
      "quizId": 1,
      "quizTitle": "General Knowledge Quiz #1",
      "rank": 1,
      "tokenAmount": 50,
      "status": "pending"
    }
  ],
  "totalClaimable": 50
}
```

---

### POST `/reward/:claimId/claim`
Claim a quiz reward (triggers on-chain token transfer).

**Request:**
```json
{
  "principalId": "rdmx6-jaaaa-aaaaa-aaadq-cai"
}
```

**Response (Success):**
```json
{
  "status": "success",
  "claimId": 1,
  "tokenAmount": 50,
  "onChainTxHash": "transaction_reference",
  "message": "Reward claimed successfully"
}
```

**Response (Error):**
```json
{
  "status": "error",
  "message": "Reward already claimed or invalid"
}
```

**Implementation Notes:**
- Verify user is eligible
- Call IC canister to transfer tokens
- Update reward_claims table with transaction hash
- Handle failures gracefully

---

## 6. User Stats Endpoints

### GET `/user/:principalId/stats`
Get user statistics.

**Response:**
```json
{
  "principalId": "rdmx6-jaaaa-aaaaa-aaadq-cai",
  "totalNftsMinted": 15,
  "totalQuizScore": 450,
  "quizzesParticipated": 5,
  "totalRewardsEarned": 120,
  "totalRewardsClaimed": 100,
  "rank": 25
}
```

---

## 7. Health Check Endpoints

### GET `/health`
Check API health.

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "icCanister": "reachable",
  "timestamp": "2024-01-15T12:00:00Z"
}
```

---

## Authentication & Authorization

### Authentication Method
Since you're using Internet Identity (II), you can:

1. **Option A: Principal-based authentication**
   - User signs a message with their II identity
   - Backend verifies the signature
   - Use principal ID for authorization

2. **Option B: JWT tokens**
   - After II login, frontend gets principal
   - Backend issues JWT token with principal embedded
   - Frontend includes JWT in API requests

**Recommendation:** Use Option A for simplicity and to maintain decentralization.

### Request Headers
```
Authorization: Principal <principal_id>
Signature: <signed_message>
```

Or with JWT:
```
Authorization: Bearer <jwt_token>
```

---

## Error Handling

### Standard Error Response Format
```json
{
  "status": "error",
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {}
}
```

### Common Error Codes
- `AUTHENTICATION_REQUIRED`: User must be authenticated
- `INVALID_PRINCIPAL`: Principal ID is invalid
- `QUIZ_NOT_FOUND`: Quiz doesn't exist
- `QUIZ_NOT_ACTIVE`: Quiz is not currently active
- `ALREADY_SUBMITTED`: User already submitted this quiz
- `ORIGINALITY_CHECK_FAILED`: Image failed originality check
- `REWARD_ALREADY_CLAIMED`: Reward has already been claimed
- `INSUFFICIENT_BALANCE`: User doesn't have enough tokens
- `DATABASE_ERROR`: Database operation failed
- `IC_CANISTER_ERROR`: IC canister call failed

---

## Rate Limiting

Recommend implementing rate limiting:
- **Originality checks**: 10 requests per minute per principal
- **Quiz submissions**: 1 per quiz per principal
- **Leaderboard queries**: 60 requests per minute per principal
- **Reward claims**: 10 requests per minute per principal

---

## Implementation Technology Suggestions

### Node.js/Express Example Structure
```
backend/
├── src/
│   ├── routes/
│   │   ├── nft.js
│   │   ├── quiz.js
│   │   ├── leaderboard.js
│   │   └── reward.js
│   ├── controllers/
│   │   ├── originalityController.js
│   │   ├── quizController.js
│   │   └── rewardController.js
│   ├── services/
│   │   ├── database.js
│   │   ├── icCanister.js
│   │   ├── imageProcessing.js
│   │   └── mlService.js
│   ├── models/
│   │   └── (database models)
│   └── middleware/
│       ├── auth.js
│       └── rateLimiter.js
├── package.json
└── server.js
```

### Python/FastAPI Example Structure
```
backend/
├── app/
│   ├── routes/
│   │   ├── nft.py
│   │   ├── quiz.py
│   │   ├── leaderboard.py
│   │   └── reward.py
│   ├── controllers/
│   │   ├── originality_controller.py
│   │   ├── quiz_controller.py
│   │   └── reward_controller.py
│   ├── services/
│   │   ├── database.py
│   │   ├── ic_canister.py
│   │   ├── image_processing.py
│   │   └── ml_service.py
│   ├── models/
│   │   └── (SQLAlchemy models)
│   └── middleware/
│       ├── auth.py
│       └── rate_limiter.py
├── requirements.txt
└── main.py
```

---

## Integration with Frontend

### Example: Originality Check Flow
```javascript
// Frontend code
async function checkOriginalityBeforeMint(imageFile) {
  // Convert image to base64
  const base64Image = await fileToBase64(imageFile);
  const imageHash = await sha256Hash(imageFile);
  
  // Check originality
  const response = await fetch('/v1/nft/check-originality', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Principal ${principal.toText()}`
    },
    body: JSON.stringify({
      image: base64Image,
      imageHash: imageHash
    })
  });
  
  const result = await response.json();
  
  if (result.status === 'approved') {
    // Proceed with on-chain minting
    const nftPrincipal = await opendActor.mint(imageByteData, name);
    
    // Sync to database
    await fetch('/v1/nft/sync-after-mint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Principal ${principal.toText()}`
      },
      body: JSON.stringify({
        nftPrincipalId: nftPrincipal.toText(),
        principalId: principal.toText(),
        name: name,
        imageHash: imageHash
      })
    });
  } else {
    // Show rejection message
    alert(`Minting rejected: ${result.message}`);
  }
}
```

---

## Testing Recommendations

1. **Unit Tests**: Test each controller/service function
2. **Integration Tests**: Test API endpoints with test database
3. **E2E Tests**: Test full flows (quiz submission → leaderboard → reward claim)
4. **Load Tests**: Test leaderboard queries under high load
5. **ML Model Tests**: Test originality checking with known duplicate/derivative images




