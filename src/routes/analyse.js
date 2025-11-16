const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { pool } = require('../config/database');
const { cacheGet, cacheSet } = require('../config/redis');
const logger = require('../config/logger');

const router = express.Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// POST /api/analyse - Analyse requirements and generate clarifying questions
router.post('/', async (req, res) => {
  const startTime = Date.now();
  const { projectId } = req.body;

  try {
    logger.info('Analysis request received', { projectId });

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId is required',
      });
    }

    // Check cache first
    const cacheKey = `analysis:${projectId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      logger.info('Returning cached analysis', { projectId });
      return res.json(JSON.parse(cached));
    }

    // Get project and documents
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

    const documentsResult = await pool.query(
      'SELECT filename, content FROM documents WHERE project_id = $1 ORDER BY uploaded_at',
      [projectId]
    );

    if (documentsResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No documents found for this project',
      });
    }

    // Combine all document content
    const combinedContent = documentsResult.rows
      .map((doc) => `=== ${doc.filename} ===\n${doc.content}`)
      .join('\n\n');

    logger.info('Sending to Claude for analysis', {
      projectId,
      documentCount: documentsResult.rows.length,
      contentLength: combinedContent.length,
    });

    // Send to Claude for analysis
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are an expert software requirements analyst. Analyze the following requirements documents and provide:

1. A comprehensive summary of what needs to be built
2. Key features and functionality identified
3. Technical requirements and constraints
4. 5-10 clarifying questions to ask the user to ensure complete understanding

Requirements Documents:
${combinedContent}

Please respond in JSON format:
{
  "summary": "Brief overview of the project",
  "features": ["feature 1", "feature 2", ...],
  "technical_requirements": ["requirement 1", "requirement 2", ...],
  "clarifying_questions": [
    {
      "question": "The question text",
      "reason": "Why this question is important",
      "category": "technical|functional|design|deployment"
    }
  ],
  "estimated_complexity": "low|medium|high",
  "recommended_tech_stack": ["tech 1", "tech 2", ...]
}`,
        },
      ],
    });

    const analysisText = message.content[0].text;
    let analysis;

    try {
      // Try to parse as JSON
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      logger.warn('Failed to parse Claude response as JSON', {
        error: parseError.message,
      });
      // Fallback: create structured response from text
      analysis = {
        summary: analysisText.substring(0, 500),
        features: [],
        technical_requirements: [],
        clarifying_questions: [
          {
            question: 'What is your preferred technology stack?',
            reason: 'To ensure we use technologies you are comfortable with',
            category: 'technical',
          },
          {
            question: 'What is the expected scale/user load?',
            reason: 'To design appropriate architecture',
            category: 'technical',
          },
        ],
        estimated_complexity: 'medium',
        recommended_tech_stack: ['Node.js', 'React', 'PostgreSQL'],
      };
    }

    // Save analysis to project
    await pool.query(
      'UPDATE projects SET analysis_json = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(analysis), projectId]
    );

    const response = {
      success: true,
      projectId,
      analysis,
      message: 'Analysis completed successfully',
    };

    // Cache the result
    await cacheSet(cacheKey, JSON.stringify(response), 3600); // 1 hour

    const duration = Date.now() - startTime;
    logger.info('Analysis completed', { projectId, duration: `${duration}ms` });

    res.json(response);
  } catch (error) {
    logger.error('Analysis failed', {
      projectId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Analysis failed',
      message: error.message,
    });
  }
});

module.exports = router;
