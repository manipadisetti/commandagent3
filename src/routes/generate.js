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

Generate a complete application with:
1. index.html - A STANDALONE HTML file that works immediately in the browser
2. All necessary CSS in separate files or inline
3. JavaScript files that work without build tools (vanilla JS or CDN libraries)
4. Configuration files (package.json, .env.example, etc.) for backend if needed
5. README.md with setup instructions
6. Database schema (if needed)
7. API documentation (if applicable)

CRITICAL REQUIREMENTS FOR index.html:
- MUST be a complete, working HTML file in the root directory
- MUST work when opened directly in a browser (no build step)
- Use vanilla JavaScript or CDN-hosted libraries (React via CDN, Vue via CDN, etc.)
- If using React, use React from CDN with Babel standalone for JSX
- DO NOT generate JSX files that need webpack/vite/create-react-app
- All JavaScript MUST be either inline or in separate .js files that work in browsers
- Include all CSS either inline or in separate .css files

Example of acceptable React approach (use CDN libraries):
- Load React from unpkg.com CDN
- Load ReactDOM from unpkg.com CDN  
- Load Babel standalone for JSX
- Write React code in script type="text/babel" tags
- Everything in a single HTML file that works immediately

The index.html file MUST work immediately when accessed via a web server without any build process.

IMPORTANT: Format your response EXACTLY as a series of files using this structure:
=== FILENAME: path/to/file.ext ===
[file content here]
=== END FILE ===

Make the code production-ready, well-commented, and follow best practices.
Use Australian English spelling (organise, colour, analyse, etc.) in all comments and documentation.`;

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
