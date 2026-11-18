export interface UserSearchDocument {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  updatedAt: string;
}

export interface UserEventPayload {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  // Never indexed; stripped if present
  password?: unknown;
  passwordHash?: unknown;
}

export interface UserDomainEvent {
  eventName: string;
  occurredOn?: string;
  payload?: UserEventPayload;
}

export interface UserSearchQuery {
  q?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface UserSearchResult {
  total: number;
  items: UserSearchDocument[];
}
