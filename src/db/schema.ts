import { integer, pgTable, serial, text, timestamp, vector } from 'drizzle-orm/pg-core';

// Tabela de documentos chunks com embeddings
export const documentChunks = pgTable('document_chunks', {
  id: serial('id').primaryKey(),
  chunkId: text('chunk_id').notNull().unique(),
  content: text('content').notNull(),
  source: text('source').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  totalChunks: integer('total_chunks').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Tabela para rastrear hashes de documentos
export const documentHashes = pgTable('document_hashes', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull().unique(),
  contentHash: text('content_hash').notNull(),
  lastIngested: timestamp('last_ingested').defaultNow().notNull(),
});

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
export type DocumentHash = typeof documentHashes.$inferSelect;
export type NewDocumentHash = typeof documentHashes.$inferInsert;
