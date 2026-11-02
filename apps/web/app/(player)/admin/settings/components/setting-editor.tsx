"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { LLM_PROVIDERS, RESEARCH_PROVIDERS } from "@evcore/analysis-core";
import { FIELD, PRIMARY, QUIET } from "@/components/scoreboard/ui/form-looks";
import type { SettingView } from "@/domains/console/types/console";
import { playerFetch } from "@/lib/api/player-fetch";

export type SettingEditorLabels = {
  save: string;
  cancel: string;
  failed: string;
  saved: string;
  primary: string;
  fallbacks: string;
  enabled: string;
  provider: string;
  competitions: string;
  competitionsHint: string;
  /** « clé enregistrée » next to a provider whose key is in Intégrations. */
  keyStored: string;
  /** « pas de clé enregistrée »: may still be in the worker's .env. */
  keyMissing: string;
  /** The LLM providers whose key is stored in Réglages › Intégrations. */
  providersWithKey: readonly string[];
};

/** The value being edited, before it is sent: the server parses it again. */
type Draft = {
  primary: string;
  fallbacks: string[];
  enabled: boolean;
  provider: string;
  codes: string;
  number: string;
};

function draftOf(setting: SettingView): Draft {
  const v = (setting.value ?? setting.defaultValue) as Record<
    string,
    unknown
  > | null;
  const n = setting.value ?? setting.defaultValue;
  return {
    primary: typeof v?.["primary"] === "string" ? v["primary"] : "groq",
    fallbacks: Array.isArray(v?.["fallbacks"])
      ? (v["fallbacks"] as string[])
      : [],
    enabled: v?.["enabled"] === true,
    provider: typeof v?.["provider"] === "string" ? v["provider"] : "groq",
    codes: Array.isArray(v?.["competitionCodes"])
      ? (v["competitionCodes"] as string[]).join(", ")
      : "",
    number: typeof n === "number" ? String(n) : "",
  };
}

