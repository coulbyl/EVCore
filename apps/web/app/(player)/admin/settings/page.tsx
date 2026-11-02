import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { ChipGroup } from "@/components/scoreboard/ui/chip-group";
import type {
  AdminActionView,
  SettingView,
} from "@/domains/console/types/console";
import {
  getIntegrations,
  getJournal,
  getSettings,
} from "@/domains/console/use-cases/get-console";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import {
  displayLocaleOf,
  formatShortDate,
  formatTime,
} from "@/helpers/scoreboard-format";
import { AdminBand } from "../components/admin-band";
import { settleTargetOf } from "../components/console-constants";
import { SchedulingSwitch } from "./components/scheduling-switch";
import { SettingEditor } from "./components/setting-editor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("console");
  return {
    title: `${t("titles.settings")} — EVCore`,
    robots: { index: false },
  };
}

type Settings = Awaited<ReturnType<typeof getTranslations<"console.settings">>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The journal's filter by type (backend ADMIN_ACTION_GROUPS). */
const JOURNAL_GROUPS = [
  "settings",
  "operations",
  "accounts",
  "announcements",
] as const;

// Message keys cannot hold the dots of the setting keys.
const NAME_KEY: Record<string, string> = {
  "llm.providers": "llm",
  research: "research",
  "apiFootball.quotaAlertPct": "quota",
  "statsBackfill.dailyReserve": "reserve",
  "scheduling.enabled": "scheduling",
};

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** The value as Réglages writes it, and its line under the label. */
function shown(
  setting: SettingView,
  input: { t: Settings; number: (v: number) => string },
): { value: string; detail: string | null } {
  const { t, number } = input;
  const v = setting.value ?? setting.defaultValue;
  const r = recordOf(v);
  switch (setting.key) {
    case "llm.providers": {
      if (!r) return { value: t("fromEnv"), detail: t("fromEnvDetail") };
      const fallbacks = (r["fallbacks"] as string[] | undefined) ?? [];
      return {
        value: String(r["primary"]),
        detail:
          fallbacks.length > 0
            ? t("fallbacksOf", { list: fallbacks.join(", ") })
            : t("noFallback"),
      };
    }
    case "research": {
      if (!r) return { value: t("fromEnv"), detail: t("fromEnvDetail") };
      const codes = (r["competitionCodes"] as string[] | undefined) ?? [];
      return {
        value: r["enabled"] ? t("on") : t("off"),
        detail: t("researchDetail", {
          provider: String(r["provider"]),
          count: codes.length,
        }),
      };
    }
    case "apiFootball.quotaAlertPct":
      return {
        value: `${number(Number(v))} %`,
        detail: t("defaultPct", {
          value: number(Number(setting.defaultValue)),
        }),
      };
    case "statsBackfill.dailyReserve":
      return {
        value: number(Number(v)),
        detail: t("defaultCalls", {
          value: number(Number(setting.defaultValue)),
        }),
      };
    case "scheduling.enabled":
      return { value: v === false ? t("off") : t("on"), detail: null };
  }
}

