"use client";

import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Badge,
  Button,
  Drawer,
  DrawerContent,
  DrawerTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Skeleton,
} from "@evcore/ui";
import { Megaphone, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { useAdminAnnouncements } from "@/domains/announcements/use-cases/get-admin-announcements";
import { useCreateAdminAnnouncement } from "@/domains/announcements/use-cases/create-admin-announcement";
import { useDeleteAdminAnnouncement } from "@/domains/announcements/use-cases/delete-admin-announcement";
import { useUpdateAdminAnnouncement } from "@/domains/announcements/use-cases/update-admin-announcement";
import type { Announcement } from "@/domains/announcements/types/announcements";
import { formatDateTime } from "@/lib/date";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useIsMobile } from "@/hooks/use-mobile";

const formSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Le titre est requis.")
    .max(120, "120 caractères max."),
  description: z
    .string()
    .refine(
      (v) => v.replace(/<[^>]*>/g, "").trim() !== "",
      "Le contenu est requis.",
    ),
  href: z.string().max(500, "500 caractères max.").optional(),
  expiresAt: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function plainTextExcerpt(html: string, maxLen = 120): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AnnouncementsAdminPageClient() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const isMobile = useIsMobile();

  const announcementsQuery = useAdminAnnouncements();
  const createAnnouncement = useCreateAdminAnnouncement();
  const updateAnnouncement = useUpdateAdminAnnouncement();
  const deleteAnnouncement = useDeleteAdminAnnouncement();

  const isEditing = editingItem !== null;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", href: "", expiresAt: "" },
    mode: "onTouched",
  });

  function openCreate() {
    setEditingItem(null);
    form.reset({ title: "", description: "", href: "", expiresAt: "" });
    setEditorKey((k) => k + 1);
    setDrawerOpen(true);
  }

  function openEdit(item: Announcement) {
    setEditingItem(item);
    form.reset({
      title: item.title,
      description: item.description,
      href: item.href ?? "",
      expiresAt: item.expiresAt ? toDatetimeLocal(item.expiresAt) : "",
    });
    setEditorKey((k) => k + 1);
    setDrawerOpen(true);
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      form.reset();
      setEditorKey((k) => k + 1);
      setEditingItem(null);
    }
    setDrawerOpen(open);
  }

  async function onSubmit(values: FormValues) {
    const href = values.href?.trim() || undefined;
    const expiresAt = values.expiresAt
      ? new Date(values.expiresAt).toISOString()
      : undefined;

    if (isEditing) {
      await updateAnnouncement.mutateAsync({
        id: editingItem.id,
        title: values.title,
        description: values.description,
        href,
        expiresAt,
      });
    } else {
      await createAnnouncement.mutateAsync({
        title: values.title,
        description: values.description,
        href,
        published: true,
        expiresAt,
      });
    }

    form.reset();
    setEditorKey((k) => k + 1);
    setEditingItem(null);
    setDrawerOpen(false);
  }

  const isPending = isEditing
    ? updateAnnouncement.isPending
    : createAnnouncement.isPending;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Administration
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            Annonces
          </h1>
          {(announcementsQuery.data?.length ?? 0) > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {announcementsQuery.data?.length} annonce
              {(announcementsQuery.data?.length ?? 0) > 1 ? "s" : ""} ·{" "}
              {announcementsQuery.data?.filter((a) => a.published).length}{" "}
              publiée
              {(announcementsQuery.data?.filter((a) => a.published).length ??
                0) > 1
                ? "s"
                : ""}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          className="shrink-0 rounded-2xl"
          onClick={openCreate}
        >
          <Plus data-icon="inline-start" />
          <span className="hidden sm:inline">Nouvelle annonce</span>
          <span className="sm:hidden">Nouvelle</span>
        </Button>
      </div>

      <section className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
          <Megaphone size={14} className="text-accent" />
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em]">
            Existantes
          </p>
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
                      <p className="mt-1 text-sm text-muted-foreground">
                        {plainTextExcerpt(item.description)}
                      </p>
                      {item.href ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Lien: {item.href}
                        </p>
                      ) : null}
                      {item.expiresAt ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Expire: {formatDateTime(item.expiresAt)}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Publication:{" "}
                        {item.publishedAt
                          ? formatDateTime(item.publishedAt)
                          : "Non publiée"}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil data-icon="inline-start" />
                        Modifier
                      </Button>
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

      <Drawer
        open={drawerOpen}
        onOpenChange={handleOpenChange}
        direction={isMobile ? "bottom" : "right"}
      >
        <DrawerContent
          className={
            isMobile
              ? "z-50 flex h-[92dvh] min-h-0 flex-col rounded-t-[1.5rem] border-t border-border bg-panel outline-none"
              : "z-50 inset-y-4 right-4 flex h-[calc(100dvh-2rem)] w-[480px] flex-col rounded-[1.5rem] border border-border bg-panel shadow-[0_24px_80px_rgba(15,23,42,0.18)] outline-none"
          }
        >
          <DrawerTitle className="sr-only">
            {isEditing ? "Modifier l'annonce" : "Nouvelle annonce"}
          </DrawerTitle>

          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Megaphone size={16} className="text-accent" />
              <h2 className="text-sm font-semibold text-foreground">
                {isEditing ? "Modifier l'annonce" : "Nouvelle annonce"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>

          {/* Form */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <Form {...form}>
              <form
                id="announcement-form"
                className="flex flex-col gap-4"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titre</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Titre de l'annonce"
                          className="h-11 rounded-lg bg-background"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contenu</FormLabel>
                      <FormControl>
                        <RichTextEditor
                          key={editorKey}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Contenu de l'annonce…"
                          className="bg-background"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="href"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Lien{" "}
                        <span className="text-muted-foreground">
                          (optionnel)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="/dashboard/formation"
                          className="h-11 rounded-lg bg-background"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expiresAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Expiration{" "}
                        <span className="text-muted-foreground">
                          (optionnelle)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          className="ev-date-input h-11 rounded-lg bg-background"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-border bg-panel-strong px-5 py-4">
            <Button
              type="submit"
              form="announcement-form"
              disabled={isPending}
              className="w-full rounded-xl"
            >
              <Send data-icon="inline-start" />
              {isEditing
                ? isPending
                  ? "Sauvegarde..."
                  : "Sauvegarder les modifications"
                : isPending
                  ? "Création..."
                  : "Créer l'annonce"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
