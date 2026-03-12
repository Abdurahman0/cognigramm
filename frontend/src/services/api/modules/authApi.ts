import type { LoginPayload, RegisterPayload, TokenResponse } from "@/types/auth";
import type { User } from "@/types/user";

import { httpClient } from "@/services/api/httpClient";

export const authApi = {
  async register(payload: RegisterPayload): Promise<User> {
    const { data } = await httpClient.post<User>("/auth/register", payload);
    return data;
  },
  async login(payload: LoginPayload): Promise<TokenResponse> {
    const { data } = await httpClient.post<TokenResponse>("/auth/login", payload);
    return data;
  },
  async refresh(refreshToken: string): Promise<TokenResponse> {
    const { data } = await httpClient.post<TokenResponse>("/auth/refresh", { refresh_token: refreshToken });
    return data;
  }
};
