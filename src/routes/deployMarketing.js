// Deploy Marketing Website Route
// ============================================================================

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const pool = require('../config/database');

/**
 * POST /api/deploy-marketing
 * Auto-create and deploy a marketing website + application
 */
router.post('/', async (req, res) => {
    try {
        const { projectId } = req.body;

        if (!projectId) {
            return res.status(400).json({
                success: false,
                message: 'Project ID is required'
            });
        }

        // Get BASE_URL from environment, remove trailing slash
        const baseUrl = (process.env.BASE_URL || 'http://localhost:4004').replace(/\/$/, '');

        // Get project details
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

        // Generate marketing website HTML
        const marketingHTML = generateMarketingWebsite(project, analysisData, baseUrl);

        // Create marketing website directory
        const marketingDir = path.join(__dirname, '../../public/downloads', `marketing-${projectId}`);
        await fs.mkdir(marketingDir, { recursive: true });

        // Write marketing website files
        await fs.writeFile(
            path.join(marketingDir, 'index.html'),
            marketingHTML
        );

        await fs.writeFile(
            path.join(marketingDir, 'styles.css'),
            generateMarketingCSS()
        );

        // Build deployment URLs with BASE_URL
        const deploymentUrls = {
            marketing: `${baseUrl}/preview/marketing-${projectId}/`,
            app: `${baseUrl}/preview/app-${projectId}/`,
            status: 'deployed'
        };

        // Update project with deployment info
        await pool.query(
            `UPDATE projects SET metadata = metadata || $1 WHERE id = $2`,
            [JSON.stringify({ deployment: deploymentUrls }), projectId]
        );

        res.json({
            success: true,
            message: 'Marketing website deployed successfully',
            urls: deploymentUrls,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Marketing deployment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to deploy marketing website',
            error: error.message
        });
    }
});

/**
 * Generate marketing website HTML
 */
function generateMarketingWebsite(project, analysis, baseUrl) {
    const projectName = project.name || 'Your Application';
    const description = analysis.summary || 'A powerful application built with AI';
    const features = analysis.features || [];
    const techStack = analysis.recommended_tech_stack || [];

    // Build app URL with BASE_URL
    const appUrl = `${baseUrl}/preview/app-${project.id}/`;

    return `<!DOCTYPE html>
<html lang="en-AU">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName} - AI-Generated Application</title>
    <meta name="description" content="${description}">
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <!-- Hero Section -->
    <header class="hero">
        <div class="container">
            <h1 class="hero-title">From Idea to Deployed App in Minutes</h1>
            <p class="hero-subtitle">Stop wrestling with boilerplate code. Command Agent v3 is your AI software development partner that turns plain English requirements into fully functional, production-ready applications.</p>
            <div class="cta-buttons">
                <a href="#how-it-works" class="btn btn-primary">See How It Works</a>
                <a href="${appUrl}" class="btn btn-secondary">Launch Live Demo</a>
            </div>
        </div>
    </header>

    <!-- The Story (Why) -->
    <section class="story">
        <div class="container">
            <h2 class="section-title">The Frustration of the First 90%</h2>
            <p class="section-intro">Every developer knows the feeling. You have a brilliant idea, but spend weeks on boilerplate instead of the core logic. What if you could skip that entirely?</p>
            <div class="story-grid">
                <div class="story-point">
                    <h3>Why do we write the same code over and over?</h3>
                    <p>Command Agent v3 automates the repetitive setup so you can focus on what makes your app unique.</p>
                </div>
                <div class="story-point">
                    <h3>What if an AI could build the foundation?</h3>
                    <p>We combine large language models with software engineering best practices to build robust applications from your requirements.</p>
                </div>
                <div class="story-point">
                    <h3>Who is this for?</h3>
                    <p>For solo developers, startups, and enterprise teams who need to move fast and prototype rapidly.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- How It Works -->
    <section id="how-it-works" class="how-it-works">
        <div class="container">
            <h2 class="section-title">Your 3-Step Journey to a Deployed App</h2>
            <div class="steps-grid">
                <div class="step-card">
                    <div class="step-number">1</div>
                    <h3>Upload Your Vision</h3>
                    <p>Start with a simple text file, markdown document, or PDF describing what you want to build.</p>
                </div>
                <div class="step-card">
                    <div class="step-number">2</div>
                    <h3>Intelligent Analysis</h3>
                    <p>Our AI agent reads your requirements, asks clarifying questions, and builds a knowledge graph of your app.</p>
                </div>
                <div class="step-card">
                    <div class="step-number">3</div>
                    <h3>Generate & Deploy</h3>
                    <p>With your approval, Command Agent v3 generates the complete full-stack application and deploys it in one click.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="features">
        <div class="container">
            <h2 class="section-title">More Than Just a Code Generator</h2>
            <div class="features-grid">
                ${features.slice(0, 6).map((feature, index) => `
                    <div class="feature-card">
                        <div class="feature-icon">${getFeatureIcon(index)}</div>
                        <h3>${feature}</h3>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>

    <!-- Tech Stack Section -->
    ${techStack.length > 0 ? `
    <section class="tech-stack">
        <div class="container">
            <h2 class="section-title">Built With Modern Technology</h2>
            <div class="tech-badges">
                ${techStack.map(tech => `
                    <span class="tech-badge">${tech}</span>
                `).join('')}
            </div>
        </div>
    </section>
    ` : ''}

    <!-- CTA Section -->
    <section class="cta-section">
        <div class="container">
            <h2>Ready to Build at the Speed of Thought?</h2>
            <a href="${appUrl}" class="btn btn-large">Launch Application</a>
        </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
        <div class="container">
            <p>Generated by Command Agent v3 | An Almost Magic Tech Lab Project</p>
        </div>
    </footer>
</body>
</html>`;
}

/**
 * Generate marketing website CSS
 */
function generateMarketingCSS() {
    return `/* Marketing Website Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

:root {
    --primary: #2563eb;
    --primary-dark: #1e40af;
    --secondary: #64748b;
    --gray-50: #f9fafb;
    --gray-900: #111827;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.6;
    color: var(--gray-900);
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1.5rem;
}

/* Hero Section */
.hero {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 6rem 0;
    text-align: center;
}

.hero-title {
    font-size: 3.5rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
}

.hero-subtitle {
    font-size: 1.5rem;
    margin-bottom: 2rem;
    opacity: 0.95;
}

.cta-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
}

