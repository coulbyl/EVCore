"use client";

import { useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@evcore/ui";
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  Info,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  useActivateModel,
  useMlModels,
  useMlTrainingJobStatus,
  useRollbackModel,
  useTriggerBackfill,
  useTriggerTraining,
} from "@/domains/ml/use-cases/use-ml";
import type { MlModelVersion } from "@/domains/ml/types/ml";

const ML_SEGMENTS = [
  "ALL",
  "EV:ONE_X_TWO",
  "EV:OVER_UNDER",
  "EV:BTTS",
  "CONF:ONE_X_TWO",
  "DRAW:ONE_X_TWO",
  "BTTS:BTTS",
] as const;

function fmt(n: number | undefined, decimals = 3) {
  return n === undefined ? "—" : n.toFixed(decimals);
}

function fmtPct(n: number | undefined) {
  return n === undefined ? "—" : `${(n * 100).toFixed(1)}%`;
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[1.1rem] border border-border bg-panel px-4 py-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
      {hint && <p className="text-[0.65rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function BackfillSection() {
  const trigger = useTriggerBackfill();
  const [result, setResult] = useState<{
    queued: number;
    seasonIds: string[];
  } | null>(null);

  async function handleBackfill() {
    const r = await trigger.mutateAsync();
    setResult(r);
  }

  return (
    <section className="bento-cell flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-secondary text-accent">
          <Database size={16} />
        </span>
        <div>
          <p className="font-semibold text-foreground">Backfill historique</p>
          <p className="text-xs text-muted-foreground">
            Génère des ModelRun pour toutes les fixtures FINISHED sans analyse
            existante. À lancer une seule fois avant le premier entraînement ML.
          </p>
        </div>
      </div>

      {result ? (
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/8 px-4 py-3 text-sm text-success">
          <CheckCircle2 size={15} />
          <span>
            {result.queued} saison{result.queued > 1 ? "s" : ""} en file — les
            jobs tournent en arrière-plan.
          </span>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={handleBackfill}
          disabled={trigger.isPending}
          className="self-start"
        >
          {trigger.isPending ? (
            "Mise en file…"
          ) : (
            <>
              <Play size={14} />
              Lancer le backfill
            </>
          )}
        </Button>
      )}
    </section>
  );
}

function TrainingSection() {
  const [segment, setSegment] = useState<(typeof ML_SEGMENTS)[number]>("ALL");
  const trigger = useTriggerTraining(segment);
  const [jobId, setJobId] = useState<string | null>(null);
  const { data: jobStatus } = useMlTrainingJobStatus(jobId);

  async function handleTrain() {
    const r = await trigger.mutateAsync();
    setJobId(r.jobId);
  }

  return (
    <section className="bento-cell flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-secondary text-accent">
          <Sparkles size={16} />
        </span>
        <div>
          <p className="font-semibold text-foreground">Entraîner un modèle</p>
          <p className="text-xs text-muted-foreground">
            Lance la régression logistique sur le segment sélectionné. Le modèle
            sera disponible dans la liste ci-dessous.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={segment}
          onValueChange={(value) =>
            setSegment(value as (typeof ML_SEGMENTS)[number])
          }
        >
          <SelectTrigger className="h-10 w-full rounded-xl bg-panel sm:w-[220px]">
            <SelectValue placeholder="Segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {ML_SEGMENTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={handleTrain}
          disabled={trigger.isPending}
        >
          {trigger.isPending ? (
            "En cours…"
          ) : (
            <>
              <BrainCircuit size={14} />
              Entraîner
            </>
          )}
        </Button>
      </div>

      {jobId && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Job déclenché — id : <code className="font-mono">{jobId}</code>
            </span>
            {jobStatus?.state && (
              <Badge
                variant={
                  jobStatus.state === "failed"
                    ? "destructive"
                    : jobStatus.state === "completed"
                      ? "success"
                      : "neutral"
                }
                className="text-[0.6rem]"
              >
                {jobStatus.state}
              </Badge>
            )}
          </div>
          {jobStatus?.state === "failed" && jobStatus.failedReason && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Entraînement échoué</AlertTitle>
              <AlertDescription>{jobStatus.failedReason}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </section>
  );
}

function ModelRow({
  model,
  onActivate,
  isActivating,
  onRollback,
  isRollingBack,
}: {
  model: MlModelVersion;
  onActivate: (id: string) => void;
  isActivating: boolean;
  onRollback: (id: string) => void;
  isRollingBack: boolean;
}) {
  const [open, setOpen] = useState(false);
  const m = model.metrics;

  return (
    <div className="flex flex-col gap-0 rounded-[1.1rem] border border-border bg-panel">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {model.isActive && (
              <Badge variant="success" className="text-[0.6rem]">
                Actif
              </Badge>
            )}
            <span className="font-mono text-xs font-semibold text-foreground">
              {model.segment}
            </span>
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[0.6rem] text-muted-foreground">
              {model.algorithm}
            </span>
          </div>
          <p className="text-[0.68rem] text-muted-foreground">
            {new Date(model.createdAt).toLocaleString("fr-FR")}
            {model.activatedAt && (
              <span className="ml-1 opacity-60">
                · activé {new Date(model.activatedAt).toLocaleString("fr-FR")}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-3 divide-x divide-border border-t border-border text-xs">
        <div className="flex flex-col items-center gap-0.5 py-2.5">
          <p className="tabular-nums font-semibold text-foreground">
            {fmt(m?.brierScore)}
          </p>
          <p className="text-muted-foreground">Brier</p>
        </div>
        <div className="flex flex-col items-center gap-0.5 py-2.5">
          <p className="tabular-nums font-semibold text-foreground">
            {fmtPct(m?.roiShadow)}
          </p>
          <p className="text-muted-foreground">ROI simulé</p>
        </div>
        <div className="flex flex-col items-center gap-0.5 py-2.5">
          <p className="tabular-nums font-semibold text-foreground">
            {m?.sampleSize ?? "—"}
          </p>
          <p className="text-muted-foreground">Samples</p>
        </div>
      </div>

      {/* Action */}
      <div className="border-t border-border px-4 py-3">
          {model.isActive ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRollback(model.id)}
              disabled={isRollingBack}
            >
              <RotateCcw size={12} data-icon="inline-start" />
              Rollback version précédente
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onActivate(model.id)}
              disabled={isActivating}
            >
              <RotateCcw size={12} data-icon="inline-start" />
              Activer
            </Button>
          )}
      </div>

      {/* Expanded detail */}
      {open && m && (
        <div className="grid grid-cols-3 gap-2 border-t border-border p-4 sm:grid-cols-6">
          <MetricCard label="Brier" value={fmt(m.brierScore)} />
          <MetricCard label="Cal. Err" value={fmtPct(m.calibrationError)} />
          <MetricCard label="ROI shadow" value={fmtPct(m.roiShadow)} />
          <MetricCard label="Samples" value={String(m.sampleSize)} />
          <MetricCard label="Train" value={String(m.trainSize)} />
          <MetricCard label="Test" value={String(m.testSize)} />
        </div>
      )}
    </div>
  );
}

export function MlPageClient() {
  const { data: models = [], isLoading, isError } = useMlModels();
  const activate = useActivateModel();
  const rollback = useRollbackModel();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Moteur ML</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Backfill, entraînement et gestion des versions du modèle de
          correction.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <BackfillSection />
        <TrainingSection />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <p className="text-[0.72rem] font-semibold uppercase tracking-widest text-muted-foreground">
            Versions du modèle
          </p>
        </div>

        <div className="rounded-[1.1rem] border border-border bg-panel p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Info size={13} className="text-accent" />
            Critères d&apos;activation
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-foreground">
                Brier Score
              </p>
              <p className="text-xs text-muted-foreground">
                Plus bas = meilleur. Gain ≥ 5% vs le modèle actif déclenche
                l&apos;auto-switch.
              </p>
              <p className="text-[0.65rem] text-muted-foreground/60">
                Baseline Poisson ≈ 0.242
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-foreground">
                ROI simulé
              </p>
              <p className="text-xs text-muted-foreground">
                Doit être positif et supérieur au modèle actif sur la même
                fenêtre de test.
              </p>
              <p className="text-[0.65rem] text-muted-foreground/60">
                Référence SV/OVER_UNDER : +5.17%
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-foreground">
                Samples
              </p>
              <p className="text-xs text-muted-foreground">
                Minimum 200 pour XGBoost. En dessous, la régression logistique
                est utilisée.
              </p>
              <p className="text-[0.65rem] text-muted-foreground/60">
                Attendre ≥ 50 bets résolus avant de re-entraîner.
              </p>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-[1.1rem]" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-sm text-danger">
            Impossible de charger les modèles.
          </p>
        )}

        {!isLoading && !isError && models.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-[1.4rem] border border-dashed border-border py-12 text-center">
            <BrainCircuit size={28} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Aucun modèle entraîné. Lance d&apos;abord le backfill puis
              l&apos;entraînement.
            </p>
          </div>
        )}

        {models.map((model) => (
          <ModelRow
            key={model.id}
            model={model}
            onActivate={(id) => activate.mutate(id)}
            isActivating={activate.isPending}
            onRollback={(id) => rollback.mutate(id)}
            isRollingBack={rollback.isPending}
          />
        ))}
      </section>
    </div>
  );
}
