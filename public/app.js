// Command Agent v3 - Enhanced Frontend (Australian English)
// ============================================================================

// State Management
const state = {
    currentStage: 'hero',
    projectId: null,
    analysis: null,
    questions: [],
    answers: {},
    understanding: null,
    knowledgeGraph: null,
    generatedCode: null,
    deploymentUrls: null
};

// Initialize Socket.IO
const socket = io();

// ============================================================================
// DOM Ready
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    setupSocketListeners();
});

// ============================================================================
// Event Listeners
// ============================================================================

function initializeEventListeners() {
    // Hero CTA button
    const startBtn = document.getElementById('startBuildingBtn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            document.getElementById('hero').style.display = 'none';
            document.getElementById('appSection').classList.remove('hidden');
            showStage('uploadStep');
        });
    }
    
    // File upload
    const fileInput = document.getElementById('fileInput');
    const uploadZone = document.getElementById('uploadZone');
    
    if (fileInput && uploadZone) {
        uploadZone.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', handleFileSelect);
        
        // Drag and drop
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });
        
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });
        
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            fileInput.files = e.dataTransfer.files;
            handleFileSelect({ target: fileInput });
        });
    }
    
    // Questions confirmation
    const confirmQuestionsBtn = document.getElementById('confirmQuestionsBtn');
    if (confirmQuestionsBtn) {
        confirmQuestionsBtn.addEventListener('click', submitAnswers);
    }
    
    // Understanding confirmation
    const approveUnderstandingBtn = document.getElementById('approveUnderstandingBtn');
    if (approveUnderstandingBtn) {
        approveUnderstandingBtn.addEventListener('click', () => {
            showStage('knowledgeGraphStep');
            generateKnowledgeGraph();
        });
    }
    
    // Knowledge graph approval
    const approveGraphBtn = document.getElementById('approveGraphBtn');
    if (approveGraphBtn) {
        approveGraphBtn.addEventListener('click', startCodeGeneration);
    }
    
    // Deployment options
    const downloadZipBtn = document.getElementById('downloadZipBtn');
    if (downloadZipBtn) {
        downloadZipBtn.addEventListener('click', downloadZip);
    }
    
    const pushGitHubBtn = document.getElementById('pushGitHubBtn');
    if (pushGitHubBtn) {
        pushGitHubBtn.addEventListener('click', showGitHubOptions);
    }
    
    const deployMarketingBtn = document.getElementById('deployMarketingBtn');
    if (deployMarketingBtn) {
        deployMarketingBtn.addEventListener('click', deployMarketingWebsite);
    }
    
    // Chat
    const sendChatBtn = document.getElementById('sendChatBtn');
    if (sendChatBtn) {
        sendChatBtn.addEventListener('click', sendChatMessage);
    }
}

// ============================================================================
// Socket.IO Listeners
// ============================================================================

function setupSocketListeners() {
    socket.on('analysis:progress', (data) => {
        updateAnalysisProgress(data);
    });
    
    socket.on('generation:progress', (data) => {
        updateGenerationProgress(data);
    });
    
    socket.on('generation:complete', (data) => {
        handleGenerationComplete(data);
    });
    
    socket.on('error', (error) => {
        console.error('Socket error:', error);
        showNotification(error.message, 'error');
    });
}

// ============================================================================
// Stage Management
// ============================================================================

function showStage(stageId) {
    // Hide all stages
    const stages = document.querySelectorAll('.step');
    stages.forEach(stage => stage.classList.remove('active'));
    
    // Show target stage
    const targetStage = document.getElementById(stageId);
    if (targetStage) {
        targetStage.classList.add('active');
        state.currentStage = stageId;
        
        // Update step numbers dynamically
        updateStepNumbers();
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function updateStepNumbers() {
    const stepOrder = ['uploadStep', 'analysisStep', 'questionsStep', 'confirmationStep', 'knowledgeGraphStep', 'generationStep', 'deploymentStep'];
    const stepElements = document.querySelectorAll('.step-number');
    let currentStep = 1;
    
    stepOrder.forEach((stepId, index) => {
        const stepEl = document.getElementById(stepId);
        const numberEl = stepEl ? stepEl.querySelector('.step-number') : null;
        
        if (numberEl) {
            // Skip questions step if no questions
            if (stepId === 'questionsStep' && state.questions.length === 0) {
                return; // Don't increment, skip this step
            }
            
            numberEl.textContent = 'Step ' + currentStep;
            currentStep++;
        }
    });
}

// ============================================================================
// File Upload
// ============================================================================

function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length === 0) return;
    
    const file = files[0];
    const fileInfo = document.getElementById('fileInfo');
    
    fileInfo.innerHTML = `
        <strong>Selected:</strong> ${file.name} (${formatFileSize(file.size)})
    `;
    fileInfo.classList.remove('hidden');
    
    // Auto-upload and analyse
    uploadAndAnalyse(file);
}

