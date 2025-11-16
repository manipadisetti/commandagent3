# Command Agent v3 🚀

> Transform your ideas into working applications with AI

Command Agent v3 is an AI-powered application generator that takes your requirements documents and automatically creates production-ready code. Built with enterprise-grade quality, security, and accessibility in mind.

## ✨ Features

- **📄 Multi-Format Support** - Upload TXT, MD, PDF, or DOCX requirements
- **🤖 AI-Powered Analysis** - Claude AI analyzes and clarifies requirements
- **💬 Interactive Chat** - Discuss your project with AI
- **⚡ Real-Time Generation** - Watch your code being generated live
- **📦 One-Click Download** - Get your complete application as a ZIP
- **🔗 GitHub Integration** - Push directly to GitHub repositories
- **♿ Fully Accessible** - WCAG 2.1 AA compliant, neurodivergent-friendly
- **🔒 Enterprise Security** - Rate limiting, input validation, security headers

## 🏗️ Architecture

### Tech Stack

**Backend:**
- Node.js + Express
- PostgreSQL (production database)
- Redis (caching layer)
- Socket.IO (real-time updates)
- Anthropic Claude AI (code generation)

**Frontend:**
- Vanilla JavaScript (no framework bloat)
- Semantic HTML5
- Modern CSS with accessibility features
- Progressive enhancement

**Quality Tools:**
- ESLint (code quality)
- Prettier (formatting)
- Winston (logging)
- Helmet (security)

## 📋 Prerequisites

- Node.js 18+ (22.13.0 recommended)
- PostgreSQL 14+
- Redis 6+ (optional, for caching)
- Anthropic API key

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd command-agent-v3
npm install
```

### 2. Configure Environment

Create a `.env` file:

```env
# Database
DB_HOST=your-database-host
DB_PORT=5432
DB_NAME=almostmagic
DB_USER=postgres
DB_PASSWORD=your-password

# Redis (optional)
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-password

# Anthropic AI
ANTHROPIC_API_KEY=your-api-key

# Server
PORT=4004
NODE_ENV=development

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800

# Security
SESSION_SECRET=change-this-in-production
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Initialize Database

The application will automatically create the `chat_messages` table on startup.

Ensure these tables exist in your database:
- `projects`
- `documents`
- `generated_files`

### 4. Start the Server

```bash
# Development
npm start

# Development with auto-reload
npm run dev
```

### 5. Open in Browser

Navigate to: `http://localhost:4004`

## 📖 Usage

### Step 1: Upload Requirements

1. Enter your project name and description
2. Select project type (Web App, API, Full-Stack, etc.)
3. Upload your requirements documents (TXT, MD, PDF, DOCX)
4. Click "Upload & Analyze"

### Step 2: Review & Clarify

1. Review the AI-generated analysis
2. Answer clarifying questions
3. Click "Generate Application"

### Step 3: Generation

Watch in real-time as your application is generated:
- Progress bar shows generation status
- Log displays files being created
- Typically takes 2-5 minutes

### Step 4: Download or Deploy

- **Download ZIP**: Get your complete application
- **Push to GitHub**: Create a new repository automatically

## 🔌 API Endpoints

### Upload Requirements
```http
POST /api/upload
Content-Type: multipart/form-data

Form Data:
- projectName: string
- projectDescription: string (optional)
- projectType: string
- files: File[]
```

### Analyze Requirements
```http
POST /api/analyse
Content-Type: application/json

{
  "projectId": number
}
```

### Generate Code
```http
POST /api/generate
Content-Type: application/json

{
  "projectId": number,
  "answers": object,
  "preferences": object (optional)
}
```

### Chat About Project
```http
POST /api/chat
Content-Type: application/json

{
  "projectId": number,
  "message": string
}
```

### Download Generated Code
```http
GET /api/download/:projectId
```

### Push to GitHub
```http
POST /api/github/push
Content-Type: application/json

{
  "projectId": number,
  "githubToken": string,
  "repoName": string,
  "repoDescription": string (optional),
  "isPrivate": boolean
}
```

### List Projects
```http
GET /api/projects
```

### Health Check
```http
GET /api/health
```

## 🛡️ Security Features

