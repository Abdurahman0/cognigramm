export interface PaginatedQuery {
  limit?: number;
  offset?: number;
}

export interface ApiErrorPayload {
  detail: string | Array<{ msg: string }>;
}
