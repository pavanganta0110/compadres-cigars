export type Role = "owner" | "manager" | "fulfillment" | "viewer";
export type Permission = "view" | "fulfill" | "manage_products" | "view_reports" | "view_audit" | "manage_restrictions" | "manage_users" | "refund" | "manage_payments" | "manage_tax";

const MATRIX: Record<Role, readonly Permission[]> = {
  owner: ["view", "fulfill", "manage_products", "view_reports", "view_audit", "manage_restrictions", "manage_users", "refund", "manage_payments", "manage_tax"],
  manager: ["view", "fulfill", "manage_products", "view_reports", "view_audit", "refund"],
  fulfillment: ["view", "fulfill"],
  viewer: ["view"],
};
export const can = (role: string | null | undefined, p: Permission): boolean =>
  !!role && Object.hasOwn(MATRIX, role) && MATRIX[role as Role].includes(p);