- **Helmet**: Security headers (XSS, clickjacking protection)
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: All inputs sanitized
- **File Type Validation**: Only allowed file types accepted
- **File Size Limits**: 50MB maximum per file
- **CORS**: Configurable origin restrictions
- **SQL Injection Protection**: Parameterized queries
- **Error Handling**: No sensitive data in error messages

## ♿ Accessibility Features

- **WCAG 2.1 AA Compliant**
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader Friendly**: ARIA labels and landmarks
- **High Contrast Mode**: Supports prefers-contrast
- **Reduced Motion**: Respects prefers-reduced-motion
- **Clear Visual Hierarchy**: Semantic HTML structure
- **Focus Indicators**: Visible focus states
- **Error Messages**: Clear, actionable feedback

## 📊 Logging

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Errors only
- Console - Development output

Log levels: error, warn, info, debug

## 🧪 Testing

```bash
# Run all tests
npm test

# Run linting
npm run lint

# Format code
npm run format

# Security audit
npm run security
```

## 🚢 Deployment

### Production Checklist

1. **Environment Variables**
   - [ ] Change `SESSION_SECRET`
   - [ ] Set `NODE_ENV=production`
   - [ ] Configure `CORS_ORIGIN`
   - [ ] Use strong database passwords

2. **Database**
   - [ ] Run migrations
   - [ ] Set up backups
   - [ ] Configure connection pooling

3. **Security**
   - [ ] Enable HTTPS
   - [ ] Configure firewall
   - [ ] Set up monitoring
   - [ ] Enable rate limiting

4. **Performance**
   - [ ] Enable Redis caching
   - [ ] Configure CDN for static files
   - [ ] Set up load balancing (if needed)

### Deploy to DigitalOcean/Coolify

1. Push code to Git repository
2. Create new service in Coolify
3. Configure environment variables
4. Deploy!

## 📁 Project Structure

```
command-agent-v3/
├── src/
│   ├── config/
│   │   ├── database.js      # PostgreSQL connection
│   │   ├── redis.js         # Redis connection
│   │   └── logger.js        # Winston logger
│   ├── routes/
│   │   ├── upload.js        # File upload handler
│   │   ├── analyse.js       # Requirements analysis
│   │   ├── generate.js      # Code generation
│   │   ├── chat.js          # Chat functionality
│   │   ├── download.js      # ZIP download
│   │   └── github.js        # GitHub integration
│   └── middleware/          # Custom middleware
├── public/
│   ├── index.html           # Main frontend
│   ├── styles.css           # Accessible styles
│   └── app.js               # Frontend logic
├── uploads/                 # Temporary file storage
├── downloads/               # Generated ZIPs
├── logs/                    # Application logs
├── server.js                # Main server file
├── package.json             # Dependencies
├── .env                     # Environment config
└── README.md                # This file
```

## 🐛 Troubleshooting

### Database Connection Failed

**Problem**: Can't connect to PostgreSQL

**Solutions**:
- Verify `DB_HOST`, `DB_PORT`, `DB_NAME` in `.env`
- Check database is running: `pg_isready -h <host> -p <port>`
- Verify firewall allows connection
- Check credentials are correct

### Redis Connection Failed

**Problem**: Redis errors in console

**Solutions**:
- Redis is optional, app will work without it
- Verify `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- Comment out Redis config in `.env` to disable

### File Upload Fails

**Problem**: "file_size column doesn't exist"

**Solutions**:
- This is fixed in v3.0.0
- Ensure you're using the latest code
- Check `upload.js` doesn't reference `file_size`

### Generation Hangs

**Problem**: Code generation never completes

**Solutions**:
- Check Anthropic API key is valid
- Verify API has sufficient credits
- Check network connectivity
- Review logs for errors

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built with [Anthropic Claude](https://www.anthropic.com/)
- Hosted on [DigitalOcean](https://www.digitalocean.com/)
- Deployed with [Coolify](https://coolify.io/)

## 📞 Support

- **Issues**: [GitHub Issues](your-repo-url/issues)
- **Email**: support@almostmagic.tech
- **Documentation**: [Full Docs](your-docs-url)

---

**Made with ❤️ by Almost Magic Tech Lab**

*Empowering developers to build faster, better, and more accessible applications.*