/** One journal line in words: « Fournisseur LLM : together → cerebras ». */
function lineOf(
  item: AdminActionView,
  input: {
    t: Settings;
    passName: (key: string) => string;
    queueName: (key: string) => string;
  },
): string {
  const { t, passName, queueName } = input;
  const text = (v: unknown): string => {
    if (v === null || v === undefined) return t("fromEnv");
    if (typeof v === "boolean") return v ? t("on") : t("off");
    if (v === "ADMIN" || v === "OPERATOR") return t(`roles.${v}`);
    const r = recordOf(v);
    if (r && "primary" in r) return String(r["primary"]);
    if (r && "enabled" in r) return r["enabled"] ? t("on") : t("off");
    return String(v);
  };
  switch (item.kind) {
    case "setting":
      return t("journal.setting", {
        name: NAME_KEY[item.target]
          ? t(`names.${NAME_KEY[item.target]}`)
          : item.target,
        before: text(item.before),
        after: text(item.after),
      });
    case "market_reactivated":
      return t("journal.market_reactivated", {
        market: item.target,
        reason: item.reason ?? "",
      });
    case "role":
      return t("journal.role", {
        email: item.target,
        before: text(item.before),
        after: text(item.after),
      });
    case "suspension":
      return item.after === true
        ? t("journal.suspended", { email: item.target })
        : t("journal.unsuspended", { email: item.target });
    case "account_deleted":
      return t("journal.account_deleted", { email: item.target });
    case "announcement":
      return t("journal.announcement", { title: item.target });
    case "pass_relaunched":
      return t("journal.pass_relaunched", { pass: passName(item.target) });
    case "queue_retried":
    case "queue_cleared":
      return t(`journal.${item.kind}`, {
        queue: queueName(item.target),
        count: Number(item.after ?? 0),
      });
    case "integration_set":
    case "integration_cleared":
      return t(`journal.${item.kind}`, { field: item.target });
    case "announcement_withdrawn":
    case "announcement_deleted":
      return t(`journal.${item.kind}`, { title: item.target });
    case "backfill_paused":
    case "backfill_resumed":
      return t(`journal.${item.kind}`);
    case "settlement_replayed": {
      const r = recordOf(item.after);
      const range = settleTargetOf(item.target);
      return t("journal.settlement_replayed", {
        target: range
          ? t(`journal.settleRange.${range.kind}`, range)
          : item.target,
        replayed: Number(r?.["replayed"] ?? 0),
        corrected: Number(r?.["corrected"] ?? 0),
      });
    }
    default:
      return `${item.kind} · ${item.target}`;
  }
}

