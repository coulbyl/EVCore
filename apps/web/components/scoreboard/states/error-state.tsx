"use client";

import { useTranslations } from "next-intl";
import { ScreenBand } from "../shell/screen-band";
import { StateLine, stateActionClass } from "./state-line";
import { useOnline } from "./use-online";

/** Une version ancienne : ses morceaux n'existent plus après un déploiement. */
export function isStaleVersionError(error: Error): boolean {
  return (
    error.name === "ChunkLoadError" ||
    /Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module/i.test(
      error.message,
    )
  );
}

/**
 * Ce que montre un écran qui n'a pas pu se rendre (10-transverse.md § 2).
 * Une seule ligne, jamais de code d'erreur, toujours une issue :
 *
 * - hors ligne d'abord (il prime sur l'erreur) : « Pas de réseau » et
 *   Réessayer quand il revient ;
 * - une version ancienne de l'application, dont les morceaux n'existent plus
 *   sur le serveur après un déploiement : « Une nouvelle version est prête »
 *   et Mettre à jour, qui recharge la page ;
 * - sinon : « On n'arrive pas à charger » et Réessayer.
 */
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  const online = useOnline();
  const t = useTranslations("scoreboard.states");
  const brand = useTranslations("shell")("brand");

  let message: string;
  let action: React.ReactNode;
  if (!online) {
    message = t("noNetwork");
    action = (
      <button type="button" onClick={retry} className={stateActionClass}>
        {t("retry")}
      </button>
    );
  } else if (isStaleVersionError(error)) {
    message = t("newVersion");
    action = (
      <button
        type="button"
        onClick={() => window.location.reload()}
        className={stateActionClass}
      >
        {t("update")}
      </button>
    );
  } else {
    message = t("loadError");
    action = (
      <button type="button" onClick={retry} className={stateActionClass}>
        {t("retry")}
      </button>
    );
  }

  return (
    <>
      <ScreenBand brand={brand} actions={null} />
      <div className="px-4 pt-2 lg:px-6">
        <StateLine role="alert" action={action}>
          {message}
        </StateLine>
      </div>
    </>
  );
}
