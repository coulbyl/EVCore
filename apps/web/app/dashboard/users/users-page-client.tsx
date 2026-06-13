"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Badge,
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Input,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
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
import {
  Check,
  Copy,
  Link2,
  MoreHorizontal,
  ShieldCheck,
  UserX,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { UserAvatar } from "@/components/user-avatar";
import type {
  AdminUserRow,
  AdminUserRole,
} from "@/domains/admin-users/types/admin-users";
import { useAdminUsers } from "@/domains/admin-users/use-cases/get-admin-users";
import { useUpdateAdminUser } from "@/domains/admin-users/use-cases/update-admin-user";
import { generateAdminResetLink } from "@/domains/admin-users/use-cases/generate-reset-link";

function roleLabel(role: AdminUserRole) {
  return role === "ADMIN" ? "Admin" : "Utilisateur";
}

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function UserActions({
  user,
  onRoleChange,
}: {
  user: AdminUserRow;
  onRoleChange: (role: AdminUserRole) => void;
}) {
  const [copyState, setCopyState] = useState<
    "idle" | "loading" | "copied" | "error"
  >("idle");

  async function handleCopyResetLink() {
    setCopyState("loading");
    try {
      const url = await generateAdminResetLink(user.id);
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 3000);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  const nextRole: AdminUserRole = user.role === "ADMIN" ? "OPERATOR" : "ADMIN";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <MoreHorizontal size={16} />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {user.fullName}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onRoleChange(nextRole)}>
          <ShieldCheck size={14} className="mr-2 text-accent" />
          Passer en {roleLabel(nextRole)}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleCopyResetLink}
          disabled={copyState === "loading"}
        >
          {copyState === "copied" ? (
            <Check size={14} className="mr-2 text-success" />
          ) : copyState === "error" ? (
            <Link2 size={14} className="mr-2 text-destructive" />
          ) : (
            <Copy size={14} className="mr-2" />
          )}
          {copyState === "copied"
            ? "Lien copié"
            : copyState === "error"
              ? "Erreur"
              : copyState === "loading"
                ? "Génération…"
                : "Copier le lien reset"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-muted-foreground focus:text-muted-foreground"
          disabled
        >
          <UserX size={14} className="mr-2" />
          Suspendre (bientôt)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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

  const handleRoleChange = useCallback(
    (userId: string, nextRole: AdminUserRole) => {
      void updateUser.mutateAsync({ userId, role: nextRole });
    },
    [updateUser],
  );

  const columns = useMemo<ColumnDef<AdminUserRow>[]>(() => {
    return [
      {
        id: "user",
        header: "Utilisateur",
        accessorFn: (row) => [row.fullName, row.username, row.email].join(" "),
        enableSorting: true,
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
        accessorFn: (row) => roleLabel(row.role),
        enableSorting: true,
        cell: ({ row }) => (
          <Badge
            variant={row.original.role === "ADMIN" ? "neutral" : "secondary"}
          >
            {roleLabel(row.original.role)}
          </Badge>
        ),
      },
      {
        id: "verified",
        header: "Email",
        accessorFn: (row) => (row.emailVerified ? 1 : 0),
        enableSorting: true,
        cell: ({ row }) => (
          <Badge variant={row.original.emailVerified ? "success" : "neutral"}>
            {row.original.emailVerified ? "Vérifié" : "À vérifier"}
          </Badge>
        ),
      },
      {
        id: "createdAt",
        header: "Créé le",
        accessorFn: (row) => row.createdAt,
        sortingFn: "datetime",
        enableSorting: true,
        cell: ({ row }) => formatCreatedAt(row.original.createdAt),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <UserActions
              user={row.original}
              onRoleChange={(nextRole) =>
                handleRoleChange(row.original.id, nextRole)
              }
            />
          </div>
        ),
      },
    ];
  }, [handleRoleChange]);

  const total = usersQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader>
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Administration
          </p>
          <PageHeaderTitle className="mt-1 text-xl font-semibold tracking-tight">
            Utilisateurs
          </PageHeaderTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {total > 0
              ? `${total} compte${total > 1 ? "s" : ""} enregistré${total > 1 ? "s" : ""}`
              : "Recherchez un compte et ajustez son rôle."}
          </p>
        </div>

        <PageHeaderActions className="w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Nom, email, identifiant…"
            className="h-10 rounded-2xl bg-panel"
          />
          <Select
            value={role}
            onValueChange={(v) => {
              setRole(v as typeof role);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-2xl bg-panel sm:w-[160px]">
              <SelectValue placeholder="Tous les rôles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les rôles</SelectItem>
              <SelectItem value="OPERATOR">{roleLabel("OPERATOR")}</SelectItem>
              <SelectItem value="ADMIN">{roleLabel("ADMIN")}</SelectItem>
            </SelectContent>
          </Select>
        </PageHeaderActions>
      </PageHeader>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DataTable
          columns={columns}
          data={usersQuery.data?.items ?? []}
          isLoading={usersQuery.isLoading}
          className="overflow-visible"
          mobileCard={(user) => (
            <div className="rounded-2xl border border-border bg-panel-strong p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar
                    avatarUrl={user.avatarUrl}
                    username={user.fullName}
                    size={40}
                    className="ring-1 ring-border"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {user.fullName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{user.username}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </div>
                <UserActions
                  user={user}
                  onRoleChange={(nextRole) =>
                    handleRoleChange(user.id, nextRole)
                  }
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge
                  variant={user.role === "ADMIN" ? "neutral" : "secondary"}
                >
                  {roleLabel(user.role)}
                </Badge>
                <Badge variant={user.emailVerified ? "success" : "neutral"}>
                  {user.emailVerified ? "Vérifié" : "À vérifier"}
                </Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatCreatedAt(user.createdAt)}
                </span>
              </div>
            </div>
          )}
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

      {/* Pagination */}
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
