# Complete Integration Audit Checklist

## 1. UPLOAD FLOW
### Frontend (public/app.js)
- Sends: FormData with files
- Expects response: { success, project: { id }, documents, message }
- Uses: data.project.id → state.projectId

### Backend (src/routes/upload.js)
- Returns: { success, project: { id, name, created_at }, documents, message }
- ✅ MATCH

---

## 2. ANALYSE FLOW
### Frontend (public/app.js)
- Sends: { projectId: state.projectId }
- Expects: { success, analysis, questions, message }
- Uses: data.analysis, data.questions

### Backend (src/routes/analyse.js)
- Expects: { projectId }
- Returns: { success, projectId, analysis, questions, message }
- ✅ MATCH (after fix)

---

## 3. GENERATE FLOW
### Frontend (public/app.js)
- Sends: { projectId, answers, preferences }
- Expects: SSE stream with { type, ... }
- Types: status, file, progress, complete, error

### Backend (src/routes/generate.js)
- Expects: { projectId, answers, preferences }
- Returns: SSE stream
- ✅ CHECK NEEDED

---

## 4. DEPLOY MARKETING FLOW
### Frontend (public/app.js)
- Sends: { projectId }
- Expects: { success, urls: { marketing, app }, timestamp }

### Backend (src/routes/deployMarketing.js)
- Expects: { projectId }
- Returns: { success, urls: { marketing, app, status }, timestamp }
- ✅ CHECK NEEDED

---

## 5. DOWNLOAD FLOW
### Frontend (public/app.js)
- Navigates to: /api/download/${projectId}

### Backend (src/routes/download.js)
- Expects: GET /api/download/:id
- ✅ CHECK NEEDED

---

## 6. GITHUB PUSH FLOW
### Frontend (public/app.js)
- Sends: { projectId, githubRepo, githubToken }

### Backend (src/routes/github.js)
- ✅ CHECK NEEDED

---

## 7. ENVIRONMENT VARIABLES
- GEMINI_API_KEY: Used in analyse.js, generate.js
- BASE_URL: Used in deployMarketing.js
- DB_*: Used in database.js
- REDIS_*: Used in redis.js
- ✅ CHECK ALL USAGES

---

## 8. FILE PATHS
- Generated files: public/downloads/app-{id}/
- Marketing files: public/downloads/marketing-{id}/
- Preview route: /preview → public/downloads
- ✅ CHECK ALL PATHS