async function uploadAndAnalyse(file) {
    const uploadIndicator = document.getElementById('uploadingIndicator');
    if (uploadIndicator) uploadIndicator.classList.remove('hidden');
    
    showStage('analysisStep');
    
    // Extract project name from filename
    const projectName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    
    const formData = new FormData();
    formData.append('files', file);
    formData.append('projectName', projectName);
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            state.projectId = data.project.id;
            await analyseProject();
        } else {
            throw new Error(data.message || 'Upload failed');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showNotification('Upload failed: ' + error.message, 'error');
        showStage('uploadStep');
    }
}

// ============================================================================
// Analysis
// ============================================================================

async function analyseProject() {
    try {
        const response = await fetch('/api/analyse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: state.projectId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            state.analysis = data.analysis;
            state.questions = data.questions || [];
            
            if (state.questions.length > 0) {
                displayQuestions();
                showStage('questionsStep');
            } else {
                showUnderstanding();
                showStage('confirmationStep');
            }
        } else {
            throw new Error(data.message || 'Analysis failed');
        }
    } catch (error) {
        console.error('Analysis error:', error);
        showNotification('Analysis failed: ' + error.message, 'error');
    }
}

function updateAnalysisProgress(data) {
    const progressFill = document.getElementById('progressFill');
    const analysisProgress = document.getElementById('analysisProgress');
    const timeRemaining = document.getElementById('timeRemaining');
    const tokensUsed = document.getElementById('tokensUsed');
    const progressStatus = document.getElementById('progressStatus');
    
    if (progressFill) progressFill.style.width = data.percentage + '%';
    if (analysisProgress) analysisProgress.textContent = data.percentage + '%';
    if (timeRemaining) timeRemaining.textContent = data.timeRemaining || 'Calculating...';
    if (tokensUsed) tokensUsed.textContent = data.tokensUsed || '0';
    if (progressStatus) progressStatus.textContent = data.status || 'Analysing...';
}

// ============================================================================
// Questions
// ============================================================================

function displayQuestions() {
    const questionsList = document.getElementById('questionsList');
    if (!questionsList) return;
    
    questionsList.innerHTML = state.questions.map((q, index) => `
        <div class="question-item">
            <div class="question-text">${q.question}</div>
            <textarea 
                id="answer-${index}" 
                class="question-input" 
                placeholder="Your answer..."
                rows="3"
            ></textarea>
        </div>
    `).join('');
}

function submitAnswers() {
    state.answers = {};
    
    state.questions.forEach((q, index) => {
        const answerEl = document.getElementById(`answer-${index}`);
        if (answerEl) {
            state.answers[q.id || index] = answerEl.value;
        }
    });
    
    showUnderstanding();
    showStage('confirmationStep');
}

// ============================================================================
// Understanding Confirmation
// ============================================================================

function showUnderstanding() {
    const understandingSummary = document.getElementById('understandingSummary');
    if (!understandingSummary) return;
    
    let summaryText = '<h3>Project Overview</h3>';
    summaryText += `<p>${state.analysis.summary || 'No summary available'}</p>`;
    
    if (state.analysis.features && state.analysis.features.length > 0) {
        summaryText += '<h3>Key Features</h3><ul>';
        state.analysis.features.forEach(feature => {
            summaryText += `<li>${feature}</li>`;
        });
        summaryText += '</ul>';
    }
    
    if (Object.keys(state.answers).length > 0) {
        summaryText += '<h3>Your Answers</h3><ul>';
        Object.entries(state.answers).forEach(([key, value]) => {
            if (value) {
                summaryText += `<li>${value}</li>`;
            }
        });
        summaryText += '</ul>';
    }
    
    understandingSummary.innerHTML = summaryText;
    state.understanding = summaryText;
}

