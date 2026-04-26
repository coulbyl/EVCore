"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { EvButton } from "@evcore/ui";
import { logout } from "@/domains/auth/use-cases/logout";

export function LogoutButton({
  className,
  tone = "secondary",
}: {
  className?: string;
  tone?: "primary" | "secondary" | "ghost";
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    try {
      setIsSubmitting(true);
      await logout();
      router.push("/auth/login");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <EvButton
      type="button"
      tone={tone}
      className={className}
      onClick={handleLogout}
      disabled={isSubmitting}
    >
      <LogOut size={16} />
      {isSubmitting ? "Déconnexion..." : "Déconnexion"}
    </EvButton>
  );
}
