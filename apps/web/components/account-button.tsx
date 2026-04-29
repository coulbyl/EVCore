"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HelpCircle, LogOut, Settings, Sprout, Wallet } from "lucide-react";
import {
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
import { UserAvatar } from "@/components/user-avatar";
import { useTranslations } from "next-intl";

export function AccountButton({
  currentUser,
}: {
  currentUser: AuthSessionUser;
}) {
  const router = useRouter();
  const tNav = useTranslations("nav");
  const tAuth = useTranslations("auth");

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
          <UserAvatar
            avatarUrl={currentUser.avatarUrl}
            username={currentUser.fullName}
            size={32}
            className="ring-1 ring-border"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-64 rounded-2xl border-border bg-panel-strong p-2 shadow-lg"
      >
        <DropdownMenuLabel className="px-3 py-2">
          <div className="flex items-center gap-3">
            <UserAvatar
              avatarUrl={currentUser.avatarUrl}
              username={currentUser.fullName}
              size={40}
              className="ring-1 ring-border"
            />
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
              {tNav("bankroll")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/help">
              <HelpCircle />
              {tNav("help")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/performance">
              <Sprout />
              {tNav("performance")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/params/account">
              <Settings />
              {tNav("settings")}
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
          {isLoggingOut ? tAuth("logoutLoading") : tAuth("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
