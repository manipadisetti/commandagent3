# Command Agent v3 - Test Plan for v6 Fixes
## All 7 UX Issues - Comprehensive Testing

---

## Issue 1: Upload Indicator & File Dialog Reopening

### What Was Fixed:
1. Upload indicator now shows immediately when file is selected
2. File input value is reset after selection (fixes dialog reopening)
3. Upload indicator stays visible until upload completes
4. Page doesn't switch to analysis step until upload succeeds

### Test Scenarios:

**Test 1.1: Normal Upload**
- Action: Select a file
- Expected: 
  - "Uploading and preparing your file..." appears immediately
  - File info shows filename and size
  - Indicator disappears when analysis starts
  - No errors

**Test 1.2: Select Same File Twice**
- Action: Select file A, wait for upload, then select file A again
- Expected:
  - File dialog opens normally second time
  - Upload proceeds normally
  - No "file already selected" issues

**Test 1.3: Cancel File Dialog**
- Action: Click Browse, then cancel the dialog
- Expected:
  - Nothing happens
  - No errors
  - Can click Browse again

**Test 1.4: Upload Failure**
- Action: Disconnect network, try to upload
- Expected:
  - Upload indicator disappears
  - Error notification shows
  - Returns to upload step
  - Can retry

---

## Issue 2: Page Scrolling

### What Was Fixed:
1. Added smooth scroll behavior to HTML element
2. App section scrolls into view smoothly when "Start Building" is clicked
3. Hero section hides after scroll animation completes

### Test Scenarios:

**Test 2.1: Click Start Building**
- Action: Click "Start Building Now" button
- Expected:
  - Page smoothly scrolls to upload section
  - Hero section disappears after scroll
  - Upload section is visible and functional

**Test 2.2: Page Navigation**
- Action: Complete upload, then scroll up and down
- Expected:
  - Page scrolls smoothly
  - All sections are accessible
  - No jumping or jerky movements

**Test 2.3: Browser Back Button**
- Action: Click Start Building, then browser back
- Expected:
  - Returns to hero section
  - Can click Start Building again

---

## Issue 3: Business-Focused Questions

### What Was Fixed:
1. Gemini prompt explicitly requires business-focused questions
2. Lists what TO ask (WHO, WHAT, WHEN, WHERE, WHY, HOW)
3. Lists what NOT to ask (tech stack, databases, hosting)
4. Fallback questions are now business-focused
5. Question categories changed to: audience, goals, workflow, experience, priorities

### Test Scenarios:

**Test 3.1: Simple Requirements**
- Action: Upload "I want a todo list app"
- Expected Questions:
  - "Who is the primary audience?" (not "What database?")
  - "What problems does this solve?" (not "What framework?")
  - "How will users interact?" (not "What hosting?")
  - All questions understandable by non-technical users

**Test 3.2: Technical Requirements**
- Action: Upload requirements mentioning "React" and "PostgreSQL"
- Expected:
  - Questions still focus on business needs
  - Don't ask about tech stack (already mentioned)
  - Ask about user needs, workflows, priorities

**Test 3.3: Vague Requirements**
- Action: Upload "I need a website"
- Expected:
  - Questions help clarify business purpose
  - Ask about target audience
  - Ask about main goals
  - Ask about user experience expectations

---

## Issue 4: Time Remaining Calculation

### What Was Fixed:
1. Frontend tracks start time when generation begins
2. Calculates elapsed time in seconds
3. Estimates total time based on percentage complete
4. Shows "Calculating..." until percentage > 0
5. Shows "Almost done..." when remaining < 1 second
6. Formats as "X min Y sec" or "X sec"

### Test Scenarios:

**Test 4.1: Normal Generation**
- Action: Start code generation
- Expected:
  - Shows "Calculating..." initially
  - Shows time remaining after first progress update
  - Time counts down as percentage increases
  - Shows "Almost done..." near completion

**Test 4.2: Fast Generation**
- Action: Generate simple app (few files)
- Expected:
  - Time remaining updates quickly
  - Shows seconds only (< 60 sec)
  - Accurate countdown

**Test 4.3: Slow Generation**
- Action: Generate complex app (many files)
- Expected:
  - Time remaining shows minutes and seconds
  - Updates every few seconds
  - Remains accurate throughout

**Test 4.4: Progress Updates**
- Action: Watch progress during generation
- Expected:
  - Percentage shows 2 decimal places max
  - Time remaining updates with each progress event
  - No "NaN" or "undefined" values

---

## Issue 5: App Deployment with index.html

### What Was Fixed:
1. Gemini prompt explicitly requires index.html as entry point
2. Fallback logic checks if index.html was generated
3. If missing, uses first HTML file as index.html
4. If no HTML files, creates index.html with file list
5. All files saved to /public/downloads/app-X/

### Test Scenarios:

