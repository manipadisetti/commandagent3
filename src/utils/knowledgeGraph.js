// Knowledge Graph Generator for Command Agent v3
// ============================================================================

/**
 * Generate a knowledge graph from project analysis
 * @param {Object} analysis - The project analysis data
 * @returns {Object} Knowledge graph structure
 */
function generateKnowledgeGraph(analysis) {
    const nodes = [];
    const edges = [];
    let nodeId = 0;

    // Root node - Project
    const projectNode = {
        id: nodeId++,
        label: analysis.projectName || 'Project',
        type: 'project',
        level: 0
    };
    nodes.push(projectNode);

    // Requirements nodes
    if (analysis.summary) {
        const requirementsNode = {
            id: nodeId++,
            label: 'Requirements',
            type: 'requirements',
            level: 1,
            description: analysis.summary
        };
        nodes.push(requirementsNode);
        edges.push({
            from: projectNode.id,
            to: requirementsNode.id,
            label: 'defines'
        });
    }

    // Features nodes
    if (analysis.features && analysis.features.length > 0) {
        const featuresNode = {
            id: nodeId++,
            label: 'Features',
            type: 'features',
            level: 1
        };
        nodes.push(featuresNode);
        edges.push({
            from: projectNode.id,
            to: featuresNode.id,
            label: 'includes'
        });

        // Individual feature nodes
        analysis.features.slice(0, 5).forEach((feature, index) => {
            const featureNode = {
                id: nodeId++,
                label: feature.substring(0, 30) + (feature.length > 30 ? '...' : ''),
                type: 'feature',
                level: 2,
                description: feature
            };
            nodes.push(featureNode);
            edges.push({
                from: featuresNode.id,
                to: featureNode.id,
                label: `feature ${index + 1}`
            });
        });
    }

    // Tech Stack nodes
    if (analysis.recommended_tech_stack && analysis.recommended_tech_stack.length > 0) {
        const techStackNode = {
            id: nodeId++,
            label: 'Tech Stack',
            type: 'techstack',
            level: 1
        };
        nodes.push(techStackNode);
        edges.push({
            from: projectNode.id,
            to: techStackNode.id,
            label: 'uses'
        });

        // Group technologies by category
        const frontend = [];
        const backend = [];
        const database = [];
        const other = [];

        analysis.recommended_tech_stack.forEach(tech => {
            const techLower = tech.toLowerCase();
            if (techLower.includes('react') || techLower.includes('vue') || 
                techLower.includes('angular') || techLower.includes('html') || 
                techLower.includes('css')) {
                frontend.push(tech);
            } else if (techLower.includes('node') || techLower.includes('express') || 
                       techLower.includes('django') || techLower.includes('flask') ||
                       techLower.includes('api')) {
                backend.push(tech);
            } else if (techLower.includes('sql') || techLower.includes('mongo') || 
                       techLower.includes('redis') || techLower.includes('database')) {
                database.push(tech);
            } else {
                other.push(tech);
            }
        });

        // Frontend node
        if (frontend.length > 0) {
            const frontendNode = {
                id: nodeId++,
                label: 'Frontend',
                type: 'layer',
                level: 2,
                technologies: frontend
            };
            nodes.push(frontendNode);
            edges.push({
                from: techStackNode.id,
                to: frontendNode.id,
                label: 'layer'
            });
        }

        // Backend node
        if (backend.length > 0) {
            const backendNode = {
                id: nodeId++,
                label: 'Backend',
                type: 'layer',
                level: 2,
                technologies: backend
            };
            nodes.push(backendNode);
            edges.push({
                from: techStackNode.id,
                to: backendNode.id,
                label: 'layer'
            });
        }

        // Database node
        if (database.length > 0) {
            const databaseNode = {
                id: nodeId++,
                label: 'Database',
                type: 'layer',
                level: 2,
                technologies: database
            };
            nodes.push(databaseNode);
            edges.push({
                from: techStackNode.id,
                to: databaseNode.id,
                label: 'layer'
            });
        }

        // Other technologies
        if (other.length > 0) {
            const otherNode = {
                id: nodeId++,
                label: 'Tools & Services',
                type: 'layer',
                level: 2,
                technologies: other
            };
            nodes.push(otherNode);
            edges.push({
                from: techStackNode.id,
                to: otherNode.id,
                label: 'uses'
            });
        }
    }

    // Architecture nodes
    if (analysis.architecture_type) {
        const architectureNode = {
            id: nodeId++,
            label: 'Architecture',
            type: 'architecture',
            level: 1,
            description: analysis.architecture_type
        };
        nodes.push(architectureNode);
        edges.push({
            from: projectNode.id,
            to: architectureNode.id,
            label: 'follows'
        });
    }

    // Deployment node
    const deploymentNode = {
        id: nodeId++,
        label: 'Deployment',
        type: 'deployment',
        level: 1
    };
    nodes.push(deploymentNode);
    edges.push({
        from: projectNode.id,
        to: deploymentNode.id,
        label: 'deploys to'
    });

    return {
        nodes,
        edges,
        metadata: {
            totalNodes: nodes.length,
            totalEdges: edges.length,
            maxLevel: Math.max(...nodes.map(n => n.level)),
            generatedAt: new Date().toISOString()
        }
    };
}

