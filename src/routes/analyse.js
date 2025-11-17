const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { pool } = require('../config/database');
const { cacheGet, cacheSet } = require('../config/redis');
const logger = require('../config/logger');

const router = express.Router();

// Initialise Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// POST /api/analyse - Analyse requirements and generate clarifying questions
router.post('/', async (req, res) => {
  const startTime = Date.now();
  const { projectId } = req.body;

  try {
    logger.info('Analysis request received', { projectId });
    
    // Get Socket.IO instance for progress updates
    const io = req.app.get('io');

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

    logger.info('Sending to Gemini for analysis', {
      projectId,
      documentCount: documentsResult.rows.length,
      contentLength: combinedContent.length,
    });
    
    // Send initial progress
    if (io) {
      io.to(`project-${projectId}`).emit('analysis:progress', {
        percentage: 10,
        status: 'Starting analysis...',
        tokensUsed: 0
      });
    }

    // Send to Gemini for analysis
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    // Update progress
    if (io) {
      io.to(`project-${projectId}`).emit('analysis:progress', {
        percentage: 30,
        status: 'Analysing requirements...',
        tokensUsed: 0
      });
    }

    const prompt = `You are an expert business analyst helping non-technical users build applications. Analyse the following requirements documents and provide:

1. A comprehensive summary of what needs to be built
2. Key features and functionality identified
3. Technical requirements and constraints
4. 5-10 clarifying questions focused on BUSINESS NEEDS (NOT technical implementation)

IMPORTANT: Your questions MUST be business-focused and understandable by non-technical users. Ask about:
- WHO will use this (target audience, user roles)
- WHAT problems it solves (business goals, pain points)
- WHEN it will be used (workflows, timing, frequency)
- WHERE it will be accessed (devices, locations, contexts)
- WHY certain features matter (priorities, success metrics)
- HOW users will interact (user experience, workflows)

DO NOT ask about:
- Programming languages or frameworks
- Databases or technical architecture
- Hosting or deployment details
- Technical implementation specifics

Requirements Documents:
${combinedContent}

Please respond in JSON format ONLY (no markdown, no code blocks):
{
  "summary": "Brief overview of the project in business terms",
  "features": ["feature 1", "feature 2", ...],
  "technical_requirements": ["requirement 1", "requirement 2", ...],
  "clarifying_questions": [
    {
      "question": "Business-focused question text",
      "reason": "Why this question is important for business success",
      "category": "audience|goals|workflow|experience|priorities"
    }
  ],
  "estimated_complexity": "low|medium|high",
  "recommended_tech_stack": ["tech 1", "tech 2", ...]
}

Use Australian English spelling (analyse, organise, colour, etc.) in all text.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysisText = response.text();
    let analysis;
    
    // Update progress
    if (io) {
      io.to(`project-${projectId}`).emit('analysis:progress', {
        percentage: 70,
        status: 'Processing response...',
        tokensUsed: analysisText.length
      });
    }

    try {
      // Try to parse as JSON - remove markdown code blocks if present
      let jsonText = analysisText.trim();
      
      // Remove markdown code blocks
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Extract JSON object
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      logger.warn('Failed to parse Gemini response as JSON', {
        error: parseError.message,
        response: analysisText.substring(0, 500),
      });
      // Fallback: create structured response from text
      analysis = {
        summary: analysisText.substring(0, 500),
        features: [],
        technical_requirements: [],
        clarifying_questions: [
          {
            question: 'Who is the primary audience for this application?',
            reason: 'To ensure we design the right user experience',
            category: 'audience',
          },
          {
            question: 'What is the main problem this application solves for your users?',
            reason: 'To focus on the most important features',
            category: 'goals',
          },
          {
            question: 'How do you envision users interacting with this application?',
            reason: 'To create an intuitive workflow',
            category: 'experience',
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
    
    // Send completion progress
    if (io) {
      io.to(`project-${projectId}`).emit('analysis:progress', {
        percentage: 100,
        status: 'Analysis complete!',
        tokensUsed: analysisText.length
      });
    }

    const responseData = {
      success: true,
      projectId,
      analysis,
      questions: analysis.clarifying_questions || [],
      message: 'Analysis completed successfully',
    };

    // Cache the result
    await cacheSet(cacheKey, JSON.stringify(responseData), 3600); // 1 hour

    const duration = Date.now() - startTime;
    logger.info('Analysis completed', { projectId, duration: `${duration}ms` });

    res.json(responseData);
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
