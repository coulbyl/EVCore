"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Input,
  Skeleton,
  Textarea,
} from "@evcore/ui";
import { Megaphone, Send, Trash2 } from "lucide-react";
import { useAdminAnnouncements } from "@/domains/announcements/use-cases/get-admin-announcements";
import { useCreateAdminAnnouncement } from "@/domains/announcements/use-cases/create-admin-announcement";
import { useDeleteAdminAnnouncement } from "@/domains/announcements/use-cases/delete-admin-announcement";
import { useUpdateAdminAnnouncement } from "@/domains/announcements/use-cases/update-admin-announcement";
import { formatDateTime } from "@/lib/date";

export function AnnouncementsAdminPageClient() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [href, setHref] = useState("/dashboard/formation");
  const announcementsQuery = useAdminAnnouncements();
  const createAnnouncement = useCreateAdminAnnouncement();
  const updateAnnouncement = useUpdateAdminAnnouncement();
  const deleteAnnouncement = useDeleteAdminAnnouncement();

  async function handleCreate() {
    if (!title.trim() || !href.trim()) return;
    await createAnnouncement.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      href: href.trim(),
      published: true,
    });
    setTitle("");
    setDescription("");
    setHref("/dashboard/formation");
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="shrink-0">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Annonces
        </p>
      </div>

      <section className="shrink-0 rounded-[1.6rem] border border-border bg-panel-strong p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de l'annonce"
            className="h-11 rounded-lg bg-background"
          />
          <Textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description courte (optionnelle)"
            className="rounded-lg bg-background"
          />
          <Input
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="/dashboard/formation"
            className="h-11 rounded-lg bg-background"
          />
          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={
              createAnnouncement.isPending || !title.trim() || !href.trim()
            }
            className="self-end rounded-xl"
          >
            <Send data-icon="inline-start" />
            {createAnnouncement.isPending ? "Création..." : "Créer l'annonce"}
          </Button>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <Megaphone size={16} className="text-accent" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Annonces existantes
          </h2>
        </div>

        {announcementsQuery.isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        ) : (announcementsQuery.data?.length ?? 0) === 0 ? (
          <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
            <EmptyHeader>
              <EmptyTitle>Aucune annonce</EmptyTitle>
              <EmptyDescription>
                Créez votre première annonce dashboard.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-3 pb-2">
              {(announcementsQuery.data ?? []).map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border bg-panel-strong p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {item.title}
                        </p>
                        <Badge variant={item.published ? "success" : "neutral"}>
                          {item.published ? "Publiée" : "Brouillon"}
                        </Badge>
                      </div>
                      {item.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Lien: {item.href}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Publication:{" "}
                        {item.publishedAt
                          ? formatDateTime(item.publishedAt)
                          : "Non publiée"}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        disabled={updateAnnouncement.isPending}
                        onClick={() =>
                          void updateAnnouncement.mutateAsync({
                            id: item.id,
                            published: !item.published,
                          })
                        }
                      >
                        {item.published ? "Dépublier" : "Publier"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl text-danger hover:text-destructive"
                        disabled={deleteAnnouncement.isPending}
                        onClick={() =>
                          void deleteAnnouncement.mutateAsync(item.id)
                        }
                      >
                        <Trash2 data-icon="inline-start" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
