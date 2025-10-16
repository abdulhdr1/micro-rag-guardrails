import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { logger } from "../src/logger";

/**
 * Initialize pgvector extension before running db:push
 * This ensures the vector extension is available when creating tables with vector columns
 */
async function initPgVector(): Promise<void> {
  try {
    logger.info("Initializing pgvector extension...");

    // Enable pgvector extension
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

    logger.info("✓ pgvector extension initialized successfully");
    process.exit(0);
  } catch (error) {
    logger.error("✗ Error initializing pgvector extension", { error });
    process.exit(1);
  }
}

initPgVector();
