const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('✅ Database pool connected');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

// Initialise database tables
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create projects table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create analysis table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS analysis (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        analysis_data JSONB DEFAULT '{}',
        knowledge_graph JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create generated_files table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS generated_files (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        filename VARCHAR(500) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        content TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create chat_messages table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes if they don't exist
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analysis_project 
      ON analysis(project_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_generated_files_project 
      ON generated_files(project_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_project 
      ON chat_messages(project_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_created 
      ON chat_messages(created_at);
    `);

    console.log('✅ Database tables initialised');
  } catch (error) {
    console.error('❌ Error initialising database:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initializeDatabase,
  query: (text, params) => pool.query(text, params),
};
