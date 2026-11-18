import assert from 'node:assert/strict';
import test from 'node:test';
import { UserSearchRepositoryPort } from '../src/application/ports/UserSearchRepositoryPort.js';
import { HandleUserEventUseCase } from '../src/application/use-cases/HandleUserEventUseCase.js';
import { SearchUsersUseCase } from '../src/application/use-cases/SearchUsersUseCase.js';
import {
  UserSearchDocument,
  UserSearchQuery,
  UserSearchResult,
} from '../src/domain/UserSearchDocument.js';

class InMemorySearchRepo implements UserSearchRepositoryPort {
  public docs = new Map<string, UserSearchDocument>();

  async ensureIndex(): Promise<void> {}

  async upsert(document: UserSearchDocument): Promise<void> {
    this.docs.set(document.id, document);
  }

  async deleteById(id: string): Promise<void> {
    this.docs.delete(id);
  }

  async search(query: UserSearchQuery): Promise<UserSearchResult> {
    let items = [...this.docs.values()];
    if (query.q) {
      const needle = query.q.toLowerCase();
      items = items.filter((d) => d.name.toLowerCase().includes(needle));
    }
    if (query.status) {
      items = items.filter((d) => d.status === query.status);
    }
    return {
      total: items.length,
      items: items.slice(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? 20)),
    };
  }
}

test('HandleUserEventUseCase indexes user.created without password fields', async () => {
  const repo = new InMemorySearchRepo();
  const useCase = new HandleUserEventUseCase(repo);

  await useCase.execute({
    eventName: 'user.created',
    occurredOn: '2026-11-17T00:00:00Z',
    payload: {
      id: 'user-1',
      name: 'Santiago',
      email: 'santi@example.com',
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash: '$2a$12$secret',
    },
  });

  const saved = repo.docs.get('user-1');
  assert.ok(saved);
  assert.equal(saved.name, 'Santiago');
  assert.equal('passwordHash' in saved, false);
});

test('HandleUserEventUseCase deletes document on user.deleted', async () => {
  const repo = new InMemorySearchRepo();
  const useCase = new HandleUserEventUseCase(repo);

  await useCase.execute({
    eventName: 'user.created',
    payload: { id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'MEMBER', status: 'ACTIVE' },
  });
  await useCase.execute({
    eventName: 'user.deleted',
    payload: { id: 'user-1' },
  });

  assert.equal(repo.docs.has('user-1'), false);
});

test('SearchUsersUseCase filters by query and status', async () => {
  const repo = new InMemorySearchRepo();
  const handle = new HandleUserEventUseCase(repo);
  const search = new SearchUsersUseCase(repo);

  await handle.execute({
    eventName: 'user.created',
    payload: { id: '1', name: 'Carlos Perez', email: 'c@x.com', role: 'MEMBER', status: 'ACTIVE' },
  });
  await handle.execute({
    eventName: 'user.created',
    payload: { id: '2', name: 'Carlos Gomez', email: 'g@x.com', role: 'MEMBER', status: 'INACTIVE' },
  });

  const result = await search.execute({ q: 'Carlos', status: 'ACTIVE' });
  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.id, '1');
});
