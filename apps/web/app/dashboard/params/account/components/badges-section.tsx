"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@evcore/ui";
import { useMyBadges } from "@/domains/gamification/use-cases/get-my-badges";
import { SettingsSectionCard } from "./settings-section-card";

const BADGE_EMOJI: Record<string, string> = {
  vol_50: "🏅",
  vol_150: "🥈",
  vol_300: "🥇",
  streak_5: "⚡",
  patience: "🧘",
  calibre: "🎯",
};

export function BadgesSection() {
  const { data: badges, isLoading } = useMyBadges();

  return (
    <SettingsSectionCard
      eyebrow="Progression"
      title="Mes badges"
      description="Débloquez des badges en atteignant des jalons de performance."
    >
      {isLoading ? (
        <div className="flex flex-wrap gap-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-16 w-28 animate-pulse rounded-xl bg-secondary"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {(badges ?? []).map((badge) => {
            const unlocked = badge.unlockedAt !== null;
            const emoji = BADGE_EMOJI[badge.code] ?? "🏆";

            return (
              <Tooltip key={badge.code}>
                <TooltipTrigger asChild>
                  <div
                    className={`flex w-28 flex-col items-center gap-1.5 rounded-xl border px-3 py-3 transition-colors ${
                      unlocked
                        ? "border-accent/30 bg-accent/8 text-foreground"
                        : "border-border bg-panel text-muted-foreground opacity-50 grayscale"
                    }`}
                  >
                    <span className="text-2xl leading-none">{emoji}</span>
                    <span className="text-center text-[0.68rem] font-semibold leading-tight">
                      {badge.name}
                    </span>
                    {unlocked && badge.unlockedAt && (
                      <span className="text-[0.6rem] text-muted-foreground">
                        {new Date(badge.unlockedAt).toLocaleDateString(
                          "fr-FR",
                          {
                            day: "numeric",
                            month: "short",
                          },
                        )}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="max-w-[200px] text-center text-xs"
                >
                  {unlocked ? badge.description : `🔒 ${badge.description}`}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      )}
    </SettingsSectionCard>
  );
}
