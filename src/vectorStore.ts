import { count, eq, sql } from "drizzle-orm";
import OpenAI from "openai";
import { config } from "./config";
import { db } from "./db";
import { documentChunks } from "./db/schema";
import { logger } from "./logger";
import type { Citation, DocumentChunk } from "./types";

// State management
let openai: OpenAI;

// Initialize vector store and ensure pgvector extension
export async function initializeVectorStore(): Promise<void> {
  try {
    openai = new OpenAI({ apiKey: config.openaiApiKey });

    // Enable pgvector extension
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

    // Create HNSW index for similarity search (works better with small datasets than IVFFlat)
    // IVFFlat requires 100+ rows to work properly, HNSW works with any amount
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS embedding_idx ON document_chunks
          USING hnsw (embedding vector_cosine_ops)`,
    );

    logger.info("Vector store initialized with pgvector");
  } catch (error) {
    logger.error("Error initializing vector store", { error });
    throw error;
  }
}

// Generate embedding for a single text
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: config.embeddingModel,
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    logger.error("Error generating embedding", { error });
    throw error;
  }
}

// Add chunks to vector store
export async function addChunks(chunks: DocumentChunk[]): Promise<void> {
  try {
    // Generate embeddings for all chunks
    const embeddings = await Promise.all(
      chunks.map((chunk) => generateEmbedding(chunk.content)),
    );

    // Insert chunks with embeddings into database
    const insertData = chunks.map((chunk, index) => ({
      chunkId: chunk.id,
      content: chunk.content,
      source: chunk.source,
      chunkIndex: chunk.metadata.chunk_index,
      totalChunks: chunk.metadata.total_chunks,
      embedding: embeddings[index],
    }));

    await db.insert(documentChunks).values(insertData);

    logger.info(`Added ${chunks.length} chunks to vector store`);
  } catch (error) {
    logger.error("Error adding chunks to vector store", { error });
    throw error;
  }
}

// Search for relevant chunks using cosine similarity
export async function searchChunks(
  query: string,
  topK: number = config.topK,
): Promise<Citation[]> {
  try {
    const queryEmbedding = await generateEmbedding(query);

    // Convert embedding array to PostgreSQL vector literal
    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    // Perform similarity search using pgvector
    // Use sql.raw to properly handle the vector literal (sql`` template doesn't work for vector casting)
    const results = await db.execute(
      sql.raw(`
      SELECT
        source,
        content,
        1 - (embedding <=> '${embeddingStr}'::vector(1536)) as distance
      FROM document_chunks
      ORDER BY embedding <=> '${embeddingStr}'::vector(1536)
      LIMIT ${topK}
    `),
    );

    // results is an array with the rows directly
    return buildCitations(results);
  } catch (error) {
    logger.error("Error searching vector store", { error });
    throw error;
  }
}

// Build citations from query results
function buildCitations(
  results: Array<{ source: string; content: string; distance: number }>,
): Citation[] {
  return results.map((row) => ({
    source: row.source,
    excerpt: row.content,
    score: row.distance,
  }));
}

// Clear all chunks from vector store
export async function clearVectorStore(): Promise<void> {
  try {
    await db.delete(documentChunks);
    logger.info("Vector store cleared");
  } catch (error) {
    logger.error("Error clearing vector store", { error });
    throw error;
  }
}

// Delete chunks by source filename
export async function deleteChunksBySource(source: string): Promise<void> {
  try {
    await db.delete(documentChunks).where(eq(documentChunks.source, source));
    logger.info(`Deleted chunks for source: ${source}`);
  } catch (error) {
    logger.error("Error deleting chunks by source", { error, source });
    throw error;
  }
}

// Check if vector store has data
export async function hasData(): Promise<boolean> {
  try {
    const result = await db.select({ count: count() }).from(documentChunks);
    const chunkCount = Number(result[0]?.count || 0);
    logger.info(`Vector store has ${chunkCount} chunks`);
    return chunkCount > 0;
  } catch (error) {
    logger.error("Error checking vector store data", { error });
    return false;
  }
}
