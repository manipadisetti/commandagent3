// Knowledge Graph API Route
// ============================================================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { generateKnowledgeGraph, toD3Format, toCytoscapeFormat, toHTML } = require('../utils/knowledgeGraph');

/**
 * POST /api/knowledge-graph
 * Generate knowledge graph from project analysis
 */
router.post('/', async (req, res) => {
    try {
        const { projectId, format = 'cytoscape' } = req.body;

        if (!projectId) {
            return res.status(400).json({
                success: false,
                message: 'Project ID is required'
            });
        }

        // Get project analysis from database
        const projectQuery = `
            SELECT p.*, a.analysis_data
            FROM projects p
            LEFT JOIN analysis a ON p.id = a.project_id
            WHERE p.id = $1
        `;
        
        const projectResult = await pool.query(projectQuery, [projectId]);

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        const project = projectResult.rows[0];
        const analysisData = project.analysis_data || {};

        // Generate knowledge graph
        const graph = generateKnowledgeGraph({
            projectName: project.project_name,
            summary: analysisData.summary,
            features: analysisData.features || [],
            recommended_tech_stack: analysisData.recommended_tech_stack || [],
            technical_requirements: analysisData.technical_requirements || [],
            architecture_type: analysisData.architecture_type
        });

        // Convert to requested format
        let formattedGraph;
        switch (format.toLowerCase()) {
            case 'd3':
                formattedGraph = toD3Format(graph);
                break;
            case 'cytoscape':
                formattedGraph = toCytoscapeFormat(graph);
                break;
            case 'html':
                formattedGraph = toHTML(graph);
                break;
            default:
                formattedGraph = graph;
        }

        // Store knowledge graph in database
        const updateQuery = `
            UPDATE analysis
            SET knowledge_graph = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE project_id = $2
        `;
        
        await pool.query(updateQuery, [JSON.stringify(graph), projectId]);

        res.json({
            success: true,
            graph: formattedGraph,
            metadata: graph.metadata
        });

    } catch (error) {
        console.error('Knowledge graph generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate knowledge graph',
            error: error.message
        });
    }
});

/**
 * GET /api/knowledge-graph/:projectId
 * Retrieve existing knowledge graph
 */
router.get('/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { format = 'cytoscape' } = req.query;

        const query = `
            SELECT knowledge_graph
            FROM analysis
            WHERE project_id = $1
        `;
        
        const result = await pool.query(query, [projectId]);

        if (result.rows.length === 0 || !result.rows[0].knowledge_graph) {
            return res.status(404).json({
                success: false,
                message: 'Knowledge graph not found'
            });
        }

        const graph = result.rows[0].knowledge_graph;

        // Convert to requested format
        let formattedGraph;
        switch (format.toLowerCase()) {
            case 'd3':
                formattedGraph = toD3Format(graph);
                break;
            case 'cytoscape':
                formattedGraph = toCytoscapeFormat(graph);
                break;
            case 'html':
                formattedGraph = toHTML(graph);
                break;
            default:
                formattedGraph = graph;
        }

        res.json({
            success: true,
            graph: formattedGraph,
            metadata: graph.metadata
        });

    } catch (error) {
        console.error('Knowledge graph retrieval error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve knowledge graph',
            error: error.message
        });
    }
});

module.exports = router;
