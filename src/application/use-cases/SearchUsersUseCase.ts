import {
  UserSearchQuery,
  UserSearchResult,
} from '../../domain/UserSearchDocument.js';
import { UserSearchRepositoryPort } from '../ports/UserSearchRepositoryPort.js';

export class SearchUsersUseCase {
  constructor(private readonly repository: UserSearchRepositoryPort) {}

  async execute(query: UserSearchQuery): Promise<UserSearchResult> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    return this.repository.search({
      q: query.q?.trim() || undefined,
      status: query.status?.trim() || undefined,
      limit,
      offset,
    });
  }
}
