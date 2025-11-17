# Critical Integration Bugs Found - Complete Audit

## Bug #1: Upload → Analyse (FIXED)
**Location:** public/app.js line 193
**Issue:** `state.projectId = data.projectId` but backend returns `data.project.id`
**Status:** ✅ FIXED

## Bug #2: Analyse Response Missing Questions (FIXED)
**Location:** src/routes/analyse.js
**Issue:** Backend didn't include `questions` in response, frontend expected it
**Status:** ✅ FIXED

## Bug #3: Code Generation - SSE vs JSON Mismatch
**Location:** public/app.js `startCodeGeneration()`
**Issue:** 
- Frontend uses regular `fetch()` expecting JSON response
- Backend uses SSE (Server-Sent Events) streaming
- Frontend will fail to parse SSE as JSON
**Fix Required:** Rewrite frontend to use EventSource or fetch with SSE parsing

## Bug #4: GitHub Push - Field Name Mismatch
**Location:** public/app.js `pushToGitHub()`
**Issue:**
- Frontend sends: `{ token: ... }`
- Backend expects: `{ githubToken: ... }`
**Fix Required:** Change frontend to send `githubToken` instead of `token`

## Bug #5: Download Route - Non-existent Column
**Location:** src/routes/download.js
**Issue:**
- Query: `SELECT filename, file_path, content FROM generated_files`
- Table schema: Does NOT have `file_path` column
**Fix Required:** Remove `file_path` from SELECT query

## Summary
- Total bugs found: 5
- Fixed: 2
- Remaining: 3
- Severity: All are CRITICAL (will cause complete failure of those features)
