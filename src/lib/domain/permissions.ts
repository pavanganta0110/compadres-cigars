export type Role = "owner" | "manager" | "fulfillment" | "viewer";
export type Permission = "view" | "fulfill" | "manage_products" | "view_reports" | "view_audit" | "manage_restrictions" | "manage_users";

const MATRIX: Record<Role, readonly Permission[]> = {
  owner: ["view", "fulfill", "manage_products", "view_reports", "view_audit", "manage_restrictions", "manage_users"],
  manager: ["view", "fulfill", "manage_products", "view_reports", "view_audit"],
  fulfillment: ["view", "fulfill"],
  viewer: ["view"],
};
export const can = (role: string | null | undefined, p: Permission): boolean =>
  !!role && Object.hasOwn(MATRIX, role) && MATRIX[role as Role].includes(p);
