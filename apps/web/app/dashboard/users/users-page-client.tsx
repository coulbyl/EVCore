"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  DataTable,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Input,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
  type ColumnDef,
} from "@evcore/ui";
import { useTranslations } from "next-intl";
import { UserAvatar } from "@/components/user-avatar";
import type {
  AdminUserRow,
  AdminUserRole,
} from "@/domains/admin-users/types/admin-users";
import { useAdminUsers } from "@/domains/admin-users/use-cases/get-admin-users";
import { useUpdateAdminUser } from "@/domains/admin-users/use-cases/update-admin-user";

function roleLabel(role: AdminUserRole) {
  return role === "ADMIN" ? "Admin" : "Utilisateur";
}

export function UsersPageClient() {
  const tCommon = useTranslations("common");
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"ALL" | AdminUserRole>("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const query = useMemo(
    () => ({ q: q.trim() || undefined, role, page, pageSize }),
    [q, role, page],
  );

  const usersQuery = useAdminUsers(query);
  const updateUser = useUpdateAdminUser();

  const columns = useMemo<ColumnDef<AdminUserRow>[]>(() => {
    return [
      {
        id: "user",
        header: "Utilisateur",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar
              avatarUrl={row.original.avatarUrl}
              username={row.original.fullName}
              size={32}
              className="ring-1 ring-border"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {row.original.fullName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                @{row.original.username} · {row.original.email}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "role",
        header: "Rôle",
        cell: ({ row }) => (
          <Select
            value={row.original.role}
            onValueChange={(value) => {
              void updateUser.mutateAsync({
                userId: row.original.id,
                role: value as AdminUserRole,
              });
            }}
          >
            <SelectTrigger className="h-9 w-[160px] rounded-lg bg-panel-strong">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OPERATOR">{roleLabel("OPERATOR")}</SelectItem>
              <SelectItem value="ADMIN">{roleLabel("ADMIN")}</SelectItem>
            </SelectContent>
          </Select>
        ),
      },
      {
        id: "verified",
        header: "Email",
        cell: ({ row }) => (
          <Badge variant={row.original.emailVerified ? "success" : "neutral"}>
            {row.original.emailVerified ? "Vérifié" : "À vérifier"}
          </Badge>
        ),
      },
      {
        id: "createdAt",
        header: "Créé le",
        accessorFn: (row) =>
          new Date(row.createdAt).toLocaleDateString("fr-FR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }),
      },
    ];
  }, [updateUser]);

  const total = usersQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Administration
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            Utilisateurs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recherchez un compte et ajustez son rôle.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher (nom, email, identifiant)…"
            className="h-10 rounded-lg bg-panel"
          />
          <Select
            value={role}
            onValueChange={(v) => {
              setRole(v as typeof role);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-[180px] rounded-lg bg-panel">
              <SelectValue placeholder="Tous les rôles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les rôles</SelectItem>
              <SelectItem value="OPERATOR">{roleLabel("OPERATOR")}</SelectItem>
              <SelectItem value="ADMIN">{roleLabel("ADMIN")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <DataTable
          columns={columns}
          data={usersQuery.data?.items ?? []}
          isLoading={usersQuery.isLoading}
          className="overflow-visible"
          emptyState={
            <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
              <EmptyHeader>
                <EmptyTitle>{tCommon("empty")}</EmptyTitle>
                <EmptyDescription>Aucun utilisateur trouvé.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          }
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          Page {page} / {pageCount} · {total} utilisateur{total > 1 ? "s" : ""}
        </span>
        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                text="Précédent"
                className={cn(page <= 1 && "pointer-events-none opacity-50")}
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.max(1, p - 1));
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                text="Suivant"
                className={cn(
                  page >= pageCount && "pointer-events-none opacity-50",
                )}
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.min(pageCount, p + 1));
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