/**
 * Convert knowledge graph to D3.js format
 * @param {Object} graph - Knowledge graph structure
 * @returns {Object} D3.js compatible format
 */
function toD3Format(graph) {
    return {
        nodes: graph.nodes.map(node => ({
            id: node.id,
            name: node.label,
            group: node.type,
            level: node.level,
            description: node.description,
            technologies: node.technologies
        })),
        links: graph.edges.map(edge => ({
            source: edge.from,
            target: edge.to,
            label: edge.label
        }))
    };
}

/**
 * Convert knowledge graph to Cytoscape.js format
 * @param {Object} graph - Knowledge graph structure
 * @returns {Array} Cytoscape.js compatible format
 */
function toCytoscapeFormat(graph) {
    const elements = [];

    // Add nodes
    graph.nodes.forEach(node => {
        elements.push({
            group: 'nodes',
            data: {
                id: `node-${node.id}`,
                label: node.label,
                type: node.type,
                level: node.level,
                description: node.description,
                technologies: node.technologies
            }
        });
    });

    // Add edges
    graph.edges.forEach((edge, index) => {
        elements.push({
            group: 'edges',
            data: {
                id: `edge-${index}`,
                source: `node-${edge.from}`,
                target: `node-${edge.to}`,
                label: edge.label
            }
        });
    });

    return elements;
}

/**
 * Generate a simple HTML representation of the knowledge graph
 * @param {Object} graph - Knowledge graph structure
 * @returns {String} HTML string
 */
function toHTML(graph) {
    let html = '<div class="knowledge-graph-simple">';
    
    // Group nodes by level
    const nodesByLevel = {};
    graph.nodes.forEach(node => {
        if (!nodesByLevel[node.level]) {
            nodesByLevel[node.level] = [];
        }
        nodesByLevel[node.level].push(node);
    });

    // Render each level
    Object.keys(nodesByLevel).sort().forEach(level => {
        html += `<div class="graph-level" data-level="${level}">`;
        nodesByLevel[level].forEach(node => {
            html += `
                <div class="graph-node" data-type="${node.type}" data-id="${node.id}">
                    <div class="node-label">${node.label}</div>
                    ${node.description ? `<div class="node-description">${node.description}</div>` : ''}
                    ${node.technologies ? `<div class="node-tech">${node.technologies.join(', ')}</div>` : ''}
                </div>
            `;
        });
        html += '</div>';
        
        // Add connector between levels
        if (parseInt(level) < Object.keys(nodesByLevel).length - 1) {
            html += '<div class="level-connector"></div>';
        }
    });

    html += '</div>';
    return html;
}

module.exports = {
    generateKnowledgeGraph,
    toD3Format,
    toCytoscapeFormat,
    toHTML
};
