#!/bin/bash

# Command Agent v3 - GitHub Deployment Script
# This script syncs the enhanced frontend to GitHub for Coolify deployment

set -e  # Exit on any error

echo "=================================================="
echo "Command Agent v3 - GitHub Deployment Script"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/manipadisetti/commandagent3.git"
PROJECT_DIR="/home/ubuntu/command-agent-v3"
TEMP_REPO="/tmp/commandagent3-deploy"

echo -e "${BLUE}Step 1: Preparing deployment...${NC}"
cd "$PROJECT_DIR"

# Check if we have changes
if [ ! -f "public/index.html" ]; then
    echo -e "${RED}Error: Enhanced frontend files not found!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Enhanced frontend files found${NC}"
echo ""

echo -e "${BLUE}Step 2: Cloning GitHub repository...${NC}"
# Remove old temp directory if exists
rm -rf "$TEMP_REPO"

# Clone the repository
git clone "$REPO_URL" "$TEMP_REPO"
cd "$TEMP_REPO"

echo -e "${GREEN}✓ Repository cloned${NC}"
echo ""

echo -e "${BLUE}Step 3: Copying enhanced files...${NC}"

# Copy public directory files
echo "  → Copying public/index.html"
cp "$PROJECT_DIR/public/index.html" "$TEMP_REPO/public/index.html"

echo "  → Copying public/app.js"
cp "$PROJECT_DIR/public/app.js" "$TEMP_REPO/public/app.js"

echo "  → Copying public/styles.css"
cp "$PROJECT_DIR/public/styles.css" "$TEMP_REPO/public/styles.css"

# Copy server.js with new routes
echo "  → Copying server.js"
cp "$PROJECT_DIR/server.js" "$TEMP_REPO/server.js"

# Copy new route files
echo "  → Copying knowledge graph route"
mkdir -p "$TEMP_REPO/src/utils"
cp "$PROJECT_DIR/src/utils/knowledgeGraph.js" "$TEMP_REPO/src/utils/knowledgeGraph.js"
cp "$PROJECT_DIR/src/routes/knowledgeGraph.js" "$TEMP_REPO/src/routes/knowledgeGraph.js"

echo "  → Copying deploy marketing route"
cp "$PROJECT_DIR/src/routes/deployMarketing.js" "$TEMP_REPO/src/routes/deployMarketing.js"

# Copy .env file
echo "  → Copying .env file"
cp "$PROJECT_DIR/.env" "$TEMP_REPO/.env"

echo -e "${GREEN}✓ All files copied${NC}"
echo ""

echo -e "${BLUE}Step 4: Committing changes...${NC}"

# Configure git
git config user.email "mani@almostmagic.tech"
git config user.name "Mani Padisetti"

# Add all changes
git add -A

# Check if there are changes to commit
if git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}No changes to commit - files are already up to date${NC}"
else
    # Commit changes
    git commit -m "Enhanced frontend with complete workflow, knowledge graph, and marketing deployment

- Added beautiful hero section with gradient background
- Implemented 7-step workflow (upload → analysis → questions → confirmation → knowledge graph → generation → deployment)
- Added real-time progress indicators (percentage, time, tokens)
- Integrated knowledge graph visualization
- Added marketing website auto-deployment feature
- Converted all text to Australian English
- Enhanced UI/UX with modern design
- Added Socket.IO for real-time updates
- Improved accessibility and mobile responsiveness"

    echo -e "${GREEN}✓ Changes committed${NC}"
fi

echo ""
echo -e "${BLUE}Step 5: Pushing to GitHub...${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: You need to authenticate with GitHub${NC}"
echo -e "${YELLOW}When prompted, enter your GitHub credentials:${NC}"
echo -e "  Username: manipadisetti"
echo -e "  Password: Your GitHub Personal Access Token"
echo ""
echo -e "${YELLOW}Don't have a token? Create one at:${NC}"
echo -e "  https://github.com/settings/tokens"
echo -e "  (Select 'repo' scope)"
echo ""
read -p "Press Enter to continue with push..."

# Push to GitHub
git push origin main

echo ""
echo -e "${GREEN}✓ Successfully pushed to GitHub!${NC}"
echo ""

echo "=================================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Go to your Coolify dashboard"
echo "2. Click the 'Redeploy' button"
echo "3. Wait for the deployment to complete"
echo "4. Access your application at:"
echo "   http://sc8k4ocws4s4ggoowogsqwo4.170.64.228.171.sslip.io"
echo ""
echo "The enhanced frontend will be live after redeployment!"
echo ""

# Cleanup
cd /
rm -rf "$TEMP_REPO"

echo -e "${GREEN}✓ Cleanup complete${NC}"
