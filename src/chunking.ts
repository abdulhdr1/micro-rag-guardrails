import { config } from './config';
import type { DocumentChunk } from './types';

/**
 * Divide texto em chunks com overlap
 *
 * Decisões de design:
 * - Chunk size: 500 caracteres (equilibra contexto e precisão)
 * - Overlap: 50 caracteres (10% do chunk - mantém continuidade entre chunks)
 * - Split por palavras para não quebrar no meio de termos técnicos
 */
export function chunkText(
  text: string,
  source: string,
  chunkSize: number = config.chunkSize,
  overlap: number = config.chunkOverlap
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const words = text.split(/\s+/);

  let currentChunk: string[] = [];
  let currentLength = 0;
  let chunkIndex = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordLength = word.length + 1; // +1 para o espaço

    if (currentLength + wordLength > chunkSize && currentChunk.length > 0) {
      // Salva chunk atual
      const chunkContent = currentChunk.join(' ');
      chunks.push({
        id: `${source}_chunk_${chunkIndex}`,
        content: chunkContent,
        source,
        metadata: {
          chunk_index: chunkIndex,
          total_chunks: 0, // Será atualizado depois
        },
      });

      // Prepara próximo chunk com overlap
      const overlapWords = Math.floor((overlap / chunkSize) * currentChunk.length);
      currentChunk = currentChunk.slice(-overlapWords);
      currentLength = currentChunk.join(' ').length;
      chunkIndex++;
    }

    currentChunk.push(word);
    currentLength += wordLength;
  }

  // Adiciona último chunk se houver conteúdo
  if (currentChunk.length > 0) {
    chunks.push({
      id: `${source}_chunk_${chunkIndex}`,
      content: currentChunk.join(' '),
      source,
      metadata: {
        chunk_index: chunkIndex,
        total_chunks: 0,
      },
    });
  }

  // Atualiza total_chunks em todos os chunks
  const totalChunks = chunks.length;
  for (const chunk of chunks) {
    chunk.metadata.total_chunks = totalChunks;
  }

  return chunks;
}

export function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
