"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HelpCircle, LogOut, Settings, Wallet } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@evcore/ui";
import { logout } from "@/domains/auth/use-cases/logout";
import type { AuthSessionUser } from "@/domains/auth/types/auth";

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? "?").toUpperCase();
  return (
    (parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")
  ).toUpperCase();
}

export function AccountButton({
  currentUser,
}: {
  currentUser: AuthSessionUser;
}) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await logout();
      router.push("/auth/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/80 bg-panel-strong p-0.5 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Ouvrir le menu du compte"
        >
          <Avatar size="default" className="ring-1 ring-border">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-[0.72rem] font-bold">
              {getInitials(currentUser.fullName)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-64 rounded-2xl border-border bg-panel-strong p-2 shadow-lg"
      >
        <DropdownMenuLabel className="px-3 py-2">
          <div className="flex items-center gap-3">
            <Avatar size="lg" className="ring-1 ring-border">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground font-bold">
                {getInitials(currentUser.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {currentUser.fullName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                @{currentUser.username}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/bankroll">
              <Wallet />
              Portefeuille
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/help">
              <HelpCircle />
              Aide
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/params/account">
              <Settings />
              Paramètres
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isLoggingOut}
          onSelect={(event) => {
            event.preventDefault();
            void handleLogout();
          }}
        >
          <LogOut />
          {isLoggingOut ? "Déconnexion..." : "Se déconnecter"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
