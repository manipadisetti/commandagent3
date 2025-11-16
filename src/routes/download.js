const express = require('express');
const archiver = require('archiver');
const path = require('path');
const { pool } = require('../config/database');
const logger = require('../config/logger');

const router = express.Router();

// GET /api/download/:projectId - Download generated code as ZIP
router.get('/:projectId', async (req, res) => {
  const { projectId } = req.params;

  try {
    logger.info('Download request received', { projectId });

    // Get project
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

    // Get generated files
    const filesResult = await pool.query(
      'SELECT filename, file_path, content FROM generated_files WHERE project_id = $1',
      [projectId]
    );

    if (filesResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No generated files found for this project',
      });
    }

    logger.info('Generating ZIP', {
      projectId,
      fileCount: filesResult.rows.length,
    });

    // Set response headers
    const zipFilename = `${project.name.replace(/[^a-z0-9]/gi, '_')}_${projectId}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    // Handle errors
    archive.on('error', (err) => {
      logger.error('ZIP generation error', {
        projectId,
        error: err.message,
      });
      throw err;
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add files to archive
    for (const file of filesResult.rows) {
      archive.append(file.content, { name: file.filename });
    }

    // Add project metadata
    const metadata = {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        created_at: project.created_at,
        generated_at: new Date().toISOString(),
      },
      files: filesResult.rows.map((f) => ({
        filename: f.filename,
        type: f.file_type,
      })),
      generator: 'Command Agent v3',
      generator_url: 'https://almostmagic.tech',
    };

    archive.append(JSON.stringify(metadata, null, 2), {
      name: 'project-metadata.json',
    });

    // Finalize archive
    await archive.finalize();

    logger.info('ZIP download completed', {
      projectId,
      fileCount: filesResult.rows.length,
    });
  } catch (error) {
    logger.error('Download failed', {
      projectId,
      error: error.message,
      stack: error.stack,
    });

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Download failed',
        message: error.message,
      });
    }
  }
});

// GET /api/download/:projectId/files - Get list of generated files
router.get('/:projectId/files', async (req, res) => {
  const { projectId } = req.params;

  try {
    const filesResult = await pool.query(
      'SELECT id, filename, file_type, created_at FROM generated_files WHERE project_id = $1',
      [projectId]
    );

    res.json({
      success: true,
      files: filesResult.rows,
    });
  } catch (error) {
    logger.error('Failed to get file list', {
      projectId,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get file list',
    });
  }
});

module.exports = router;