/**
 * Réglages (12-admin.md § 4, maquettes ReglagesMobile, Reglages): five
 * operator settings, their default and who changed them, then the one
 * journal of human actions, filterable by person. No secret shown or
 * typed; a change is taken into account at the next pass.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; group?: string }>;
}) {
  const params = await searchParams;
  // The journal's filter is an account id; anything else shows everyone.
  const actor = UUID.test(params.actor ?? "") ? params.actor : undefined;
  const group = JOURNAL_GROUPS.find((g) => g === params.group);
  const journalHref = (over: {
    actor?: string | null;
    group?: string | null;
  }) => {
    const q = new URLSearchParams();
    const a = over.actor === undefined ? actor : over.actor;
    const g = over.group === undefined ? group : over.group;
    if (a) q.set("actor", a);
    if (g) q.set("group", g);
    const s = q.toString();
    return s ? `/admin/settings?${s}` : "/admin/settings";
  };
  const [t, console, locale, timeZone, settings, journal, integrations] =
    await Promise.all([
      getTranslations("console.settings"),
      getTranslations("console"),
      getLocale(),
      getPlayerTimeZone(),
      getSettings(),
      getJournal(actor, group),
      getIntegrations().catch(() => null),
    ]);
  // The LLM providers whose key is stored in Intégrations (the worker's
  // .env is out of the backend's sight).
  const providersWithKey = (integrations?.items ?? [])
    .filter((i) =>
      i.fields.some((f) => f.key.endsWith(".apiKey") && f.source === "stored"),
    )
    .map((i) => i.key);
  const display = displayLocaleOf(locale);
  const intl = display === "en" ? "en-GB" : "fr-FR";
  const number = (v: number) => new Intl.NumberFormat(intl).format(v);
  const time = (iso: string) => formatTime(new Date(iso), display, timeZone);
  const day = (iso: string) =>
    formatShortDate(new Date(iso), display, timeZone);
  const queueName = (key: string) =>
    console.has(`exploitation.queues.${key}`)
      ? console(`exploitation.queues.${key}`)
      : key;
  const passName = (key: string) =>
    console.has(`passes.${key}`) ? console(`passes.${key}`) : key;
  const heading = "text-meta font-semibold text-muted-foreground";
  const editorLabels = {
    save: t("save"),
    cancel: t("cancel"),
    failed: t("failed"),
    saved: t("nextPass"),
    primary: t("primary"),
    fallbacks: t("fallbacks"),
    enabled: t("researchOn"),
    provider: t("provider"),
    competitions: t("competitions"),
    competitionsHint: t("competitionsHint"),
    keyStored: t("keyStored"),
    keyMissing: t("keyMissing"),
    providersWithKey,
  };

  return (
    <>
      <AdminBand current="settings" />
      <div className="flex flex-col gap-6 px-4 pt-3 pb-4 lg:px-6">
        <section className="flex flex-col gap-1" aria-label={t("title")}>
          <ul className="divide-y divide-border">
            {settings.map((s) => {
              const { value, detail } = shown(s, { t, number });
              const changed =
                s.updatedAt && s.updatedBy
                  ? t("changedBy", {
                      by: s.updatedBy,
                      date: day(s.updatedAt),
                    })
                  : null;
              const fullDetail = [detail, changed].filter(Boolean).join(" · ");
              return (
                <li key={s.key}>
                  {s.key === "scheduling.enabled" ? (
                    <SchedulingSwitch
                      on={s.value !== false}
                      label={t("names.scheduling")}
                      detail={[t("incidentOnly"), changed]
                        .filter(Boolean)
                        .join(" · ")}
                      labels={{
                        confirmTitle: t("cutTitle"),
                        confirmBody: t("cutBody"),
                        confirm: t("cut"),
                        cancel: t("cancel"),
                        failed: t("failed"),
                      }}
                    />
                  ) : (
                    <SettingEditor
                      setting={s}
                      label={t(`names.${NAME_KEY[s.key]}`)}
                      value={value}
                      detail={fullDetail || null}
                      labels={editorLabels}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-meta text-muted-foreground">{t("footnote")}</p>
        </section>

        <Link
          href="/admin/settings/integrations"
          className="flex min-h-14 items-center justify-between gap-3 border-y border-border py-2"
        >
          <span className="flex flex-col">
            <span className="text-body font-medium">
              {t("integrationsLink")}
            </span>
            <span className="text-meta text-muted-foreground">
              {t("integrationsHint")}
            </span>
          </span>
          <ChevronRight
            aria-hidden
            className="size-[1.125rem] shrink-0 text-icon-subtle"
          />
        </Link>

        <section
          aria-labelledby="journal-title"
          className="flex flex-col gap-2"
        >
          <h2 id="journal-title" className={heading}>
            {t("journalTitle")}
          </h2>
          <ChipGroup
            label={t("journalType")}
            items={[
              {
                key: "all",
                label: t("allTypes"),
                href: journalHref({ group: null }),
                active: !group,
              },
              ...JOURNAL_GROUPS.map((g) => ({
                key: g,
                label: t(`groups.${g}`),
                href: journalHref({ group: g }),
                active: g === group,
              })),
            ]}
          />
          {journal.actors.length > 1 ? (
            <ChipGroup
              label={t("journalBy")}
              items={[
                {
                  key: "all",
                  label: t("everyone"),
                  href: journalHref({ actor: null }),
                  active: !actor,
                },
                ...journal.actors.map((a) => ({
                  key: a.id,
                  label: a.name,
                  href: journalHref({ actor: a.id }),
                  active: a.id === actor,
                })),
              ]}
            />
          ) : null}
          {journal.items.length === 0 ? (
            <p className="text-body text-muted-foreground">
              {t("journalEmpty")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {journal.items.map((item) => (
                <li
                  key={item.id}
                  className="grid grid-cols-[3.5rem_1fr] items-baseline gap-x-3 py-2"
                >
                  <span className="score text-meta font-semibold text-muted-foreground">
                    {day(item.at)}
                  </span>
                  <span className="text-body">
                    <span className="font-semibold">{item.actor}</span>
                    {" · "}
                    {lineOf(item, { t, passName, queueName })}
                    <span className="ms-2 text-meta text-muted-foreground">
                      {time(item.at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
