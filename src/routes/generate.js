const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { pool } = require('../config/database');
const logger = require('../config/logger');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Initialise Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// POST /api/generate - Generate application code
router.post('/', async (req, res) => {
  const startTime = Date.now();
  const { projectId, answers, preferences } = req.body;

  try {
    logger.info('Generation request received', { projectId });

    // Validate API key
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId is required',
      });
    }

    // Get project with analysis
    const projectResult = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    const project = projectResult.rows[0];

    // Get documents
    const documentsResult = await pool.query(
      'SELECT filename, content FROM documents WHERE project_id = $1',
      [projectId]
    );

    const combinedContent = documentsResult.rows
      .map((doc) => `=== ${doc.filename} ===\n${doc.content}`)
      .join('\n\n');

    // Build context
    const context = {
      requirements: combinedContent,
      analysis: project.analysis_json ? JSON.parse(project.analysis_json) : null,
      answers: answers || {},
      preferences: preferences || {},
    };

    logger.info('Sending to Gemini for code generation', {
      projectId,
      hasAnalysis: !!context.analysis,
      answerCount: Object.keys(context.answers).length,
    });

    // Set response headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial status
    res.write(`data: ${JSON.stringify({ type: 'status', message: 'Starting code generation...' })}\n\n`);

    // Generate code with Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `You are an expert software developer. Generate a complete, production-ready application based on these requirements.

Requirements:
${context.requirements}

${context.analysis ? `Analysis:\n${JSON.stringify(context.analysis, null, 2)}` : ''}

${Object.keys(context.answers).length > 0 ? `User Answers:\n${JSON.stringify(context.answers, null, 2)}` : ''}

${Object.keys(context.preferences).length > 0 ? `Preferences:\n${JSON.stringify(context.preferences, null, 2)}` : ''}

CRITICAL: Generate a SINGLE-FILE APPLICATION or simple multi-file app that works IMMEDIATELY in a browser.

🚫 ABSOLUTELY FORBIDDEN (DO NOT GENERATE):
- React project structure with frontend/ and backend/ folders
- package.json with "react-scripts" or "vite" or "webpack"
- JSX files (.jsx) that need compilation
- TypeScript files (.tsx, .ts)
- Any "npm run build" or build process
- create-react-app structure
- Vite structure
- Next.js structure
- Any framework that requires compilation

✅ REQUIRED: Generate ONE of these approaches:

OPTION 1 (PREFERRED): Single HTML file with everything inline
- index.html with inline CSS and JavaScript
- Uses vanilla JavaScript or CDN libraries
- Works immediately when opened in browser

OPTION 2: Simple multi-file app
- index.html (main file)
- style.css (styling)
- app.js (vanilla JavaScript)
- All files work without build tools

⚠️ CRITICAL REQUIREMENTS:
1. Generate ACTUAL WORKING CODE FILES - not documentation or tutorials
2. DO NOT display code as text on the page - code must be in <script> tags or separate .js files
3. DO NOT create a page that shows CSS/JavaScript code as visible text
4. The application must be FUNCTIONAL and INTERACTIVE
5. All JavaScript must use proper syntax (quoted strings, closed braces, attached event listeners)
6. Use 'use strict'; at the top of JavaScript files
7. Validate DOM elements exist before using them

OPTION 3: CDN-based React (if React is absolutely necessary)
- Single index.html file
- React loaded from CDN (unpkg.com)
- Babel standalone for JSX
- All code in <script type="text/babel"> tags
- NO separate .jsx files

Generate these files:
1. index.html - MUST work immediately in browser
2. style.css (optional, can be inline)
3. app.js (optional, can be inline)
4. README.md with instructions

The index.html MUST:
- Be in the root directory (not in frontend/ or public/)
- Work when accessed via http://localhost/index.html
- NOT require npm install, npm run build, or any build step
- NOT have <div id="root"></div> unless using CDN React
- Have actual content visible immediately

IMPORTANT: Format your response EXACTLY as a series of files using this structure:

=== FILENAME: index.html ===
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My App</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>Hello World</h1>
    <script src="app.js"></script>
</body>
</html>
=== END FILE ===

=== FILENAME: style.css ===
body {
    font-family: Arial, sans-serif;
}
=== END FILE ===

=== FILENAME: app.js ===
'use strict';
console.log('App loaded');
=== END FILE ===

⚠️ CRITICAL FILE GENERATION RULES:
1. If index.html references <script src="app.js">, you MUST generate app.js
2. If index.html references <link href="style.css">, you MUST generate style.css
3. EVERY file referenced MUST be generated
4. Use EXACT marker format: === FILENAME: filename.ext ===
5. End EVERY file with: === END FILE ===
6. Do NOT mix file contents together
7. Do NOT put multiple files in one file block

Make the code production-ready, well-commented, and follow best practices.
Use Australian English spelling (organise, colour, analyse, etc.) in all comments and documentation.

