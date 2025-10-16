-- Setup script for PostgreSQL with pgvector extension
-- Run this script to set up the database for the RAG service

-- Create database (if needed)
-- CREATE DATABASE cogna_rag;

-- Connect to the database
\c cogna_rag;

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- The table will be created by Drizzle migrations
-- This script just ensures the extension is available

-- Verify extension is installed
SELECT * FROM pg_extension WHERE extname = 'vector';
