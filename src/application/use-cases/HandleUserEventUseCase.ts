import { UserDomainEvent, UserSearchDocument } from '../../domain/UserSearchDocument.js';
import { UserSearchRepositoryPort } from '../ports/UserSearchRepositoryPort.js';

export class HandleUserEventUseCase {
  constructor(private readonly repository: UserSearchRepositoryPort) {}

  async execute(event: UserDomainEvent): Promise<void> {
    const id = event.payload?.id;
    if (!id) {
      return;
    }

    if (event.eventName === 'user.deleted') {
      await this.repository.deleteById(id);
      return;
    }

    if (event.eventName === 'user.created' || event.eventName === 'user.updated') {
      const doc: UserSearchDocument = {
        id,
        name: String(event.payload?.name ?? ''),
        email: String(event.payload?.email ?? ''),
        role: String(event.payload?.role ?? ''),
        status: String(event.payload?.status ?? ''),
        updatedAt: event.occurredOn ?? new Date().toISOString(),
      };
      await this.repository.upsert(doc);
    }
  }
}
