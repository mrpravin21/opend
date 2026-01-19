# Database Setup Guide

## Quick Start: PostgreSQL Setup

### 1. Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql-15 postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

### 2. Install pgvector Extension

The `pgvector` extension is required for vector similarity search (image embeddings).

**macOS:**
```bash
brew install pgvector
```

**Linux:**
```bash
# Install pgvector from source
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

**Or use Docker:**
```bash
docker pull pgvector/pgvector:pg15
```

### 3. Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Create database and user
CREATE DATABASE opend_db;
CREATE USER opend_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE opend_db TO opend_user;

# Connect to the new database
\c opend_db

# Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4. Run Schema Setup

Create a file `schema.sql` with all the CREATE TABLE statements from `DATABASE_ARCHITECTURE.md`, then run:

```bash
psql -U opend_user -d opend_db -f schema.sql
```

Or run interactively:
```bash
psql -U opend_user -d opend_db
```
Then paste the SQL from the architecture document.

### 5. Verify Installation

```sql
-- Check extensions
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check tables
\dt

-- Check if vector type is available
SELECT typname FROM pg_type WHERE typname = 'vector';
```

---

## Using Docker (Recommended for Development)

### Docker Compose Setup

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg15
    container_name: opend_postgres
    environment:
      POSTGRES_DB: opend_db
      POSTGRES_USER: opend_user
      POSTGRES_PASSWORD: your_secure_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./schema.sql:/docker-entrypoint-initdb.d/schema.sql
    restart: unless-stopped

volumes:
  postgres_data:
```

Start the database:
```bash
docker-compose up -d
```

---

## Connection String

### Format
```
postgresql://username:password@host:port/database
```

### Examples

**Local Development:**
```
postgresql://opend_user:your_secure_password@localhost:5432/opend_db
```

**Environment Variable:**
```bash
export DATABASE_URL="postgresql://opend_user:your_secure_password@localhost:5432/opend_db"
```

---

## Node.js Connection Example

### Using `pg` library:

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected at:', res.rows[0].now);
  }
});

module.exports = pool;
```

### Using Prisma ORM:

```bash
npm install @prisma/client prisma
npx prisma init
```

Edit `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  principalId    String   @id @map("principal_id")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  totalQuizScore BigInt   @default(0) @map("total_quiz_score")
  totalNftsMinted Int     @default(0) @map("total_nfts_minted")

  nfts            NFT[]
  quizSubmissions QuizSubmission[]
  rewardClaims    RewardClaim[]

  @@map("users")
}

// ... other models
```

---

## Python Connection Example

### Using `psycopg2`:

```bash
pip install psycopg2-binary python-dotenv
```

```python
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(
    host="localhost",
    database="opend_db",
    user="opend_user",
    password=os.getenv("DATABASE_PASSWORD")
)

cursor = conn.cursor()
cursor.execute("SELECT NOW()")
print(cursor.fetchone())
conn.close()
```

### Using SQLAlchemy ORM:

```bash
pip install sqlalchemy psycopg2-binary
```

```python
from sqlalchemy import create_engine, Column, String, Integer, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://opend_user:password@localhost:5432/opend_db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    principal_id = Column(String, primary_key=True)
    created_at = Column(DateTime)
    # ... other columns

# Create tables
Base.metadata.create_all(bind=engine)
```

---

## Image Embedding Setup (ML Models)

### Option 1: Using CLIP (OpenAI)

```bash
pip install torch torchvision clip-by-openai pillow
```

```python
import clip
import torch
from PIL import Image

device = "cuda" if torch.cuda.is_available() else "cpu"
model, preprocess = clip.load("ViT-B/32", device=device)

def get_image_embedding(image_path):
    image = preprocess(Image.open(image_path)).unsqueeze(0).to(device)
    with torch.no_grad():
        embedding = model.encode_image(image)
    return embedding.cpu().numpy().flatten().tolist()  # 512 dimensions
```

### Option 2: Using ResNet-50

```bash
pip install torch torchvision pillow
```

```python
import torch
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image

model = models.resnet50(pretrained=True)
model.eval()
# Remove final classification layer to get embeddings
model = torch.nn.Sequential(*list(model.children())[:-1])

transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

def get_image_embedding(image_path):
    image = Image.open(image_path).convert('RGB')
    image_tensor = transform(image).unsqueeze(0)
    with torch.no_grad():
        embedding = model(image_tensor)
    return embedding.squeeze().numpy().tolist()  # 2048 dimensions
```

### pHash Setup

```bash
pip install imagehash pillow
```

```python
import imagehash
from PIL import Image

def get_perceptual_hash(image_path):
    image = Image.open(image_path)
    phash = imagehash.phash(image)
    return str(phash)  # Returns hexadecimal string

def compare_hashes(hash1, hash2, threshold=10):
    # Lower difference means more similar
    difference = hash1 - hash2
    return difference < threshold
```

---

## Database Migration Strategy

### Using Prisma Migrations:

```bash
# Create migration
npx prisma migrate dev --name init

# Apply migrations in production
npx prisma migrate deploy
```

### Using Alembic (Python/SQLAlchemy):

```bash
pip install alembic
alembic init alembic

# Create migration
alembic revision --autogenerate -m "Initial schema"

# Apply migration
alembic upgrade head
```

### Manual Migrations:

Keep migration SQL files in `migrations/` directory:
```
migrations/
├── 001_initial_schema.sql
├── 002_add_quiz_tables.sql
├── 003_add_originality_checks.sql
└── ...
```

Apply with:
```bash
psql -U opend_user -d opend_db -f migrations/001_initial_schema.sql
```

---

## Backup and Restore

### Backup:
```bash
pg_dump -U opend_user opend_db > backup_$(date +%Y%m%d).sql
```

### Restore:
```bash
psql -U opend_user opend_db < backup_20240115.sql
```

### Automated Backups (cron):
```bash
# Add to crontab (crontab -e)
0 2 * * * pg_dump -U opend_user opend_db > /backups/opend_db_$(date +\%Y\%m\%d).sql
```

---

## Performance Optimization

### Indexes Already Defined:
- Vector similarity index on `nfts.embedding`
- Indexes on frequently queried columns

### Additional Optimizations:

1. **Connection Pooling:**
```javascript
const pool = new Pool({
  max: 20,  // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

2. **Query Optimization:**
- Use `EXPLAIN ANALYZE` to check query performance
- Add indexes for frequently filtered columns
- Use prepared statements for repeated queries

3. **Partitioning (for large tables):**
```sql
-- Partition quiz_submissions by date if it grows very large
CREATE TABLE quiz_submissions_2024_01 PARTITION OF quiz_submissions
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

---

## Security Best Practices

1. **Use Environment Variables:**
   - Never hardcode passwords
   - Use `.env` files (add to `.gitignore`)

2. **Limit Database User Privileges:**
   ```sql
   -- Create read-only user for analytics
   CREATE USER opend_readonly WITH PASSWORD 'password';
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO opend_readonly;
   ```

3. **Enable SSL in Production:**
   ```javascript
   const pool = new Pool({
     connectionString: DATABASE_URL,
     ssl: {
       rejectUnauthorized: true,
       ca: fs.readFileSync('path/to/ca-certificate.crt').toString()
     }
   });
   ```

4. **Regular Updates:**
   - Keep PostgreSQL updated
   - Keep pgvector extension updated

---

## Monitoring

### Check Database Size:
```sql
SELECT pg_size_pretty(pg_database_size('opend_db'));
```

### Check Table Sizes:
```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Active Connections:
```sql
SELECT count(*) FROM pg_stat_activity;
```

---

## Troubleshooting

### Issue: pgvector extension not found
**Solution:** Install pgvector extension (see step 2)

### Issue: Cannot connect to database
**Solution:** 
- Check if PostgreSQL is running: `pg_isready`
- Check firewall settings
- Verify connection string

### Issue: Vector similarity search is slow
**Solution:**
- Ensure ivfflat index is created on embedding column
- Tune index parameters:
  ```sql
  CREATE INDEX idx_embedding ON nfts 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);  -- Adjust based on table size
  ```

### Issue: Out of memory during large queries
**Solution:**
- Increase `work_mem` in postgresql.conf
- Use pagination for large result sets
- Optimize queries to limit result sets




