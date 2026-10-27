import { ImageResponse } from "next/og";

/**
 * Image de partage (WhatsApp, Facebook, X) des pages publiques.
 *
 * Remplace la capture du tableau de bord de juillet, qui exposait le nom et
 * la photo du fondateur, un solde de 500 millions de francs et des « +63 % »
 * (audit du 2026-10-23, P1-4), au mauvais format (1904×983 annoncé
 * 1200×630). Aucune donnée de compte, la promesse du produit, et la mention
 * 18+ : c'est le premier visuel vu par quiconque reçoit le lien.
 *
 * Police par défaut d'ImageResponse : les fichiers Geist du projet sont des
 * polices variables en woff, que le moteur de rendu ne lit pas.
 */
export const shareImageAlt =
  "EVCore — Avant de parier, lis le match. Probabilités, raisonnement et résultats réglés, pertes comprises. 18+.";
export const shareImageSize = { width: 1200, height: 630 };

export function renderShareImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "#0d1520",
        color: "#e2e8f0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "#14b8a6",
            color: "#0d1520",
            fontSize: 30,
            fontWeight: 800,
          }}
        >
          EV
        </div>
        <div style={{ display: "flex", fontSize: 36, fontWeight: 800 }}>
          EVCore
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          Avant de parier, lis le match.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 34,
            lineHeight: 1.3,
            color: "#8ca0b8",
            maxWidth: 940,
          }}
        >
          Probabilités, raisonnement et résultats réglés, pertes comprises.
          Analyses de football gratuites.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 26,
          color: "#8ca0b8",
          borderTop: "1px solid rgba(226,232,240,0.15)",
          paddingTop: 24,
        }}
      >
        18+ · Parier comporte des risques de perte.
      </div>
    </div>,
    shareImageSize,
  );
}
