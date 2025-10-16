import dotenv from 'dotenv';
import type { Config } from './types';

dotenv.config();

export const config: Config = {
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  llmModel: process.env.LLM_MODEL || 'gpt-4-turbo-preview',
  chunkSize: Number.parseInt(process.env.CHUNK_SIZE || '500'),
  chunkOverlap: Number.parseInt(process.env.CHUNK_OVERLAP || '50'),
  topK: Number.parseInt(process.env.TOP_K || '3'),
  maxTokens: Number.parseInt(process.env.MAX_TOKENS || '1000'),
  temperature: Number.parseFloat(process.env.TEMPERATURE || '0.0'),
  port: Number.parseInt(process.env.PORT || '3000'),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/cogna_rag',
};

export function validateConfig(): void {
  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
}
