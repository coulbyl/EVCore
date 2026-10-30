import { requireAdmin } from "@/domains/auth/use-cases/require-admin";

/** Admin only (the proxy no longer reads the role: it makes no network call). */
export default async function AdminOnlyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return children;
}
