import { notFound } from "next/navigation";
import { getPlayerSession } from "@/domains/auth/use-cases/get-player-session";

/**
 * L'admin (12-admin.md) vit dans la coquille du joueur, en cinquième onglet.
 * Un compte qui n'est pas admin ne le voit pas et n'y entre pas : 404, pas
 * une page « interdit » qui dirait qu'elle existe. Le serveur vérifie de
 * toute façon le rôle sur chaque point d'entrée admin.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await getPlayerSession();
  if (result.status !== "signed-in" || result.session.user.role !== "ADMIN") {
    notFound();
  }
  // Widens the shell's column on a wide screen (scoreboard-shell.tsx).
  return (
    <div data-admin-wide="" className="contents">
      {children}
    </div>
  );
}
