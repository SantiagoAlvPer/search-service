import { Client } from '@opensearch-project/opensearch';
import { UserSearchRepositoryPort } from '../../application/ports/UserSearchRepositoryPort.js';
import {
  UserSearchDocument,
  UserSearchQuery,
  UserSearchResult,
} from '../../domain/UserSearchDocument.js';

export interface OpenSearchConfig {
  nodeUrl: string;
  indexName: string;
  rejectUnauthorized: boolean;
}

export class OpenSearchUserRepositoryAdapter implements UserSearchRepositoryPort {
  private readonly client: Client;
  private readonly indexName: string;

  constructor(config: OpenSearchConfig) {
    this.indexName = config.indexName;
    this.client = new Client({
      node: config.nodeUrl,
      ssl: {
        rejectUnauthorized: config.rejectUnauthorized,
      },
    });
  }

  async ensureIndex(): Promise<void> {
    const existsResponse = await this.client.indices.exists({
      index: this.indexName,
    });
    if (existsResponse.body) {
      return;
    }

    // Aiven Free plan has 1 node: 1 primary shard, 0 replicas
    await this.client.indices.create({
      index: this.indexName,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            name: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword', ignore_above: 256 },
              },
            },
            email: { type: 'keyword' },
            role: { type: 'keyword' },
            status: { type: 'keyword' },
            updatedAt: { type: 'date' },
          },
        },
      },
    });
  }

  async upsert(document: UserSearchDocument): Promise<void> {
    await this.client.index({
      index: this.indexName,
      id: document.id,
      body: document,
      refresh: 'wait_for',
    });
  }

  async deleteById(id: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.indexName,
        id,
        refresh: 'wait_for',
      });
    } catch (error: unknown) {
      const statusCode = (error as { meta?: { statusCode?: number } })?.meta
        ?.statusCode;
      if (statusCode === 404) {
        return;
      }
      throw error;
    }
  }

  async search(query: UserSearchQuery): Promise<UserSearchResult> {
    const must: Record<string, unknown>[] = [];
    const filter: Record<string, unknown>[] = [];

    if (query.q) {
      must.push({
        match: {
          name: {
            query: query.q,
            fuzziness: 'AUTO',
          },
        },
      });
    }

    if (query.status) {
      filter.push({
        term: {
          status: query.status.toUpperCase(),
        },
      });
    }

    const esQuery =
      must.length === 0 && filter.length === 0
        ? { match_all: {} }
        : { bool: { must, filter } };

    const response = await this.client.search({
      index: this.indexName,
      from: query.offset ?? 0,
      size: query.limit ?? 20,
      body: {
        query: esQuery,
      },
    });

    const hitsObj = response.body.hits as {
      total?: { value?: number } | number;
      hits?: Array<{ _source?: UserSearchDocument }>;
    };

    const total =
      typeof hitsObj.total === 'number'
        ? hitsObj.total
        : (hitsObj.total?.value ?? 0);

    const items = (hitsObj.hits ?? [])
      .map((hit) => hit._source)
      .filter((doc): doc is UserSearchDocument => Boolean(doc));

    return { total, items };
  }
}
