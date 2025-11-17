const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { pool } = require('../config/database');
const logger = require('../config/logger');

const router = express.Router();

// Initialise Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// POST /api/enrich-requirements - Enrich requirements with user answers
router.post('/', async (req, res) => {
  const { projectId, answers } = req.body;

  try {
    logger.info('Enrichment request received', { projectId, answerCount: Object.keys(answers).length });

    if (!projectId || !answers) {
      return res.status(400).json({
        success: false,
        error: 'projectId and answers are required',
      });
    }

    // Get project with current analysis
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
    const currentAnalysis = project.analysis_json ? JSON.parse(project.analysis_json) : {};

    // Get original documents
    const documentsResult = await pool.query(
      'SELECT filename, content FROM documents WHERE project_id = $1',
      [projectId]
    );

    const combinedContent = documentsResult.rows
      .map((doc) => `=== ${doc.filename} ===\n${doc.content}`)
      .join('\n\n');

    // Format answers for the prompt
    const answersText = Object.entries(answers)
      .map(([question, answer]) => `Q: ${question}\nA: ${answer}`)
      .join('\n\n');

    // Ask Gemini to enrich the analysis
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `You are enriching a software project analysis with user-provided answers.

Original Requirements:
${combinedContent}

Current Analysis:
${JSON.stringify(currentAnalysis, null, 2)}

User's Answers to Clarifying Questions:
${answersText}

Based on the user's answers, create an ENRICHED analysis that incorporates this new information. The enriched analysis should:
1. Update the summary to reflect the new details
2. Add or modify features based on the answers
3. Update technical requirements if needed
4. Keep the same JSON structure as the original analysis

Respond in JSON format ONLY (no markdown, no code blocks):
{
  "summary": "Enhanced summary incorporating user answers",
  "features": ["enhanced feature list"],
  "technical_requirements": ["updated requirements"],
  "clarifying_questions": ${JSON.stringify(currentAnalysis.clarifying_questions || [])},
  "estimated_complexity": "low|medium|high",
  "recommended_tech_stack": ["tech 1", "tech 2", ...]
}

Use Australian English spelling (analyse, organise, colour, etc.) in all text.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const enrichedText = response.text();
    let enrichedAnalysis;

    try {
      // Parse the enriched analysis
      let jsonText = enrichedText.trim();
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        enrichedAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      logger.warn('Failed to parse enriched analysis', { error: parseError.message });
      // Fallback: use current analysis
      enrichedAnalysis = currentAnalysis;
    }

    // Save enriched analysis back to project
    await pool.query(
      'UPDATE projects SET analysis_json = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(enrichedAnalysis), projectId]
    );

    logger.info('Requirements enriched successfully', { projectId });

    res.json({
      success: true,
      enrichedAnalysis,
      message: 'Requirements enriched with your answers',
    });
  } catch (error) {
    logger.error('Enrichment failed', {
      projectId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to enrich requirements',
      message: error.message,
    });
  }
});

module.exports = router;
