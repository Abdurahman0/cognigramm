import type { ID } from "@/types/common";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  department: string;
}

export interface AuthSession {
  userId: ID;
  token: string;
}
