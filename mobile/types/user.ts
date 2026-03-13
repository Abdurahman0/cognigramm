import type { ID } from "@/types/common";

export type EmployeeRole =
  | "ceo"
  | "cto"
  | "manager"
  | "hr"
  | "developer"
  | "designer"
  | "product"
  | "qa"
  | "intern";

export type Department =
  | "Executive"
  | "Engineering"
  | "Product"
  | "Design"
  | "HR"
  | "Operations"
  | "Sales";

export type UserPresence = "available" | "in_meeting" | "busy" | "on_break" | "offline" | "remote";

export interface User {
  id: ID;
  fullName: string;
  email: string;
  avatar: string;
  role: EmployeeRole;
  department: Department;
  title: string;
  presence: UserPresence;
  isOnline: boolean;
  about: string;
  timezone: string;
  lastSeenAt?: string;
}
