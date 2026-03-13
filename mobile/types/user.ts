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
  | "intern"
  | "employee";

export type Department =
  | "Executive"
  | "Engineering"
  | "Product"
  | "Design"
  | "HR"
  | "Operations"
  | "Sales"
  | "General";

export type UserPresence = "available" | "in_meeting" | "busy" | "on_break" | "offline" | "remote";

export interface User {
  id: ID;
  username?: string;
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
  phone?: string;
  handle?: string;
  officeLocation?: string;
  managerId?: ID;
  createdAt?: string;
  lastSeenAt?: string;
}
