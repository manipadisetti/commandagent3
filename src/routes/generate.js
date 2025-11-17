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
1. All necessary source code files
2. Configuration files (package.json, .env.example, etc.)
3. README.md with setup instructions
4. Database schema (if needed)
5. API documentation (if applicable)

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

    // Save generated files to database AND filesystem
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create app directory
      const appDir = path.join(__dirname, '../../public/downloads', `app-${projectId}`);
      await fs.mkdir(appDir, { recursive: true });

      for (const file of generatedFiles) {
        // Save to database (without file_path column)
        await client.query(
          `INSERT INTO generated_files (project_id, filename, file_type, content, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [
            projectId,
            file.filename,
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
