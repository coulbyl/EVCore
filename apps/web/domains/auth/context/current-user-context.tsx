"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthSessionUser } from "@/domains/auth/types/auth";

type CurrentUserContextValue = {
  currentUser: AuthSessionUser;
  setCurrentUser: (user: AuthSessionUser) => void;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({
  initialUser,
  children,
}: {
  initialUser: AuthSessionUser;
  children: ReactNode;
}) {
  const [currentUser, setCurrentUser] = useState<AuthSessionUser>(initialUser);
  const value = useMemo(() => ({ currentUser, setCurrentUser }), [currentUser]);
  return (
    <CurrentUserContext.Provider value={value}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    throw new Error("useCurrentUser must be used within CurrentUserProvider");
  }
  return ctx.currentUser;
}

export function useSetCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    throw new Error(
      "useSetCurrentUser must be used within CurrentUserProvider",
    );
  }
  return ctx.setCurrentUser;
}
