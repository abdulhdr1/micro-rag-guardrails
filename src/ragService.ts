import OpenAI from 'openai';
import { type Tiktoken, type TiktokenModel, encoding_for_model } from 'tiktoken';
import { config } from './config';
import { logger } from './logger';
import type { Citation, Metrics, RAGResponse } from './types';
import { searchChunks } from './vectorStore';

// State management
let openai: OpenAI;
let tokenizer: Tiktoken;

// Initialize RAG service
export function initializeRAGService(): void {
  openai = new OpenAI({ apiKey: config.openaiApiKey });

  try {
    tokenizer = encoding_for_model(config.llmModel as TiktokenModel);
  } catch {
    tokenizer = encoding_for_model('gpt-4');
  }
}

// Count tokens in text
export function countTokens(text: string): number {
  try {
    const tokens = tokenizer.encode(text);
    return tokens.length;
  } catch (_error) {
    // Fallback: estimativa aproximada (1 token ~= 4 caracteres)
    return Math.ceil(text.length / 4);
  }
}

// Estimate cost based on token usage
export function estimateCost(promptTokens: number, completionTokens: number): number {
  // Preços aproximados para GPT-4 Turbo (março 2024)
  // Input: $0.01 / 1K tokens
  // Output: $0.03 / 1K tokens
  const inputCost = (promptTokens / 1000) * 0.01;
  const outputCost = (completionTokens / 1000) * 0.03;
  return inputCost + outputCost;
}

// Build prompt with context and instructions
export function buildPrompt(question: string, citations: Citation[]): string {
  const context = citations
    .map((c, idx) => `[${idx + 1}] Fonte: ${c.source}\n${c.excerpt}`)
    .join('\n\n');

  return `Você é um assistente especializado em responder perguntas sobre tecnologias educacionais, especificamente sobre Vertex AI, Neo4j e funil educacional.

CONTEXTO RECUPERADO:
${context}

INSTRUÇÕES:
1. Responda APENAS com base no contexto fornecido acima
2. Se a informação não estiver no contexto, diga claramente que não tem essa informação
3. SEMPRE cite as fontes usando o formato [número] ao mencionar informações específicas
4. Seja preciso e conciso
5. Mantenha um tom profissional e educativo

PERGUNTA: ${question}

RESPOSTA:`;
}

// Generate answer using LLM
async function generateAnswer(prompt: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: config.llmModel,
    messages: [
      {
        role: 'system',
        content:
          'Você é um assistente especializado em Vertex AI, Neo4j e funil educacional. Sempre cite suas fontes.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: config.temperature,
    max_tokens: config.maxTokens,
  });

  return completion.choices[0]?.message?.content || 'Sem resposta';
}

// Calculate metrics
function calculateMetrics(
  totalLatency: number,
  retrievalTime: number,
  llmTime: number,
  promptTokens: number,
  completionTokens: number,
  citations: Citation[]
): Metrics {
  return {
    total_latency_ms: totalLatency,
    retrieval_latency_ms: retrievalTime,
    llm_latency_ms: llmTime,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
    estimated_cost_usd: estimateCost(promptTokens, completionTokens),
    top_k_used: config.topK,
    context_size_chars: citations.reduce((sum, c) => sum + c.excerpt.length, 0),
  };
}

// Main RAG pipeline
export async function answerQuestion(question: string): Promise<RAGResponse> {
  const startTime = Date.now();

  try {
    // 1. Retrieval
    const retrievalStart = Date.now();
    const citations = await searchChunks(question, config.topK);
    const retrievalTime = Date.now() - retrievalStart;

    logger.info(`Retrieved ${citations.length} citations`, {
      retrieval_time_ms: retrievalTime,
    });

    // 2. Build prompt
    const prompt = buildPrompt(question, citations);
    const promptTokens = countTokens(prompt);

    // 3. Generate response
    const llmStart = Date.now();
    const answer = await generateAnswer(prompt);
    const llmTime = Date.now() - llmStart;

    // 4. Count completion tokens
    const completionTokens = countTokens(answer);

    // 5. Calculate metrics
    const totalLatency = Date.now() - startTime;
    const metrics = calculateMetrics(
      totalLatency,
      retrievalTime,
      llmTime,
      promptTokens,
      completionTokens,
      citations
    );

    return {
      answer,
      citations,
      metrics,
    };
  } catch (error) {
    logger.error('Error in RAG service', { error });
    throw error;
  }
}

// Cleanup tokenizer
export function cleanupRAGService(): void {
  if (tokenizer) {
    tokenizer.free();
  }
}
