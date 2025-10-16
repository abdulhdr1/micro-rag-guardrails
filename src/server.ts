import { Hono } from 'hono';
import { config, validateConfig } from './config';
import { checkQuestion, checkResponse } from './guardrails';
import { ingestDocuments, reingestDocuments } from './ingestion';
import { logGuardrailBlock, logMetrics, logRequest, logger } from './logger';
import { answerQuestion, cleanupRAGService, initializeRAGService } from './ragService';
import { initializeVectorStore } from './vectorStore';

const app = new Hono();

// Request schema
interface QuestionRequest {
  question: string;
}

// Middleware para logging com request ID
app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);

  logger.info('Incoming request', {
    requestId,
    method: c.req.method,
    path: c.req.path,
  });

  await next();
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Main Q&A endpoint
app.post('/api/ask', async (c) => {
  const requestId = c.get('requestId');

  try {
    const body = await c.req.json<QuestionRequest>();
    const { question } = body;

    if (!question || typeof question !== 'string') {
      return c.json(
        {
          error: 'Campo "question" é obrigatório e deve ser uma string',
        },
        400
      );
    }

    logRequest(requestId, question);

    // Guardrails check
    const guardrailResult = checkQuestion(question);
    if (guardrailResult.blocked) {
      const reason = guardrailResult.reason || 'Unknown reason';
      const policyViolated = guardrailResult.policy_violated || 'UNKNOWN';
      logGuardrailBlock(requestId, reason, policyViolated);

      return c.json(
        {
          blocked: true,
          reason: guardrailResult.reason,
          policy_violated: guardrailResult.policy_violated,
          timestamp: new Date().toISOString(),
        },
        403
      );
    }

    // Generate response
    const response = await answerQuestion(question);

    // Check response guardrails
    const responseGuardrail = checkResponse(response.answer);
    if (responseGuardrail.blocked) {
      const reason = responseGuardrail.reason || 'Unknown reason';
      const policyViolated = responseGuardrail.policy_violated || 'UNKNOWN';
      logGuardrailBlock(requestId, reason, policyViolated);

      return c.json(
        {
          error: 'Erro na geração da resposta',
          reason: responseGuardrail.reason,
        },
        500
      );
    }

    // Log metrics
    logMetrics(requestId, response.metrics);

    // Return response
    return c.json({
      answer: response.answer,
      citations: response.citations,
      metrics: response.metrics,
      request_id: requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error processing request', {
      requestId,
      error: err.message,
      stack: err.stack,
    });

    return c.json(
      {
        error: 'Erro interno ao processar a pergunta',
        request_id: requestId,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

// Endpoint para reingestão (útil para desenvolvimento/testes)
app.post('/api/admin/reingest', async (c) => {
  try {
    await reingestDocuments();

    return c.json({
      message: 'Documentos reingeridos com sucesso',
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error during reingest', { error: err.message });

    return c.json(
      {
        error: 'Erro ao reingerir documentos',
        message: err.message,
      },
      500
    );
  }
});

// Error handling
app.onError((err, c) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId: c.get('requestId'),
  });

  return c.json(
    {
      error: 'Erro interno do servidor',
      timestamp: new Date().toISOString(),
    },
    500
  );
});

// Initialize and start server
export async function startServer(): Promise<void> {
  try {
    // Validate configuration
    validateConfig();

    // Initialize components
    logger.info('Initializing vector store...');
    await initializeVectorStore();

    logger.info('Initializing RAG service...');
    initializeRAGService();

    // Ingest documents only if vector store is empty
    const { hasData } = await import('./vectorStore');
    const dataExists = await hasData();
    if (!dataExists) {
      logger.info('Ingesting documents...');
      await ingestDocuments();
    } else {
      logger.info('Vector store already has data, skipping ingestion');
    }

    // Start server with Bun
    logger.info(`Starting server on port ${config.port}...`);

    const server = Bun.serve({
      fetch: app.fetch,
      port: config.port,
    });

    logger.info(`Server running on port ${server.port}`);
    logger.info(`Health check: http://localhost:${server.port}/health`);
    logger.info(`Q&A endpoint: http://localhost:${server.port}/api/ask`);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to start server', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

// Graceful shutdown
function shutdown() {
  logger.info('Shutting down gracefully');
  cleanupRAGService();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