.btn {
    padding: 1rem 2rem;
    border-radius: 0.5rem;
    text-decoration: none;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-block;
}

.btn-primary {
    background: white;
    color: var(--primary);
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
}

.btn-secondary {
    background: transparent;
    color: white;
    border: 2px solid white;
}

.btn-secondary:hover {
    background: white;
    color: var(--primary);
}

.btn-large {
    padding: 1.25rem 2.5rem;
    font-size: 1.125rem;
}

/* Features Section */
.features {
    padding: 5rem 0;
    background: white;
}

.section-title {
    text-align: center;
    font-size: 2.5rem;
    margin-bottom: 3rem;
}

.features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
}

.feature-card {
    padding: 2rem;
    border-radius: 1rem;
    background: var(--gray-50);
    text-align: center;
    transition: all 0.2s;
}

.feature-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
}

.feature-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
}

/* Tech Stack Section */
.tech-stack {
    padding: 5rem 0;
    background: var(--gray-50);
}

.tech-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: center;
}

.tech-badge {
    background: white;
    padding: 0.75rem 1.5rem;
    border-radius: 2rem;
    font-weight: 500;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* CTA Section */
.cta-section {
    padding: 5rem 0;
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    color: white;
    text-align: center;
}

.cta-section h2 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
}

.cta-section p {
    font-size: 1.25rem;
    margin-bottom: 2rem;
    opacity: 0.95;
}

/* Footer */
.footer {
    padding: 3rem 0;
    background: var(--gray-900);
    color: white;
    text-align: center;
}

.footer p {
    margin-bottom: 0.5rem;
    opacity: 0.8;
}

/* Responsive */
@media (max-width: 768px) {
    .hero-title {
        font-size: 2.5rem;
    }
    
    .hero-subtitle {
        font-size: 1.125rem;
    }
    
    .features-grid {
        grid-template-columns: 1fr;
    }
}`;
}

/**
 * Get feature icon based on index
 */
function getFeatureIcon(index) {
    const icons = ['✨', '🚀', '💡', '🎯', '⚡', '🔒', '📊', '🌟'];
    return icons[index % icons.length];
}

module.exports = router;
