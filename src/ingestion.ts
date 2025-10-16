import fs from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { chunkText, cleanText } from './chunking';
import { db } from './db';
import { documentChunks, documentHashes } from './db/schema';
import { logger } from './logger';
import { calculateHash } from './utils/hash';
import { addChunks, clearVectorStore, deleteChunksBySource } from './vectorStore';

const DEFAULT_DATA_DIR = './data';

// Get list of markdown files in directory
async function getMarkdownFiles(dataDir: string): Promise<string[]> {
  const files = await fs.readdir(dataDir);
  return files.filter((f) => f.endsWith('.md'));
}

// Read and clean file content
async function readAndCleanFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');
  return cleanText(content);
}

// Check if file needs to be re-ingested based on hash
async function needsReingestion(filename: string, content: string): Promise<boolean> {
  const contentHash = calculateHash(content);

  const existing = await db
    .select()
    .from(documentHashes)
    .where(eq(documentHashes.filename, filename))
    .limit(1);

  if (existing.length === 0) {
    // File never ingested before
    return true;
  }

  // Check if content changed
  const contentChanged = existing[0].contentHash !== contentHash;

  if (contentChanged) {
    return true;
  }

  // Even if hash matches, verify chunks exist in database
  const chunksExist = await db
    .select()
    .from(documentChunks)
    .where(eq(documentChunks.source, filename))
    .limit(1);

  if (chunksExist.length === 0) {
    logger.warn(`Hash exists for ${filename} but no chunks found - will reingest`);
    return true;
  }

  return false;
}

// Update or insert document hash
async function upsertDocumentHash(filename: string, content: string): Promise<void> {
  const contentHash = calculateHash(content);

  const existing = await db
    .select()
    .from(documentHashes)
    .where(eq(documentHashes.filename, filename))
    .limit(1);

  if (existing.length === 0) {
    // Insert new hash
    await db.insert(documentHashes).values({
      filename,
      contentHash,
    });
  } else {
    // Update existing hash
    await db
      .update(documentHashes)
      .set({
        contentHash,
        lastIngested: new Date(),
      })
      .where(eq(documentHashes.filename, filename));
  }
}

// Ingest a single file
async function ingestFile(filename: string, dataDir: string): Promise<void> {
  try {
    const filePath = path.join(dataDir, filename);
    const rawContent = await fs.readFile(filePath, 'utf-8');
    const cleanedContent = cleanText(rawContent);

    // Check if file needs re-ingestion
    const needsUpdate = await needsReingestion(filename, rawContent);

    if (!needsUpdate) {
      logger.info(`Skipping ${filename} (content unchanged)`);
      return;
    }

    logger.info(`Ingesting file: ${filename}`, {
      size: cleanedContent.length,
    });

    // If updating, delete old chunks first
    const existing = await db
      .select()
      .from(documentHashes)
      .where(eq(documentHashes.filename, filename))
      .limit(1);

    if (existing.length > 0) {
      await deleteChunksBySource(filename);
      logger.info(`Deleted old chunks for ${filename}`);
    }

    // Chunk document
    const chunks = chunkText(cleanedContent, filename);
    logger.info(`Created ${chunks.length} chunks from ${filename}`);

    // Add chunks to vector store
    await addChunks(chunks);

    // Update hash
    await upsertDocumentHash(filename, rawContent);

    logger.info(`Successfully ingested ${filename}`);
  } catch (error) {
    logger.error(`Error ingesting file: ${filename}`, { error });
    throw error;
  }
}

// Ingest all markdown documents from data directory
export async function ingestDocuments(dataDir: string = DEFAULT_DATA_DIR): Promise<void> {
  try {
    logger.info('Starting document ingestion');

    const markdownFiles = await getMarkdownFiles(dataDir);
    logger.info(`Found ${markdownFiles.length} documents to ingest`);

    for (const file of markdownFiles) {
      await ingestFile(file, dataDir);
    }

    logger.info('Document ingestion completed');
  } catch (error) {
    logger.error('Error during document ingestion', { error });
    throw error;
  }
}

// Clear and reingest all documents
export async function reingestDocuments(dataDir: string = DEFAULT_DATA_DIR): Promise<void> {
  logger.info('Clearing existing data and reingesting');
  await clearVectorStore();
  await ingestDocuments(dataDir);
}
