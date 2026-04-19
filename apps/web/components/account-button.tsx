"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { HelpCircle, LogOut, Settings, Wallet } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-slate-900 text-[0.72rem] font-bold text-white ring-2 ring-white transition-opacity hover:opacity-80"
      >
        {getInitials(currentUser.fullName)}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">
              {currentUser.fullName}
            </p>
            <p className="text-xs text-slate-400">@{currentUser.username}</p>
          </div>
          <Link
            href="/dashboard/bankroll"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Wallet size={14} />
            Portefeuille
          </Link>
          <Link
            href="/dashboard/aide"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
          >
            <HelpCircle size={14} />
            Aide
          </Link>
          <Link
            href="/dashboard/params/account"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Settings size={14} />
            Paramètres
          </Link>
          <div className="border-t border-border" />
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-sm text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
          >
            <LogOut size={14} />
            {isLoggingOut ? "Déconnexion..." : "Se déconnecter"}
          </button>
        </div>
      )}
    </div>
  );
}
