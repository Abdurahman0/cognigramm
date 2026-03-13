import type { EmployeeRole } from "@/types";

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  ceo: "CEO",
  cto: "CTO",
  manager: "Manager",
  hr: "HR",
  developer: "Developer",
  designer: "Designer",
  product: "Product",
  qa: "QA",
  intern: "Intern"
};