🔍 FINAL CHECKLIST BEFORE GENERATING:
1. ✅ Am I generating WORKING code (not documentation)?
2. ✅ Does index.html have proper <!DOCTYPE html> and structure?
3. ✅ If I reference app.js, did I generate app.js?
4. ✅ If I reference style.css, did I generate style.css?
5. ✅ Did I use EXACT marker format (=== FILENAME: ... ===)?
6. ✅ Did I end each file with === END FILE ===?
7. ✅ Is my JavaScript syntactically correct (no unterminated strings)?
8. ✅ Will this app work immediately when opened in a browser?

If you cannot answer YES to ALL 8 questions, DO NOT GENERATE - fix the issues first.

REMEMBER: The user wants a WORKING APPLICATION, not a code tutorial!`;

    const result = await model.generateContentStream(prompt);

    let fullResponse = '';
    let currentFile = null;
    let currentContent = '';
    const generatedFiles = [];

    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullResponse += text;

      // Parse files as they come in
      const lines = (currentContent + text).split('\n');
      currentContent = lines.pop(); // Keep incomplete line

      for (const line of lines) {
        if (line.startsWith('=== FILENAME:')) {
          // Save previous file if exists
          if (currentFile) {
            generatedFiles.push({
              filename: currentFile,
              content: currentContent.trim(),
            });
            currentContent = '';
          }
          // Extract filename and remove any trailing === markers
          currentFile = line.replace('=== FILENAME:', '').replace(/===.*$/, '').trim();
          res.write(`data: ${JSON.stringify({ type: 'file', filename: currentFile })}\n\n`);
        } else if (line.startsWith('=== END FILE ===')) {
          if (currentFile) {
            generatedFiles.push({
              filename: currentFile,
              content: currentContent.trim(),
            });
            currentContent = '';
            currentFile = null;
          }
        } else if (currentFile) {
          currentContent += line + '\n';
        }
      }

      // Send progress update
      res.write(`data: ${JSON.stringify({ type: 'progress', length: fullResponse.length })}\n\n`);
    }

    // Save last file if exists
    if (currentFile && currentContent) {
      generatedFiles.push({
        filename: currentFile,
        content: currentContent.trim(),
      });
    }

    logger.info('Code generation completed', {
      projectId,
      fileCount: generatedFiles.length,
      totalLength: fullResponse.length,
    });
    
    // Log Gemini's raw output for debugging (first 500 and last 500 chars)
    logger.debug('Gemini raw output (start)', {
      projectId,
      content: fullResponse.substring(0, 500),
    });
    logger.debug('Gemini raw output (end)', {
      projectId,
      content: fullResponse.substring(Math.max(0, fullResponse.length - 500)),
    });
    
    // Log each parsed file for debugging
    generatedFiles.forEach((file, index) => {
      logger.debug('Parsed file', {
        projectId,
        index,
        filename: file.filename,
        contentLength: file.content.length,
        contentStart: file.content.substring(0, 100),
      });
    });

    // CRITICAL: Ensure index.html exists (fallback if Gemini didn't generate it)
    const hasIndexHtml = generatedFiles.some(f => f.filename === 'index.html' || f.filename.endsWith('/index.html'));
    if (!hasIndexHtml) {
      logger.warn('index.html not generated by Gemini, creating fallback', { projectId });
      
      // Find the first HTML file or create a basic one
      const htmlFiles = generatedFiles.filter(f => f.filename.endsWith('.html'));
      
      if (htmlFiles.length > 0) {
        // Use the first HTML file as index.html
        generatedFiles.push({
          filename: 'index.html',
          content: htmlFiles[0].content
        });
        logger.info('Using first HTML file as index.html', { projectId, sourceFile: htmlFiles[0].filename });
      } else {
        // Create a basic index.html that lists all files
        const fileList = generatedFiles.map(f => `<li><a href="${f.filename}">${f.filename}</a></li>`).join('\n');
        generatedFiles.push({
          filename: 'index.html',
          content: `<!DOCTYPE html>
