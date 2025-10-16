export interface Citation {
  source: string;
  excerpt: string;
  score?: number;
}

export interface Metrics {
  total_latency_ms: number;
  retrieval_latency_ms: number;
  llm_latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  top_k_used: number;
  context_size_chars: number;
}

export interface RAGResponse {
  answer: string;
  citations: Citation[];
  metrics: Metrics;
}

export interface GuardrailResult {
  blocked: boolean;
  reason?: string;
  policy_violated?: string;
}

export interface DocumentChunk {
  id: string;
  content: string;
  source: string;
  metadata: {
    chunk_index: number;
    total_chunks: number;
  };
}

export interface Config {
  openaiApiKey: string;
  embeddingModel: string;
  llmModel: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  maxTokens: number;
  temperature: number;
  port: number;
  databaseUrl: string;
}
