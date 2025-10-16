import { logger } from './logger';
import type { GuardrailResult } from './types';

/**
 * Sistema de Guardrails para proteger contra:
 * 1. Prompt injection
 * 2. Perguntas fora do domínio
 * 3. Solicitações de dados sensíveis
 */

// Padrões de prompt injection
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+|prior\s+)?(instructions|commands|prompts)/gi,
  /forget\s+(all\s+)?(previous\s+|prior\s+)?(instructions|commands|prompts)/gi,
  /disregard\s+(all\s+)?(previous\s+|prior\s+)?(instructions|commands|prompts)/gi,
  /reveal\s+(your\s+|the\s+)?(system\s+prompt|instructions|prompt)/gi,
  /show\s+(me\s+)?(your\s+|the\s+)?(system\s+prompt|instructions)/gi,
  /what\s+(are\s+|is\s+)(your\s+|the\s+)?(system\s+prompt|instructions)/gi,
  /act\s+as\s+(if\s+)?you\s+(are|were)/gi,
  /pretend\s+(to\s+be|you\s+are)/gi,
  /roleplay\s+as/gi,
  /you\s+are\s+now/gi,
  /new\s+instructions?:/gi,
  /system\s*:\s*/gi,
];

// Padrões de dados sensíveis
const SENSITIVE_DATA_PATTERNS = [
  /\b(cpfs?|cnpjs?|rgs?|ssn|social\s+security)\b/gi,
  /\b(senhas?|passwords?)\b/gi,
  /credit\s+cards?(\s+numbers?)?/gi,
  /\b(cartões?\s+de\s+crédito|números?\s+de\s+cart[ãa]o)\b/gi,
  /\b(chaves?\s+privadas?|private\s+keys?|api\s+keys?|tokens?\s+secretos?)\b/gi,
];

// Palavras-chave do domínio educacional
const DOMAIN_KEYWORDS = [
  'vertex',
  'gcp',
  'neo4j',
  'funil',
  'lead',
  'inscrito',
  'matriculado',
  'aprovado',
  'reprovado',
  'pma',
  'seletivo',
  'rag',
  'llm',
  'embedding',
  'citações',
  'groundedness',
  'latência',
  'custo',
  'token',
  'modelo',
  'educacional',
  'aluno',
  'curso',
  'graph',
  'banco de dados',
  'pipeline',
  'agente',
];

// Padrões genéricos
const GENERIC_PATTERNS = [
  /^(olá|oi|hello|hi)\s*[!?.]?$/i,
  /como\s+(você\s+)?está/i,
  /qual\s+(é\s+)?seu\s+nome/i,
  /quem\s+(é\s+|criou)\s+você/i,
];

// Padrões de vazamento de system prompt
const SYSTEM_LEAK_PATTERNS = [
  /as\s+an\s+ai\s+(language\s+)?model/gi,
  /i\s+am\s+(programmed|designed|trained)\s+to/gi,
  /my\s+(system\s+prompt|instructions)\s+(is|are)/gi,
];

// Check if text matches any pattern
function matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

// Check if question contains domain keywords
function containsDomainKeyword(question: string): boolean {
  const lowerQuestion = question.toLowerCase();
  return DOMAIN_KEYWORDS.some((keyword) => lowerQuestion.includes(keyword));
}

// Check if question is generic
function isGenericQuestion(question: string): boolean {
  return matchesAnyPattern(question, GENERIC_PATTERNS);
}

// Get word count
function getWordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

// Check for prompt injection
function checkPromptInjection(question: string): GuardrailResult | null {
  if (matchesAnyPattern(question, PROMPT_INJECTION_PATTERNS)) {
    logger.warn('Prompt injection detected', { question });
    return {
      blocked: true,
      reason: 'Tentativa de manipulação de prompt detectada',
      policy_violated: 'PROMPT_INJECTION',
    };
  }
  return null;
}

// Check for sensitive data requests
function checkSensitiveData(question: string): GuardrailResult | null {
  if (matchesAnyPattern(question, SENSITIVE_DATA_PATTERNS)) {
    logger.warn('Sensitive data request detected', { question });
    return {
      blocked: true,
      reason: 'Solicitação de dados sensíveis não é permitida',
      policy_violated: 'SENSITIVE_DATA',
    };
  }
  return null;
}

// Check if question is too short
function checkQuestionLength(question: string): GuardrailResult | null {
  const wordCount = getWordCount(question);

  if (wordCount < 3) {
    return {
      blocked: true,
      reason: 'Pergunta muito curta ou inespecífica',
      policy_violated: 'INVALID_QUERY',
    };
  }

  if (question.length > 1000) {
    return {
      blocked: true,
      reason: 'Pergunta excede o tamanho máximo permitido',
      policy_violated: 'QUERY_TOO_LONG',
    };
  }

  return null;
}

// Check if question is in domain
function checkDomain(question: string): GuardrailResult | null {
  const hasDomainKeyword = containsDomainKeyword(question);
  const isGeneric = isGenericQuestion(question);

  if (!hasDomainKeyword && isGeneric) {
    return {
      blocked: true,
      reason:
        'Pergunta fora do domínio. Este sistema responde apenas sobre Vertex AI, Neo4j e funil educacional.',
      policy_violated: 'OUT_OF_DOMAIN',
    };
  }

  return null;
}

// Main guardrail check for questions
export function checkQuestion(question: string): GuardrailResult {
  // Run all checks in sequence
  // Note: checkDomain must come before checkQuestionLength to properly catch generic greetings
  const checks = [checkPromptInjection, checkSensitiveData, checkDomain, checkQuestionLength];

  for (const check of checks) {
    const result = check(question);
    if (result) {
      return result;
    }
  }

  return { blocked: false };
}

// Check if response leaks system information
export function checkResponse(response: string): GuardrailResult {
  if (matchesAnyPattern(response, SYSTEM_LEAK_PATTERNS)) {
    logger.warn('System prompt leak detected in response');
    return {
      blocked: true,
      reason: 'Resposta contém informações do sistema',
      policy_violated: 'SYSTEM_LEAK',
    };
  }

  return { blocked: false };
}
