"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle, ClipboardCheck, Loader2, X } from "lucide-react";
import { declareFixtureResult } from "../lib/dashboard-api";

type State = "idle" | "loading" | "success" | "error";

function ScoreInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500"
      >
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-slate-50 px-3 py-2 text-center text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
    </div>
  );
}

export function SettleFixtureDialog({
  fixtureId,
  fixtureName,
  onSettled,
}: {
  fixtureId: string;
  fixtureName: string;
  onSettled?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [homeHt, setHomeHt] = useState("");
  const [awayHt, setAwayHt] = useState("");

  function reset() {
    setState("idle");
    setError("");
    setHomeScore("");
    setAwayScore("");
    setHomeHt("");
    setAwayHt("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (homeScore === "" || awayScore === "") return;

    setState("loading");
    setError("");

    try {
      await declareFixtureResult(fixtureId, {
        homeScore: Number(homeScore),
        awayScore: Number(awayScore),
        ...(homeHt !== "" && awayHt !== ""
          ? { homeHtScore: Number(homeHt), awayHtScore: Number(awayHt) }
          : {}),
      });
      setState("success");
      onSettled?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setState("error");
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-xl border border-border bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus:outline-none"
        >
          <ClipboardCheck size={13} />
          Déclarer résultat
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[1.6rem] border border-border bg-white p-6 shadow-xl focus:outline-none">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-900">
                Déclarer un résultat
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-slate-500">
                {fixtureName}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {state === "success" ? (
            <div className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle size={36} className="text-success" />
              <p className="font-semibold text-slate-800">
                Résultat enregistré
              </p>
              <p className="text-sm text-slate-500">
                Les bets ont été settlés et la calibration lancée.
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Fermer
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="mt-5">
              <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Score final
              </p>
              <div className="grid grid-cols-2 gap-3">
                <ScoreInput
                  id="homeScore"
                  label="Domicile"
                  value={homeScore}
                  onChange={setHomeScore}
                />
                <ScoreInput
                  id="awayScore"
                  label="Extérieur"
                  value={awayScore}
                  onChange={setAwayScore}
                />
              </div>

              <p className="mb-3 mt-5 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Score mi-temps{" "}
                <span className="font-normal normal-case tracking-normal text-slate-400">
                  (optionnel)
                </span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <ScoreInput
                  id="homeHt"
                  label="Domicile MT"
                  value={homeHt}
                  onChange={setHomeHt}
                />
                <ScoreInput
                  id="awayHt"
                  label="Extérieur MT"
                  value={awayHt}
                  onChange={setAwayHt}
                />
              </div>

              {state === "error" && (
                <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  state === "loading" || homeScore === "" || awayScore === ""
                }
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {state === "loading" && <Loader2 size={14} className="animate-spin" />}
                Enregistrer et settler
              </button>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
