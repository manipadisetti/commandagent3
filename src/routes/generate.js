const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { pool } = require('../config/database');
const logger = require('../config/logger');

const router = express.Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// POST /api/generate - Generate application code
router.post('/', async (req, res) => {
  const startTime = Date.now();
  const { projectId, answers, preferences } = req.body;

  try {
    logger.info('Generation request received', { projectId });

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

    logger.info('Sending to Claude for code generation', {
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

    // Generate code with Claude
    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      stream: true,
      messages: [
        {
          role: 'user',
          content: `You are an expert software developer. Generate a complete, production-ready application based on these requirements.

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

Format your response as a series of files:
=== FILENAME: path/to/file.ext ===
[file content here]
=== END FILE ===

Make the code production-ready, well-commented, and follow best practices.`,
        },
      ],
    });

    let fullResponse = '';
    let currentFile = null;
    let currentContent = '';
    const generatedFiles = [];

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text;
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
            currentFile = line.replace('=== FILENAME:', '').trim();
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

    // Save generated files to database
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const file of generatedFiles) {
        await client.query(
          `INSERT INTO generated_files (project_id, filename, file_path, file_type, content, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            projectId,
            file.filename,
            file.filename,
            file.filename.split('.').pop(),
            file.content,
          ]
        );
      }

      await client.query(
        'UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2',
        ['generated', projectId]
      );

      await client.query('COMMIT');
    } catch (dbError) {
      await client.query('ROLLBACK');
      logger.error('Failed to save generated files', { error: dbError.message });
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
