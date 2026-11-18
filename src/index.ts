import 'dotenv/config';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { HandleUserEventUseCase } from './application/use-cases/HandleUserEventUseCase.js';
import { SearchUsersUseCase } from './application/use-cases/SearchUsersUseCase.js';
import { createSearchRouter } from './infrastructure/http/controllers/SearchController.js';
import { KafkaUserEventConsumer } from './infrastructure/kafka/KafkaUserEventConsumer.js';
import { OpenSearchUserRepositoryAdapter } from './infrastructure/opensearch/OpenSearchUserRepositoryAdapter.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const port = Number(process.env.PORT ?? 3002);

const repository = new OpenSearchUserRepositoryAdapter({
  nodeUrl: requireEnv('OPENSEARCH_URL'),
  indexName: process.env.OPENSEARCH_INDEX ?? 'users',
  rejectUnauthorized: process.env.OPENSEARCH_TLS_REJECT_UNAUTHORIZED !== 'false',
});

const handleUserEvent = new HandleUserEventUseCase(repository);
const searchUsers = new SearchUsersUseCase(repository);

const kafkaConsumer = new KafkaUserEventConsumer(
  {
    brokers: requireEnv('KAFKA_BROKERS')
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean),
    topic: process.env.KAFKA_TOPIC_USER_EVENTS ?? 'users.events',
    groupId: process.env.KAFKA_GROUP_ID ?? 'search-service-group',
    saslMechanism: process.env.KAFKA_SASL_MECHANISM,
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
    caCert: process.env.KAFKA_CA_CERT,
    caCertPath: process.env.KAFKA_CA_CERT_PATH,
  },
  handleUserEvent
);

const app = express();
app.use(cors());
app.use(express.json());

let opensearchReady = false;
let kafkaReady = false;

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'search-service',
    opensearchReady,
    kafkaReady,
  });
});

app.use(createSearchRouter(searchUsers));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[search-service] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function bootstrap(): Promise<void> {
  const server = app.listen(port, () => {
    console.log(`[search-service] listening on port ${port}`);
  });

  const shutdown = async () => {
    await kafkaConsumer.stop();
    server.close();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await repository.ensureIndex();
  opensearchReady = true;
  console.log('[search-service] OpenSearch index ready');

  await kafkaConsumer.start();
  kafkaReady = true;
  console.log('[search-service] Kafka consumer started');
}

bootstrap().catch((err) => {
  console.error('[search-service] Failed to start:', err);
  process.exit(1);
});