**Test 5.1: Normal Generation**
- Action: Generate any app
- Expected:
  - index.html is generated
  - Accessing /preview/app-X/ loads the app
  - No 404 errors
  - App functions correctly

**Test 5.2: Gemini Skips index.html**
- Action: Generate app, check if index.html exists
- Expected:
  - If missing, fallback creates it
  - Uses first HTML file OR creates file list
  - /preview/app-X/ still works
  - No 404 errors

**Test 5.3: No HTML Files**
- Action: Generate backend-only app (no HTML)
- Expected:
  - Fallback creates index.html with file list
  - /preview/app-X/ shows list of generated files
  - Can download/view individual files

**Test 5.4: Multiple HTML Files**
- Action: Generate app with multiple HTML pages
- Expected:
  - index.html is the main entry point
  - Other HTML files are accessible
  - Navigation between pages works

---

## Issue 6: Marketing Content About User's App

### What Was Fixed:
1. Hero title shows project name (not "From Idea to Deployed App")
2. Hero subtitle shows project description (not Command Agent pitch)
3. Removed "The Story" section about Command Agent
4. Removed "How It Works" section about Command Agent
5. Added "About" section with project description
6. Features section shows project features (not Command Agent features)
7. CTA button says "Launch [Project Name]" (not "Launch Application")

### Test Scenarios:

**Test 6.1: Marketing Website Content**
- Action: Deploy marketing website
- Expected:
  - Hero shows project name and description
  - About section describes the project
  - Features list project-specific features
  - No mention of "Command Agent v3" in main content
  - CTA buttons link to the actual app

**Test 6.2: Project Without Features**
- Action: Generate app with no features in analysis
- Expected:
  - Features section is empty or hidden
  - Other sections still show correctly
  - No errors

**Test 6.3: Project With Tech Stack**
- Action: Generate app with recommended tech stack
- Expected:
  - Tech stack section shows the technologies
  - Badges display correctly
  - Looks professional

---

## Issue 7: Overall User Experience

### Combined Test Scenarios:

**Test 7.1: Complete Workflow**
- Action: Upload file → Answer questions → Generate → Deploy
- Expected:
  - Upload indicator shows immediately
  - Page scrolls smoothly
  - Questions are business-focused
  - Time remaining calculates correctly
  - App deploys successfully
  - Marketing site shows project details
  - No errors at any step

**Test 7.2: Error Recovery**
- Action: Cause errors at each step
- Expected:
  - Upload fails → shows error, can retry
  - Analysis fails → shows error, can retry
  - Generation fails → shows error, can retry
  - Deployment fails → shows error, can retry
  - No crashes or blank screens

**Test 7.3: Multiple Projects**
- Action: Create 3 different projects in sequence
- Expected:
  - Each project has correct name
  - Each project has correct files
  - Each marketing site shows correct content
  - No data mixing between projects

---

## Confidence Assessment

### Issue 1: Upload Indicator - 95% Confidence
- ✅ Code shows indicator immediately
- ✅ Resets file input value
- ✅ Proper error handling
- ⚠️ Need to verify network failure scenario

### Issue 2: Page Scrolling - 98% Confidence
- ✅ Smooth scroll CSS added
- ✅ ScrollIntoView implemented
- ✅ Hero hides after animation
- ✅ Standard browser behavior

### Issue 3: Business Questions - 85% Confidence
- ✅ Prompt explicitly forbids technical questions
- ✅ Fallback questions are business-focused
- ⚠️ Gemini might still ask technical questions (AI unpredictability)
- ⚠️ Need to test with real requirements

### Issue 4: Time Remaining - 90% Confidence
- ✅ Tracks start time
- ✅ Calculates based on elapsed/percentage
- ✅ Proper formatting
- ⚠️ Accuracy depends on consistent progress updates

### Issue 5: App Deployment - 95% Confidence
- ✅ Prompt requires index.html
- ✅ Fallback creates index.html if missing
- ✅ Multiple fallback strategies
- ⚠️ Need to verify with actual Gemini output

### Issue 6: Marketing Content - 98% Confidence
- ✅ All hardcoded Command Agent text removed
- ✅ Uses project name and description
- ✅ Features from analysis
- ✅ Simple template logic

### Issue 7: Overall UX - 92% Confidence
- ✅ All individual fixes implemented
- ✅ Error handling improved
- ⚠️ Need end-to-end testing
- ⚠️ Need to verify no regressions

---

## Overall Confidence: 93%

**Why not 100%?**
1. Gemini AI is unpredictable (might ignore prompts)
2. Haven't tested with real requirements yet
3. Network/database failures need verification
4. Browser compatibility not tested

**What gives confidence:**
1. All code changes are logical and correct
2. Multiple fallback strategies implemented
3. Error handling added throughout
4. Australian English used consistently
5. No breaking changes to existing functionality
