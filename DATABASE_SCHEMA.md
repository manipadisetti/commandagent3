# Command Agent V3 - Complete Database Schema

## Database Connection
- Host: 170.64.228.171
- Port: 3000
- Database: almostmagic
- User: postgres

## Relevant Tables for Command Agent V3

### 1. projects
```sql
Column            | Type                     | Nullable | Default
------------------|--------------------------|----------|---------------------------
id                | integer                  | not null | nextval('projects_id_seq')
name              | character varying(255)   | not null |
description       | text                     |          |
project_type      | character varying(50)    |          | 'application'
status            | character varying(50)    |          | 'active'
created_at        | timestamp with time zone |          | now()
updated_at        | timestamp with time zone |          | now()
user_id           | character varying(255)   |          |
metadata          | jsonb                    |          | '{}'
generation_config | jsonb                    |          | '{}'
analysis_json     | text                     |          |
github_url        | text                     |          |
```

**Primary Key:** id
**Status:** ✅ Good structure, has all needed columns

---

### 2. documents
```sql
Column      | Type                        | Nullable | Default
------------|-----------------------------|---------|--------------------------
id          | integer                     | not null | nextval('documents_id_seq')
project_id  | integer                     |          |
filename    | character varying(255)      | not null |
file_type   | character varying(10)       | not null |
content     | text                        | not null |
uploaded_at | timestamp without time zone |          | now()
```

**Primary Key:** id
**Foreign Keys:** project_id → projects(id) ON DELETE CASCADE

**⚠️ CRITICAL ISSUES:**
- ❌ NO `file_size` column (code expects this)
- ❌ NO `created_at` column (has `uploaded_at` instead)
- ⚠️ `file_type` is VARCHAR(10) - might be too small for some types

---

### 3. generated_files
```sql
Column      | Type                        | Nullable | Default
------------|-----------------------------|---------|--------------------------
id          | integer                     | not null | nextval('generated_files_id_seq')
project_id  | integer                     |          |
filename    | character varying           | not null |
file_path   | text                        | not null |
file_type   | character varying           |          |
content     | text                        |          |
created_at  | timestamp without time zone |          | now()
```

**Primary Key:** id
**Foreign Keys:** project_id → projects(id) (assumed)
**Status:** ✅ Good structure

---

### 4. chat_hub_messages
```sql
Column              | Type                     | Nullable | Default
--------------------|--------------------------|----------|---------------------------
id                  | uuid                     | not null |
sessionId           | uuid                     | not null |
previousMessageId   | uuid                     |          |
revisionOfMessageId | uuid                     |          |
retryOfMessageId    | uuid                     |          |
type                | character varying        | not null |
name                | character varying        | not null |
content             | text                     | not null |
provider            | character varying        |          |
model               | character varying        |          |
workflowId          | character varying        |          |
executionId         | integer                  |          |
createdAt           | timestamp with time zone | not null | CURRENT_TIMESTAMP(3)
updatedAt           | timestamp with time zone | not null | CURRENT_TIMESTAMP(3)
status              | character varying        | not null | 'success'
```

**Primary Key:** id
**Note:** This is an existing n8n/workflow table, NOT specifically for Command Agent
**Decision:** We should create our own `chat_messages` table for Command Agent

---

## Required Changes

### Option A: Add Missing Columns (Database Migration)
```sql
-- Add file_size to documents table
ALTER TABLE documents ADD COLUMN file_size INTEGER;

-- Add created_at for consistency (optional, can use uploaded_at)
-- ALTER TABLE documents ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
```

### Option B: Fix Code to Match Schema (Recommended)
- Remove `file_size` references from upload.js
- Use `uploaded_at` instead of `created_at` in documents queries
- Create separate `chat_messages` table for Command Agent

---

## Recommended Approach: Option B + New Table

### 1. Fix upload.js
Remove `file_size` column reference:
```javascript
// OLD (broken):
INSERT INTO documents (project_id, filename, content, file_type, file_size, created_at)
VALUES ($1, $2, $3, $4, $5, NOW())

// NEW (working):
INSERT INTO documents (project_id, filename, content, file_type, uploaded_at)
VALUES ($1, $2, $3, $4, NOW())
```

### 2. Create chat_messages table for Command Agent
```sql
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,  -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_project ON chat_messages(project_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);
```

---

## Implementation Plan

### Phase 1: Immediate Fixes (No DB Changes)
1. ✅ Schema documented
2. ⏳ Fix upload.js - remove file_size
3. ⏳ Update all queries to use uploaded_at
4. ⏳ Test file upload works

### Phase 2: Add Missing Table
1. ⏳ Create chat_messages table
2. ⏳ Update chat.js to use new table
3. ⏳ Test chat functionality

### Phase 3: Optional Enhancements
1. Add file_size column if needed later
2. Add indexes for performance
3. Add constraints for data integrity

---

## Database Health Check

✅ **Working:**
- projects table has all needed columns
- generated_files table is good
- Foreign keys are properly set up
- Timestamps are present

⚠️ **Needs Attention:**
- documents table missing file_size (minor - can skip)
- No dedicated chat_messages table (need to create)
- file_type column might be too small (VARCHAR(10))

🎯 **Priority:**
1. Fix upload.js (CRITICAL - blocks everything)
2. Create chat_messages table (HIGH - needed for chat feature)
3. Test all endpoints (HIGH - verify everything works)
