"use client";

import { useEffect, useState } from "react";
import { Button, Input } from "@evcore/ui";
import type { AuthSession } from "@/domains/auth/types/auth";
import { clientApiRequest } from "@/lib/api/client-api";
import { SettingsSectionCard } from "./settings-section-card";

export function AccountProfileSection({
  labels,
}: {
  labels: {
    eyebrow: string;
    title: string;
    description: string;
    fullName: string;
    email: string;
    username: string;
    role: string;
    password: string;
    changePassword: string;
    changePasswordHint: string;
    loading: string;
    roles: {
      ADMIN: string;
      OPERATOR: string;
    };
  };
}) {
  const [user, setUser] = useState<AuthSession["user"] | null>(null);

  useEffect(() => {
    let active = true;

    void clientApiRequest<{ session: AuthSession }>("/auth/me")
      .then((payload) => {
        if (active) setUser(payload.session.user);
      })
      .catch(() => {
        if (active) setUser(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const roleValue = user ? labels.roles[user.role] : labels.loading;

  return (
    <SettingsSectionCard
      eyebrow={labels.eyebrow}
      title={labels.title}
      description={labels.description}
      className="lg:col-span-2"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {labels.fullName}
          </label>
          <Input value={user?.fullName ?? labels.loading} readOnly />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {labels.role}
          </label>
          <Input value={roleValue} readOnly />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {labels.email}
          </label>
          <Input value={user?.email ?? labels.loading} readOnly />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {labels.username}
          </label>
          <Input value={user ? `@${user.username}` : labels.loading} readOnly />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-border bg-background p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {labels.password}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {labels.changePasswordHint}
          </p>
        </div>
        <div>
          <Button type="button" variant="outline" disabled>
            {labels.changePassword}
          </Button>
        </div>
      </div>
    </SettingsSectionCard>
  );
}
