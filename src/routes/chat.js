const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { pool } = require('../config/database');
const logger = require('../config/logger');

const router = express.Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// POST /api/chat - Chat about the project
router.post('/', async (req, res) => {
  const { projectId, message } = req.body;

  try {
    logger.info('Chat request received', { projectId, messageLength: message?.length });

    if (!projectId || !message) {
      return res.status(400).json({
        success: false,
        error: 'projectId and message are required',
      });
    }

    // Get project context
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

    // Get chat history
    const historyResult = await pool.query(
      'SELECT role, content FROM chat_messages WHERE project_id = $1 ORDER BY created_at',
      [projectId]
    );

    // Save user message
    await pool.query(
      'INSERT INTO chat_messages (project_id, role, content, created_at) VALUES ($1, $2, $3, NOW())',
      [projectId, 'user', message]
    );

    // Build conversation history
    const messages = historyResult.rows.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Add current message
    messages.push({
      role: 'user',
      content: message,
    });

    // Add system context if first message
    if (messages.length === 1) {
      const documentsResult = await pool.query(
        'SELECT filename, content FROM documents WHERE project_id = $1',
        [projectId]
      );

      const context = `You are a helpful assistant discussing a software project.

Project: ${project.name}
Description: ${project.description || 'No description'}

${project.analysis_json ? `Analysis: ${project.analysis_json}` : ''}

${documentsResult.rows.length > 0 ? `Requirements: ${documentsResult.rows.map(d => d.content).join('\n\n')}` : ''}

Answer questions about the project, provide suggestions, and help clarify requirements.`;

      messages.unshift({
        role: 'user',
        content: context,
      });

      messages.push({
        role: 'assistant',
        content: 'I understand the project context. How can I help you?',
      });
    }

    logger.info('Sending to Claude for chat', {
      projectId,
      messageCount: messages.length,
    });

    // Get response from Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: messages.slice(-10), // Keep last 10 messages for context
    });

    const assistantMessage = response.content[0].text;

    // Save assistant response
    await pool.query(
      'INSERT INTO chat_messages (project_id, role, content, created_at) VALUES ($1, $2, $3, NOW())',
      [projectId, 'assistant', assistantMessage]
    );

    logger.info('Chat response generated', {
      projectId,
      responseLength: assistantMessage.length,
    });

    res.json({
      success: true,
      message: assistantMessage,
      projectId,
    });
  } catch (error) {
    logger.error('Chat failed', {
      projectId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Chat failed',
      message: error.message,
    });
  }
});

// GET /api/chat/:projectId - Get chat history
router.get('/:projectId', async (req, res) => {
  const { projectId } = req.params;

  try {
    const result = await pool.query(
      'SELECT role, content, created_at FROM chat_messages WHERE project_id = $1 ORDER BY created_at',
      [projectId]
    );

    res.json({
      success: true,
      messages: result.rows,
    });
  } catch (error) {
    logger.error('Failed to get chat history', {
      projectId,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get chat history',
    });
  }
});

module.exports = router;
