-- Add knowledge_graph column to store graph data
-- First check if analysis table exists, if not create it

CREATE TABLE IF NOT EXISTS analysis (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    analysis_data JSONB DEFAULT '{}',
    knowledge_graph JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add knowledge_graph column if table already exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'analysis' AND column_name = 'knowledge_graph'
    ) THEN
        ALTER TABLE analysis ADD COLUMN knowledge_graph JSONB;
    END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_analysis_project ON analysis(project_id);