<html lang="en-AU">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Application Files</title>
    <style>
        body { font-family: system-ui; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
        h1 { color: #2563eb; }
        ul { line-height: 2; }
        a { color: #2563eb; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>Generated Application Files</h1>
    <p>The following files were generated for your application:</p>
    <ul>
${fileList}
    </ul>
</body>
</html>`
        });
        logger.info('Created fallback index.html with file list', { projectId });
      }
    }

    // VALIDATE JavaScript files for syntax errors
    const jsFiles = generatedFiles.filter(f => f.filename.endsWith('.js'));
    for (const jsFile of jsFiles) {
      try {
        // Use Node.js VM to check syntax without executing
        const vm = require('vm');
        new vm.Script(jsFile.content);
        logger.info('JavaScript syntax valid', { projectId, filename: jsFile.filename });
      } catch (syntaxError) {
        logger.error('JavaScript syntax error detected', {
          projectId,
          filename: jsFile.filename,
          error: syntaxError.message,
          line: syntaxError.lineNumber,
        });
        
        // Send error to frontend
        const errorMessage = syntaxError.lineNumber 
          ? `Syntax error in ${jsFile.filename} at line ${syntaxError.lineNumber}: ${syntaxError.message}`
          : `Syntax error in ${jsFile.filename}: ${syntaxError.message}`;
        
        const errorData = JSON.stringify({
          type: 'error',
          error: errorMessage,
        });
        
        logger.info('Sending validation error to frontend', { projectId, errorMessage });
        res.write(`data: ${errorData}\n\n`);
        
        // Mark project as failed
        await pool.query(
          'UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2',
          ['failed', projectId]
        );
        
        logger.info('Ending response after validation error', { projectId });
        res.end();
        return;
      }
    }
    
    logger.info('All JavaScript files passed syntax validation', { projectId, jsFileCount: jsFiles.length });
    
    // VALIDATE HTML files for basic structure
    const htmlFiles = generatedFiles.filter(f => f.filename.endsWith('.html'));
    for (const htmlFile of htmlFiles) {
      const content = htmlFile.content.toLowerCase();
      
      // Check for basic HTML structure
      if (!content.includes('<!doctype') && !content.includes('<html')) {
        logger.error('HTML validation failed: missing DOCTYPE or <html>', {
          projectId,
          filename: htmlFile.filename,
        });
        
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: `Invalid HTML in ${htmlFile.filename}: missing DOCTYPE or <html> tag`,
        })}\n\n`);
        
        await pool.query(
          'UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2',
          ['failed', projectId]
        );
        
        res.end();
        return;
      }
      
      logger.info('HTML structure valid', { projectId, filename: htmlFile.filename });
    }
    
    // VALIDATE file references in HTML
    for (const htmlFile of htmlFiles) {
      const content = htmlFile.content;
      
      // Extract script src references
      const scriptMatches = content.matchAll(/<script[^>]+src=["']([^"']+)["']/gi);
      for (const match of scriptMatches) {
        const referencedFile = match[1];
        const exists = generatedFiles.some(f => f.filename === referencedFile || f.filename.endsWith('/' + referencedFile));
        
        if (!exists) {
          logger.error('Missing referenced file', {
            projectId,
            htmlFile: htmlFile.filename,
            referencedFile,
          });
          
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: `${htmlFile.filename} references ${referencedFile} but file was not generated`,
          })}\n\n`);
          
          await pool.query(
            'UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2',
            ['failed', projectId]
          );
          
          res.end();
          return;
        }
      }
      
      // Extract link href references (CSS)
      const linkMatches = content.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/gi);
      for (const match of linkMatches) {
        const referencedFile = match[1];
        const exists = generatedFiles.some(f => f.filename === referencedFile || f.filename.endsWith('/' + referencedFile));
        
        if (!exists) {
          logger.error('Missing referenced CSS file', {
            projectId,
            htmlFile: htmlFile.filename,
            referencedFile,
          });
          
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: `${htmlFile.filename} references ${referencedFile} but file was not generated`,
          })}\n\n`);
          
          await pool.query(
            'UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2',
            ['failed', projectId]
          );
          
          res.end();
          return;
        }
      }
    }
    
    logger.info('All file references validated', { projectId, htmlFileCount: htmlFiles.length });

    // Save generated files to database AND filesystem
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create app directory
      const appDir = path.join(__dirname, '../../public/downloads', `app-${projectId}`);
      await fs.mkdir(appDir, { recursive: true });

      for (const file of generatedFiles) {
        // Save to database (with file_path column)
        await client.query(
          `INSERT INTO generated_files (project_id, filename, file_path, file_type, content, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            projectId,
            file.filename,
            file.filename, // file_path is same as filename
            file.filename.split('.').pop(),
            file.content,
          ]
        );

        // Save to filesystem
        const filePath = path.join(appDir, file.filename);
        const fileDir = path.dirname(filePath);
        
        // Create subdirectories if needed
        await fs.mkdir(fileDir, { recursive: true });
        await fs.writeFile(filePath, file.content, 'utf8');
      }

      await client.query(
        'UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2',
        ['generated', projectId]
      );

      await client.query('COMMIT');
      
      logger.info('Files saved to database and filesystem', {
        projectId,
        directory: appDir,
        fileCount: generatedFiles.length,
      });
    } catch (dbError) {
      await client.query('ROLLBACK');
      logger.error('Failed to save generated files', { error: dbError.message });
      throw dbError;
    } finally {
      client.release();
    }

    const duration = Date.now() - startTime;

    // Send completion message
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      projectId,
      fileCount: generatedFiles.length,
      duration: `${duration}ms`,
    })}\n\n`);

    res.end();
  } catch (error) {
    logger.error('Generation failed', {
      projectId,
      error: error.message,
      stack: error.stack,
    });

    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message,
    })}\n\n`);

    res.end();
  }
});

module.exports = router;
