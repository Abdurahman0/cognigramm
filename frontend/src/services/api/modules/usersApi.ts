import type { User } from "@/types/user";

import { httpClient } from "@/services/api/httpClient";

interface SearchUsersParams {
  q?: string;
  limit?: number;
  offset?: number;
  includeSelf?: boolean;
}

export const usersApi = {
  async me(): Promise<User> {
    const { data } = await httpClient.get<User>("/users/me");
    return data;
  },
  async search(params: SearchUsersParams = {}): Promise<User[]> {
    const { data } = await httpClient.get<User[]>("/users", {
      params: {
        q: params.q && params.q.trim().length > 0 ? params.q.trim() : undefined,
        limit: params.limit ?? 20,
        offset: params.offset ?? 0,
        include_self: params.includeSelf ?? false
      }
    });
    return data;
  }
};
