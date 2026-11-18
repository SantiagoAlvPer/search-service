import fs from 'node:fs';
import { Consumer, Kafka, SASLOptions } from 'kafkajs';
import { HandleUserEventUseCase } from '../../application/use-cases/HandleUserEventUseCase.js';
import { UserDomainEvent } from '../../domain/UserSearchDocument.js';

export interface KafkaConsumerConfig {
  brokers: string[];
  topic: string;
  groupId: string;
  saslMechanism?: string;
  username?: string;
  password?: string;
  caCert?: string;
  caCertPath?: string;
}

export class KafkaUserEventConsumer {
  private readonly consumer: Consumer;
  private readonly topic: string;

  constructor(
    config: KafkaConsumerConfig,
    private readonly handleUserEvent: HandleUserEventUseCase
  ) {
    this.topic = config.topic;

    let ca: string | undefined;
    if (config.caCertPath) {
      ca = fs.readFileSync(config.caCertPath, 'utf8');
    } else if (config.caCert) {
      ca = config.caCert.replace(/\\n/g, '\n');
    }

    let sasl: SASLOptions | undefined;
    if (config.username && config.password) {
      const mechanism = (config.saslMechanism ?? 'scram-sha-256').toLowerCase();
      if (mechanism === 'plain') {
        sasl = { mechanism: 'plain', username: config.username, password: config.password };
      } else if (mechanism === 'scram-sha-512') {
        sasl = {
          mechanism: 'scram-sha-512',
          username: config.username,
          password: config.password,
        };
      } else {
        sasl = {
          mechanism: 'scram-sha-256',
          username: config.username,
          password: config.password,
        };
      }
    }

    const kafka = new Kafka({
      clientId: 'search-service',
      brokers: config.brokers,
      ssl: ca ? { ca: [ca], rejectUnauthorized: true } : Boolean(sasl),
      sasl,
    });

    this.consumer = kafka.consumer({ groupId: config.groupId });
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.topic, fromBeginning: true });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) {
          return;
        }
        try {
          const parsed = JSON.parse(message.value.toString('utf8')) as UserDomainEvent;
          await this.handleUserEvent.execute(parsed);
        } catch (error) {
          console.error('[search-service] Failed to process Kafka message:', error);
        }
      },
    });
  }

  async stop(): Promise<void> {
    await this.consumer.disconnect();
  }
}
