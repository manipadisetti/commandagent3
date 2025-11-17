const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { marked } = require('marked');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const { pool } = require('../config/database');
const logger = require('../config/logger');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.md', '.pdf', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed. Allowed types: ${allowedTypes.join(', ')}`));
    }
  },
});

// Extract text content from uploaded file
async function extractFileContent(filePath, fileType) {
  try {
    switch (fileType) {
      case '.txt':
      case '.md':
        const textContent = await fs.readFile(filePath, 'utf-8');
        return fileType === '.md' ? marked(textContent) : textContent;

      case '.docx':
      case '.doc':
        const docResult = await mammoth.extractRawText({ path: filePath });
        return docResult.value;

      case '.pdf':
        const pdfBuffer = await fs.readFile(filePath);
        const pdfData = await pdfParse(pdfBuffer);
        return pdfData.text;

      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    logger.error('Error extracting file content:', { error: error.message, filePath, fileType });
    throw new Error(`Failed to extract content from ${fileType} file: ${error.message}`);
  }
}

// POST /api/upload - Upload requirements documents
router.post('/', upload.array('files', 10), async (req, res) => {
  const startTime = Date.now();
  const client = await pool.connect();

  try {
    logger.info('Upload request received', {
      fileCount: req.files?.length || 0,
      projectName: req.body.projectName,
    });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
      });
    }

    await client.query('BEGIN');

    // Create project with unique name
    let baseProjectName = req.body.projectName || `Project ${Date.now()}`;
    const projectDescription = req.body.projectDescription || '';
    const projectType = req.body.projectType || 'application';
    
    // Check if project name exists and make it unique
    let projectName = baseProjectName;
    let attempt = 0;
    let nameExists = true;
    
    while (nameExists && attempt < 100) {
      const checkResult = await client.query(
        'SELECT id FROM projects WHERE name = $1',
        [projectName]
      );
      
      if (checkResult.rows.length === 0) {
        nameExists = false;
      } else {
        attempt++;
        projectName = `${baseProjectName} (${attempt})`;
      }
    }

    const projectResult = await client.query(
      `INSERT INTO projects (name, description, project_type, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'active', NOW(), NOW())
       RETURNING id, name, created_at`,
      [projectName, projectDescription, projectType]
    );

    const project = projectResult.rows[0];
    logger.info('Project created', { projectId: project.id, projectName: project.name });

    // Process each uploaded file
    const documents = [];
    for (const file of req.files) {
      try {
        const fileType = path.extname(file.originalname).toLowerCase();
        logger.info('Processing file', { filename: file.originalname, fileType });

        // Extract content
        const content = await extractFileContent(file.path, fileType);

        // Insert into database (FIXED: removed file_size, using uploaded_at)
        const docResult = await client.query(
          `INSERT INTO documents (project_id, filename, content, file_type, uploaded_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING id, filename, uploaded_at`,
          [project.id, file.originalname, content, fileType]
        );

        documents.push(docResult.rows[0]);
        logger.info('Document saved', {
          documentId: docResult.rows[0].id,
          filename: file.originalname,
        });

        // Clean up uploaded file
        await fs.unlink(file.path).catch((err) => {
          logger.warn('Failed to delete temp file', { path: file.path, error: err.message });
        });
      } catch (error) {
        logger.error('Error processing file', {
          filename: file.originalname,
          error: error.message,
        });
        throw error;
      }
    }

    await client.query('COMMIT');

    const duration = Date.now() - startTime;
    logger.info('Upload completed', {
      projectId: project.id,
      documentCount: documents.length,
      duration: `${duration}ms`,
    });

    res.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        created_at: project.created_at,
      },
      documents: documents.map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        uploaded_at: doc.uploaded_at,
      })),
      message: `Successfully uploaded ${documents.length} document(s)`,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Upload failed', { error: error.message, stack: error.stack });

    // Clean up any uploaded files
    if (req.files) {
      for (const file of req.files) {
        await fs.unlink(file.path).catch(() => {});
      }
    }

    res.status(500).json({
      success: false,
      error: 'Upload failed',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;