// ============================================================================
// Knowledge Graph
// ============================================================================

function generateKnowledgeGraph() {
    const graphContainer = document.getElementById('knowledgeGraph');
    if (!graphContainer) return;
    
    // Simple visual representation using divs (can be replaced with D3.js or similar)
    graphContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 20px; align-items: center;">
            <div style="background: #2563eb; color: white; padding: 20px; border-radius: 10px; font-weight: 600;">
                User Requirements
            </div>
            <div style="width: 2px; height: 30px; background: #2563eb;"></div>
            <div style="background: #10b981; color: white; padding: 20px; border-radius: 10px; font-weight: 600;">
                AI Analysis
            </div>
            <div style="width: 2px; height: 30px; background: #10b981;"></div>
            <div style="display: flex; gap: 20px;">
                <div style="background: #f59e0b; color: white; padding: 20px; border-radius: 10px; font-weight: 600;">
                    Frontend
                </div>
                <div style="background: #f59e0b; color: white; padding: 20px; border-radius: 10px; font-weight: 600;">
                    Backend
                </div>
                <div style="background: #f59e0b; color: white; padding: 20px; border-radius: 10px; font-weight: 600;">
                    Database
                </div>
            </div>
            <div style="width: 2px; height: 30px; background: #f59e0b;"></div>
            <div style="background: #8b5cf6; color: white; padding: 20px; border-radius: 10px; font-weight: 600;">
                Deployed Application
            </div>
        </div>
    `;
}

// ============================================================================
// Code Generation
// ============================================================================

async function startCodeGeneration() {
    showStage('generationStep');
    
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: state.projectId,
                answers: state.answers,
                preferences: {}
            })
        });

        if (!response.ok) {
            throw new Error('Generation request failed');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fileCount = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        
                        if (data.type === 'file') {
                            fileCount++;
                            updateGenerationProgress({ filesCreated: fileCount, status: 'Creating ' + data.filename });
                        } else if (data.type === 'complete') {
                            updateGenerationProgress({ percentage: 100, filesCreated: data.fileCount, status: 'Complete!' });
                            state.generatedCode = { fileCount: data.fileCount };
                            setTimeout(() => showStage('deploymentStep'), 1000);
                        } else if (data.type === 'error') {
                            throw new Error(data.error);
                        }
                    } catch (e) { }
                }
            }
        }
    } catch (error) {
        console.error('Generation error:', error);
        showNotification('Code generation failed: ' + error.message, 'error');
    }
}

function updateGenerationProgress(data) {
    const progressFill = document.getElementById('generationProgressFill');
    const generationProgress = document.getElementById('generationProgress');
    const filesCreated = document.getElementById('filesCreated');
    const generationTimeRemaining = document.getElementById('generationTimeRemaining');
    const generationStatus = document.getElementById('generationStatus');
    
    // Format percentage to 2 decimal places
    const percentage = data.percentage !== undefined ? Number(data.percentage).toFixed(2) : '0.00';
    
    if (progressFill) progressFill.style.width = percentage + '%';
    if (generationProgress) generationProgress.textContent = percentage + '%';
    if (filesCreated) filesCreated.textContent = data.filesCreated || '0';
    
    // Calculate and display time remaining
    if (generationTimeRemaining && data.percentage) {
        const estimatedTotal = 45; // seconds
        const elapsed = (data.percentage / 100) * estimatedTotal;
        const remaining = Math.max(0, estimatedTotal - elapsed);
        
        if (remaining > 60) {
            const mins = Math.floor(remaining / 60);
            const secs = Math.floor(remaining % 60);
            generationTimeRemaining.textContent = mins + ' min ' + secs + ' sec';
        } else {
            generationTimeRemaining.textContent = Math.floor(remaining) + ' sec';
        }
    }
    
    if (generationStatus && data.status) {
        const statusText = generationStatus.querySelector('span');
        if (statusText) statusText.textContent = data.status;
    }
}

function handleGenerationComplete(data) {
    state.generatedCode = data.code;
    showStage('deploymentStep');
}

// ============================================================================
// Deployment
// ============================================================================

async function downloadZip() {
    if (!state.projectId) return;
    
    window.location.href = `/api/download/${state.projectId}`;
}

function showGitHubOptions() {
    const repoName = prompt('Enter GitHub repository name:');
    if (!repoName) return;
    
    const token = prompt('Enter your GitHub Personal Access Token:');
    if (!token) return;
    
    pushToGitHub(repoName, token);
}

async function pushToGitHub(repoName, token) {
    try {
        const response = await fetch('/api/github', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: state.projectId,
                repoName: repoName,
                githubToken: token
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Code pushed to GitHub successfully!', 'success');
            window.open(data.repoUrl, '_blank');
        } else {
            throw new Error(data.message || 'GitHub push failed');
        }
    } catch (error) {
        console.error('GitHub error:', error);
        showNotification('GitHub push failed: ' + error.message, 'error');
    }
}

async function deployMarketingWebsite() {
    showLoadingOverlay('Deploying your marketing website and application...');
    
    try {
        const response = await fetch('/api/deploy-marketing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: state.projectId
            })
        });
        
        const data = await response.json();
        
        hideLoadingOverlay();
        
        if (data.success) {
            state.deploymentUrls = data.urls;
            showNotification('Deployment successful!', 'success');
            
            // Show deployed URLs in a proper modal
            showDeploymentModal(data.urls.marketing, data.urls.app);
        } else {
            throw new Error(data.message || 'Deployment failed');
        }
    } catch (error) {
        hideLoadingOverlay();
        console.error('Deployment error:', error);
        showNotification('Deployment failed: ' + error.message, 'error');
    }
}

// ============================================================================
// Chat
// ============================================================================

async function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || !chatInput.value.trim()) return;
    
    const message = chatInput.value.trim();
    chatInput.value = '';
    
    // Display user message
    addChatMessage(message, 'user');
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: state.projectId,
                message: message
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            addChatMessage(data.response, 'assistant');
        } else {
            throw new Error(data.message || 'Chat failed');
        }
    } catch (error) {
        console.error('Chat error:', error);
        addChatMessage('Sorry, I encountered an error. Please try again.', 'assistant');
    }
}

function addChatMessage(message, role) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${role}`;
    messageEl.textContent = message;
    
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function showNotification(message, type = 'info') {
    // Simple alert for now (can be replaced with toast notifications)
    alert(message);
}

function showLoadingOverlay(message) {
    const overlay = document.getElementById('loadingOverlay');
    const loadingMessage = document.getElementById('loadingMessage');
    
    if (overlay) overlay.classList.remove('hidden');
    if (loadingMessage) loadingMessage.textContent = message;
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
}

function showDeploymentModal(marketingUrl, appUrl) {
    // Create modal HTML
    const modalHTML = `
        <div id="deploymentModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        ">
            <div style="
                background: white;
                padding: 2rem;
                border-radius: 8px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            ">
                <h2 style="margin: 0 0 1rem 0; color: #1a1a1a;">🎉 Your Application is Live!</h2>
                <p style="margin: 0 0 1.5rem 0; color: #666;">Your marketing website and application have been deployed successfully.</p>
                
                <div style="margin-bottom: 1rem;">
                    <strong style="color: #333;">Marketing Website:</strong><br>
                    <a href="${marketingUrl}" target="_blank" style="
                        color: #3b82f6;
                        text-decoration: none;
                        word-break: break-all;
                    ">${marketingUrl}</a>
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <strong style="color: #333;">Application:</strong><br>
                    <a href="${appUrl}" target="_blank" style="
                        color: #3b82f6;
                        text-decoration: none;
                        word-break: break-all;
                    ">${appUrl}</a>
                </div>
                
                <button onclick="closeDeploymentModal()" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 1rem;
                    width: 100%;
                ">OK</button>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeDeploymentModal() {
    const modal = document.getElementById('deploymentModal');
    if (modal) modal.remove();
}
