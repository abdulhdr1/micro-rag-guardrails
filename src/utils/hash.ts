import { createHash } from 'node:crypto';

/**
 * Calcula o hash SHA-256 de um conteúdo
 * @param content - O conteúdo para calcular o hash
 * @returns Hash SHA-256 em formato hexadecimal
 */
export function calculateHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
