# Database Entity Relationship Diagram

## Text-Based ER Diagram

```
┌─────────────────┐
│     users       │
├─────────────────┤
│ PK principal_id │──┐
│ created_at      │  │
│ updated_at      │  │
│ total_quiz_score│  │
│ total_nfts_mint │  │
└─────────────────┘  │
                     │
                     │ (1:N)
                     │
┌─────────────────┐  │    ┌──────────────────────┐
│      nfts       │◄─┘    │ originality_checks   │
├─────────────────┤       ├──────────────────────┤
│ PK nft_principal│       │ PK check_id          │
│ FK minted_by    │──┐    │ FK nft_principal_id  │──┐
│ name            │  │    │ image_hash           │  │
│ minted_at       │  │    │ phash                │  │
│ image_hash      │  │    │ embedding (vector)   │  │
│ phash           │  │    │ originality_score    │  │
│ embedding       │  │    │ similarity_score     │  │
│ originality_    │  │    │ check_result         │  │
│   score         │  │    │ checked_at           │  │
│ mint_status     │  │    └──────────────────────┘  │
└─────────────────┘  │                              │
                     │ (1:1)                        │
                     │                              │
┌─────────────────┐  │                              │
│    quizzes      │  │                              │
├─────────────────┤  │                              │
│ PK quiz_id      │──┼──────────────────────────────┘
│ title           │  │
│ description     │  │
│ start_time      │  │
│ end_time        │  │
│ duration_min    │  │
│ reward_first    │  │
│ reward_second   │  │
│ reward_third    │  │
│ status          │  │
└─────────────────┘  │
                     │
                     │ (1:N)
                     │
┌─────────────────┐  │
│ quiz_questions  │  │
├─────────────────┤  │
│ PK question_id  │  │
│ FK quiz_id      │──┘
│ question_text   │
│ option_a        │
│ option_b        │
│ option_c        │
│ option_d        │
│ correct_answer  │
│ points          │
│ question_order  │
└─────────────────┘

┌─────────────────┐
│quiz_submissions │
├─────────────────┤
│ PK submission_id│
│ FK quiz_id      │──┐
│ FK principal_id │──┼──┐
│ submitted_at    │  │  │
│ time_taken_sec  │  │  │
│ total_score     │  │  │
│ total_points    │  │  │
│ is_completed    │  │  │
└─────────────────┘  │  │
                     │  │
                     │  │ (1:N)
                     │  │
┌─────────────────┐  │  │    ┌─────────────────┐
│  quiz_answers   │  │  │    │  reward_claims  │
├─────────────────┤  │  │    ├─────────────────┤
│ PK answer_id    │  │  │    │ PK claim_id     │
│ FK submission_id│──┘  │    │ FK quiz_id      │──┐
│ FK question_id  │──┐  │    │ FK principal_id │──┼──┐
│ selected_answer │  │  │    │ rank            │  │  │
│ is_correct      │  │  │    │ token_amount    │  │  │
│ points_earned   │  │  │    │ claimed_at      │  │  │
└─────────────────┘  │  │    │ on_chain_tx_hash│  │  │
                     │  │    │ status          │  │  │
                     │  │    └─────────────────┘  │  │
                     │  │                         │  │
                     │  └─────────────────────────┘  │
                     │                                │
                     └────────────────────────────────┘

┌──────────────────────┐
│ quiz_leaderboard     │ (Materialized View)
├──────────────────────┤
│ quiz_id              │
│ principal_id         │
│ total_score          │
│ submitted_at         │
│ rank                 │
└──────────────────────┘
```

## Relationship Summary

1. **users** (1) ──< (N) **nfts** : One user can mint many NFTs
2. **users** (1) ──< (N) **quiz_submissions** : One user can submit to many quizzes
3. **users** (1) ──< (N) **reward_claims** : One user can claim many rewards
4. **quizzes** (1) ──< (N) **quiz_questions** : One quiz has many questions
5. **quizzes** (1) ──< (N) **quiz_submissions** : One quiz receives many submissions
6. **quizzes** (1) ──< (N) **reward_claims** : One quiz can have multiple reward claims
7. **quiz_submissions** (1) ──< (N) **quiz_answers** : One submission has many answers
8. **quiz_answers** (N) ──> (1) **quiz_questions** : Many answers reference one question
9. **nfts** (1) ──< (N) **originality_checks** : One NFT can have multiple checks (if re-checked)

## Key Indexes

### Performance-Critical Indexes:
- `nfts.phash` - For duplicate detection (exact matches)
- `nfts.embedding` - Vector index for similarity search
- `nfts.image_hash` - For quick lookup
- `quiz_submissions(quiz_id, total_score DESC)` - For leaderboard queries
- `quiz_leaderboard(quiz_id, rank)` - For top-N queries
- `users.principal_id` - All foreign key lookups