function valueOf(key: SettingView["key"], draft: Draft): unknown {
  switch (key) {
    case "llm.providers":
      return {
        primary: draft.primary,
        fallbacks: draft.fallbacks.filter((f) => f !== draft.primary),
      };
    case "research": {
      const codes = draft.codes
        .split(/[\s,;]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
      return {
        enabled: draft.enabled,
        provider: draft.provider,
        ...(codes.length > 0 && { competitionCodes: codes }),
      };
    }
    case "apiFootball.quotaAlertPct":
    case "statsBackfill.dailyReserve":
      return Number(draft.number);
    case "scheduling.enabled":
      return draft.enabled;
  }
}

/**
 * A Réglages row (12-admin.md § 4): the label, the value, and at the
 * touch a native popover with the form for that one setting. Never a
 * secret; the server validates with the parser the passes read with.
 */
export function SettingEditor({
  setting,
  label,
  value,
  detail,
  labels,
}: {
  setting: SettingView;
  label: string;
  value: string;
  detail: string | null;
  labels: SettingEditorLabels;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => draftOf(setting));
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const popover = `setting-${setting.key.replace(/\W/g, "-")}`;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setState("busy");
    try {
      await playerFetch(`/console/settings/${setting.key}`, {
        method: "PUT",
        body: { value: valueOf(setting.key, draft) },
      });
      setState("idle");
      form.closest<HTMLElement>("[popover]")?.hidePopover();
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  const toggle = (list: string[], item: string) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  return (
    <>
      <button
        type="button"
        popoverTarget={popover}
        className="flex min-h-13 w-full items-center gap-3 py-2 text-start focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body font-medium">{label}</span>
          {detail ? (
            <span className="text-meta text-muted-foreground">{detail}</span>
          ) : null}
        </span>
        <span className="score text-bet font-semibold">{value}</span>
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-icon-subtle"
          strokeWidth={2}
        />
      </button>
      <div
        id={popover}
        popover="auto"
        role="dialog"
        aria-label={label}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-[0.875rem] border border-border bg-card p-4 text-card-foreground shadow-lg backdrop:bg-black/40"
      >
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-3">
          <p className="text-bet font-semibold">{label}</p>

          {setting.key === "llm.providers" ? (
            <>
              <fieldset className="flex flex-col gap-1">
                <legend className="text-meta text-muted-foreground">
                  {labels.primary}
                </legend>
                <div className="flex flex-wrap gap-x-4">
                  {LLM_PROVIDERS.map((p) => (
                    <label key={p} className="flex min-h-11 items-center gap-2">
                      <input
                        type="radio"
                        name="primary"
                        checked={draft.primary === p}
                        onChange={() => setDraft({ ...draft, primary: p })}
                        className="size-4 accent-primary"
                      />
                      <span>
                        {p}
                        <span className="ms-1.5 text-legal text-muted-foreground">
                          {labels.providersWithKey.includes(p)
                            ? labels.keyStored
                            : labels.keyMissing}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="flex flex-col gap-1">
                <legend className="text-meta text-muted-foreground">
                  {labels.fallbacks}
                </legend>
                <div className="flex flex-wrap gap-x-4">
                  {LLM_PROVIDERS.filter((p) => p !== draft.primary).map((p) => (
                    <label key={p} className="flex min-h-11 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={draft.fallbacks.includes(p)}
                        onChange={() =>
                          setDraft({
                            ...draft,
                            fallbacks: toggle(draft.fallbacks, p),
                          })
                        }
                        className="size-4 accent-primary"
                      />
                      <span>
                        {p}
                        <span className="ms-1.5 text-legal text-muted-foreground">
                          {labels.providersWithKey.includes(p)
                            ? labels.keyStored
                            : labels.keyMissing}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          ) : null}

          {setting.key === "research" ? (
            <>
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) =>
                    setDraft({ ...draft, enabled: e.target.checked })
                  }
                  className="size-4 accent-primary"
                />
                {labels.enabled}
              </label>
              <fieldset className="flex flex-col gap-1">
                <legend className="text-meta text-muted-foreground">
                  {labels.provider}
                </legend>
                <div className="flex flex-wrap gap-x-4">
                  {RESEARCH_PROVIDERS.map((p) => (
                    <label key={p} className="flex min-h-11 items-center gap-2">
                      <input
                        type="radio"
                        name="provider"
                        checked={draft.provider === p}
                        onChange={() => setDraft({ ...draft, provider: p })}
                        className="size-4 accent-primary"
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex flex-col gap-1 text-meta text-muted-foreground">
                {labels.competitions}
                <input
                  value={draft.codes}
                  onChange={(e) =>
                    setDraft({ ...draft, codes: e.target.value })
                  }
                  placeholder="PL, LL, BL1"
                  autoCapitalize="characters"
                  className={FIELD}
                />
                <span>{labels.competitionsHint}</span>
              </label>
            </>
          ) : null}

          {setting.key === "apiFootball.quotaAlertPct" ||
          setting.key === "statsBackfill.dailyReserve" ? (
            <label className="flex flex-col gap-1 text-meta text-muted-foreground">
              {detail}
              <input
                type="number"
                inputMode="numeric"
                required
                min={setting.key === "apiFootball.quotaAlertPct" ? 1 : 0}
                max={
                  setting.key === "apiFootball.quotaAlertPct" ? 100 : undefined
                }
                step={1}
                value={draft.number}
                onChange={(e) => setDraft({ ...draft, number: e.target.value })}
                className={FIELD}
              />
            </label>
          ) : null}

          <p className="text-meta text-muted-foreground">{labels.saved}</p>
          {state === "failed" ? (
            <p role="alert" className="text-meta text-loss">
              {labels.failed}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={state === "busy"}
              className={`${PRIMARY} flex-1`}
            >
              {labels.save}
            </button>
            <button
              type="button"
              popoverTarget={popover}
              popoverTargetAction="hide"
              className={QUIET}
            >
              {labels.cancel}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
