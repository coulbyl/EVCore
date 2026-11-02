"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { FIELD, PRIMARY, QUIET } from "@/components/scoreboard/ui/form-looks";
import type {
  IntegrationTestResult,
  IntegrationView,
} from "@/domains/console/types/console";
import { playerFetch } from "@/lib/api/player-fetch";

export type IntegrationCardLabels = {
  name: string;
  fields: Record<string, string>;
  source: Record<"stored" | "env" | "none", string>;
  secretSet: string;
  unreadable: string;
  /** « changé par {by} le {date} », filled here. */
  setBy: string;
  edit: string;
  replace: string;
  save: string;
  cancel: string;
  clear: string;
  clearHint: string;
  test: string;
  testing: string;
  failed: string;
  noEncryption: string;
};

/**
 * One service of Réglages › Intégrations (on iddia's model): its fields, each
 * saying where the value serving comes from — stored here, the .env, or
 * nothing. An address shows; a secret never does, it is only replaced.
 * « Retirer » gives the .env back; « Tester la connexion » tries the
 * values serving now.
 */
export function IntegrationCard({
  integration,
  canEncrypt,
  dates,
  labels,
}: {
  integration: IntegrationView;
  canEncrypt: boolean;
  /** Each field's « changed on », already formatted. */
  dates: Record<string, string>;
  labels: IntegrationCardLabels;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [test, setTest] = useState<IntegrationTestResult | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setFailed(false);
    try {
      await action();
      setEditing(null);
      setValue("");
      setTest(null);
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function runTest() {
    setBusy(true);
    try {
      const result = await playerFetch<IntegrationTestResult>(
        `/console/integrations/${integration.key}/test`,
        { method: "POST" },
      );
      setTest(result ?? null);
    } catch {
      setTest({ ok: false, detail: labels.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby={`integration-${integration.key}`}
      className="flex flex-col rounded-[0.875rem] border border-border bg-card px-4 py-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          id={`integration-${integration.key}`}
          className="text-body font-semibold"
        >
          {labels.name}
        </h3>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runTest()}
          className="min-h-10 rounded-full border border-border px-3 text-meta font-medium hover:bg-muted disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {busy && !editing ? labels.testing : labels.test}
        </button>
      </div>
      {test ? (
        <p
          role="status"
          className={clsx("text-meta", test.ok ? "text-win" : "text-loss")}
        >
          {test.ok ? "✓" : "✗"} {test.detail}
        </p>
      ) : null}

      <ul className="mt-1 divide-y divide-border">
        {integration.fields.map((field) => {
          const open = editing === field.key;
          const label = labels.fields[field.key] ?? field.key;
          const blocked = field.secret && !canEncrypt;
          return (
            <li key={field.key} className="flex flex-col gap-1.5 py-2.5">
              <div className="flex items-start gap-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body font-medium">{label}</span>
                  <span className="break-all text-meta text-muted-foreground">
                    {field.secret
                      ? field.source === "none"
                        ? labels.source.none
                        : labels.secretSet
                      : (field.value ?? labels.source.none)}
                  </span>
                  <span className="text-legal text-muted-foreground">
                    {[
                      labels.source[field.source],
                      field.unreadable ? labels.unreadable : null,
                      field.source === "stored" && field.updatedBy
                        ? labels.setBy
                            .replace("{by}", field.updatedBy)
                            .replace("{date}", dates[field.key] ?? "")
                        : null,
                      field.env,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {!open ? (
                  <button
                    type="button"
                    disabled={busy || blocked}
                    title={blocked ? labels.noEncryption : undefined}
                    onClick={() => {
                      setEditing(field.key);
                      setValue(field.secret ? "" : (field.value ?? ""));
                    }}
                    className="min-h-10 shrink-0 rounded-full border border-border px-3 text-meta font-medium hover:bg-muted disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {field.secret && field.source !== "none"
                      ? labels.replace
                      : labels.edit}
                  </button>
                ) : null}
              </div>
              {open ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(() =>
                      playerFetch(`/console/integrations/${field.key}`, {
                        method: "PUT",
                        body: { value },
                      }),
                    );
                  }}
                  className="flex flex-col gap-2"
                >
                  <input
                    aria-label={label}
                    type={field.secret ? "password" : "text"}
                    autoComplete="off"
                    spellCheck={false}
                    required
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className={FIELD}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={busy}
                      className={`${PRIMARY} flex-1`}
                    >
                      {labels.save}
                    </button>
                    {field.source === "stored" ? (
                      <button
                        type="button"
                        disabled={busy}
                        title={labels.clearHint}
                        onClick={() =>
                          void run(() =>
                            playerFetch(`/console/integrations/${field.key}`, {
                              method: "DELETE",
                            }),
                          )
                        }
                        className="min-h-12 rounded-[0.625rem] border border-border px-4 text-bet font-medium text-loss"
                      >
                        {labels.clear}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className={QUIET}
                    >
                      {labels.cancel}
                    </button>
                  </div>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
      {failed ? (
        <p role="alert" className="text-meta text-loss">
          {labels.failed}
        </p>
      ) : null}
    </section>
  );
}
