import {
  UserSearchDocument,
  UserSearchQuery,
  UserSearchResult,
} from '../../domain/UserSearchDocument.js';

export interface UserSearchRepositoryPort {
  ensureIndex(): Promise<void>;
  upsert(document: UserSearchDocument): Promise<void>;
  deleteById(id: string): Promise<void>;
  search(query: UserSearchQuery): Promise<UserSearchResult>;
}
