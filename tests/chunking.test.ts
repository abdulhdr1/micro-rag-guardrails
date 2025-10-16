import { describe, expect, it } from 'bun:test';
import { chunkText, cleanText } from '../src/chunking';

describe('Chunking Service', () => {
  describe('cleanText', () => {
    it('should remove excessive newlines', () => {
      const text = 'Line 1\n\n\n\nLine 2';
      const result = cleanText(text);
      expect(result).toBe('Line 1\n\nLine 2');
    });

    it('should normalize line endings', () => {
      const text = 'Line 1\r\nLine 2\r\nLine 3';
      const result = cleanText(text);
      expect(result).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should trim whitespace', () => {
      const text = '  Some text  ';
      const result = cleanText(text);
      expect(result).toBe('Some text');
    });
  });

  describe('chunkText', () => {
    it('should create chunks with correct metadata', () => {
      const text = 'word '.repeat(200); // 1000 caracteres
      const chunks = chunkText(text, 'test.md', 500, 50);

      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.source).toBe('test.md');
        expect(chunk.metadata.total_chunks).toBe(chunks.length);
        expect(chunk.id).toContain('test.md_chunk_');
      }
    });

    it('should respect chunk size limit', () => {
      const text = 'word '.repeat(200);
      const chunkSize = 100;
      const chunks = chunkText(text, 'test.md', chunkSize, 10);

      for (const chunk of chunks) {
        expect(chunk.content.length).toBeLessThanOrEqual(chunkSize + 50); // Margem para palavras
      }
    });

    it('should handle small text without chunking unnecessarily', () => {
      const text = 'Small text';
      const chunks = chunkText(text, 'test.md', 500, 50);

      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe(text);
    });

    it('should create overlapping chunks', () => {
      const text = 'one two three four five six seven eight nine ten';
      const chunks = chunkText(text, 'test.md', 20, 10);

      // Verifica que há overlap entre chunks consecutivos
      if (chunks.length > 1) {
        const lastWordsChunk1 = chunks[0].content.split(' ').slice(-2);
        const firstWordsChunk2 = chunks[1].content.split(' ').slice(0, 2);

        // Deve haver pelo menos uma palavra em comum
        const hasOverlap = lastWordsChunk1.some((word) => firstWordsChunk2.includes(word));
        expect(hasOverlap).toBe(true);
      }
    });
  });
});
