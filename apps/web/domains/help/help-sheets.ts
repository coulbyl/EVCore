import type { DisplayLocale } from "@/helpers/scoreboard-format";

/**
 * « Aide » (09 § 3): short sheets in code, one per word the app uses. A
 * sheet is one screen, 150 words at most, one example with figures, and
 * one link, to the screen it is about. No video, no badge, no path: the
 * five sheets of Formation (2026-10-27) are rewritten here for the four
 * tabs, and the glossary disappears into them.
 *
 * `**…**` marks the few words read first.
 */
export type HelpSheet = {
  slug: HelpSlug;
  title: string;
  paragraphs: string[];
  /** The example with figures, set apart. */
  example: string;
  link: { href: string; label: string };
};

export const HELP_SLUGS = [
  "reading-a-coupon",
  "chances",
  "what-1xbet-keeps",
  "abstentions",
  "following",
  "ticket",
  "products",
  "results",
  "responsible",
] as const;

export type HelpSlug = (typeof HELP_SLUGS)[number];

const FR: Record<HelpSlug, Omit<HelpSheet, "slug">> = {
  "reading-a-coupon": {
    title: "Comment lire un coupon",
    paragraphs: [
      "Un coupon montre le produit, l'heure du premier match, les équipes et **le pari nommé avec l'équipe** : « Victoire Paris SG », « Plus de 2,5 buts ».",
      "À droite, **la cote 1xBet**, celle que ton ticket paiera. Dessous, **la chance** : « 8 sur 10 » et ses diodes.",
      "La forme du produit suit : un carré par jour joué, plein s'il a gagné, barré s'il a perdu.",
      "Une fois réglé, **✓ ou ✗** prend la place de la cote, avec la cote réellement payée.",
    ],
    example:
      "Favori du jour · 19:00 · Paris SG – Lens · Victoire Paris SG · 1,28 · 8 sur 10.",
    link: { href: "/today", label: "Voir le coupon du jour" },
  },
  chances: {
    title: "« 8 sur 10 », ça veut dire quoi",
    paragraphs: [
      "Sur 10 jours comme celui-là, ce pari passe **environ 8 fois et rate 2 fois**. Ce n'est pas une promesse pour aujourd'hui.",
      "Jusqu'à la cote 1,80, la chance vient de notre moteur, calibré sur ce qu'il a déjà donné. Au-dessus, c'est **la fréquence de la cote**, marge retirée : notre moteur y était trop optimiste.",
      "Dans Résultats, on met côte à côte **l'annoncé et le réalisé**. Quand les deux se ressemblent, on dit vrai.",
    ],
    example:
      "Le Favori annonce 8 sur 10 depuis le 13/10. Réalisé : 11 jours gagnés sur 14, soit 8 sur 10.",
    link: { href: "/results", label: "Voir nos résultats" },
  },
  "what-1xbet-keeps": {
    title: "Ce que 1xBet garde",
    paragraphs: [
      "Une cote paie **un peu moins que le risque**. La différence, c'est ce que 1xBet garde de ta mise, en moyenne.",
      "Elle change d'un pari à l'autre : faible sur le résultat d'un grand match, plus forte sur les petits championnats et les autres paris. À chance égale, choisis le moins cher.",
      "Sur un ticket, elle se multiplie. **« Sur la durée »** : un ticket gagne ou perd tout ; ce chiffre est la moyenne sur beaucoup de tickets.",
    ],
    example:
      "Un pari à 1 chance sur 2 vaut 2,00 ; payé 1,86, 1xBet garde 7 %. Huit paris à 1,50 dont la vraie chance est 0,62 : 1xBet garde 44 % de la mise.",
    link: { href: "/matches", label: "Composer un ticket" },
  },
  abstentions: {
    title: "Pourquoi on s'abstient certains jours",
    paragraphs: [
      "Un produit ne sort que si un pari **remplit ses règles**. Le Favori, c'est un favori à domicile coté de 1,20 à 1,35 : sans lui, pas de Favori ce jour-là.",
      "Aujourd'hui dit pourquoi, en une ligne : « aucun favori à domicile entre 1,20 et 1,35 ».",
      "Un jour sans coupon **ne compte ni gagné ni perdu**. On préfère s'abstenir que forcer un pari qui ne tient pas.",
    ],
    example:
      "Résultats, sur 90 jours : « 11 jours gagnés sur 14 · 2 jours sans Favori ».",
    link: { href: "/today", label: "Voir Aujourd'hui" },
  },
  following: {
    title: "Suivre un coupon",
    paragraphs: [
      "Suivre **ne mise rien** : EVCore ne place jamais de pari pour toi.",
      "Suivre range le coupon dans **Moi**, en cours puis réglé, et te prévient du résultat si tu l'as demandé dans Compte.",
      "On peut suivre jusqu'au premier coup d'envoi. Un second toucher retire le suivi.",
    ],
    example:
      "Moi : « 7 gagnés · 4 perdus », le compte des coupons que tu as suivis, depuis ton premier suivi.",
    link: { href: "/me", label: "Voir mes coupons suivis" },
  },
  ticket: {
    title: "Vérifie ton ticket",
    paragraphs: [
      "Ajoute tes paris depuis la fiche d'un match avec **[+]** : un par match, 15 au plus.",
      "EVCore te donne **la cote totale, tes chances et ce que 1xBet garde**. Pas de mise, pas de gain : tes chances, en clair.",
      "Le ticket reste sur ton téléphone. On compte seulement, sans savoir qui, qu'un ticket a été vérifié.",
    ],
    example:
      "4 matchs, cote 10,6 : environ 1 fois sur 9. Sur la durée, 1xBet garde 31 % de ta mise sur ce ticket.",
    link: { href: "/matches", label: "Aller aux matchs" },
  },
  products: {
    title: "Le Favori, le Combiné, le Cote 2, les chasseurs",
    paragraphs: [
      "**Favori** : un match, favori à domicile, cote de 1,20 à 1,35. Il perd rarement, il rapporte peu.",
      "**Combiné** : des matchs de championnats différents, chacun coté de 1,20 à 1,50.",
      "**Cote 2** : jusqu'à trois matchs pour une cote totale de 2 à 3.",
      "**Chasseurs** : un pari à plus grosse cote — le nul, les deux équipes marquent, le score exact, les corners. Ils perdent souvent : c'est leur nature, pas une panne.",
    ],
    example: "À la cote 3,40, un nul passe environ 1 fois sur 3.",
    link: { href: "/results", label: "Voir chaque produit" },
  },
  results: {
    title: "Nos résultats : comment on les compte",
    paragraphs: [
      "**Un jour**, c'est le coupon publié ce jour-là, avant son premier match. Remboursé : ni gagné ni perdu.",
      "Jamais de pourcentage : **une fraction**, qui dit sa taille. À côté, l'annoncé contre le réalisé, la pire série, et l'argent à mise fixe, à la cote réellement payée.",
      "Chaque produit compte **depuis sa mise en ligne**, jamais avant. Moins de 10 jours réglés : « Trop tôt ».",
    ],
    example:
      "En francs, à 1 000 F par jour : misé 14 000 F, rendu 13 600 F, du 13/10 au 28/10.",
    link: { href: "/results", label: "Voir nos résultats" },
  },
  responsible: {
    title: "Jeu responsable",
    paragraphs: [
      "Parier **coûte de l'argent en moyenne** : la cote garde une marge. Joue un budget que tu peux perdre, fixé à l'avance.",
      "Ne mise jamais plus pour te refaire après une perte. Les séries perdantes arrivent, même sur un pari qui passe souvent.",
      "Si ce n'est plus un plaisir, **fais une pause** : Aujourd'hui, Matchs et ton ticket se ferment le temps choisi.",
    ],
    example: "Un pari à 8 sur 10 perd 2 jours d'affilée environ 2 mois sur 3.",
    link: { href: "/me/responsible", label: "Ouvrir Jeu responsable" },
  },
};

const EN: Record<HelpSlug, Omit<HelpSheet, "slug">> = {
  "reading-a-coupon": {
    title: "How to read a coupon",
    paragraphs: [
      "A coupon shows the product, the first match's time, the teams and **the bet named with its team**: “Paris SG to win”, “Over 2.5 goals”.",
      "On the right, **the 1xBet odds**, the ones your ticket pays. Under them, **the chance**: “8 in 10” and its lights.",
      "Then the product's form: one square per day played, full when won, crossed when lost.",
      "Once settled, **✓ or ✗** replaces the odds, with the odds really paid.",
    ],
    example:
      "Favourite of the day · 19:00 · Paris SG – Lens · Paris SG to win · 1.28 · 8 in 10.",
    link: { href: "/today", label: "See today's coupon" },
  },
  chances: {
    title: "“8 in 10”, what does it mean",
    paragraphs: [
      "Over 10 days like this one, this bet lands **about 8 times and misses 2**. It is not a promise for today.",
      "Up to odds of 1.80 the chance comes from our engine, calibrated on what it gave. Above, it is **the frequency of the odds**, margin removed: our engine was too optimistic there.",
      "Results puts **announced and realised** side by side. When they match, we tell the truth.",
    ],
    example:
      "The Favourite announces 8 in 10 since 13/10. Realised: 11 days won of 14, that is 8 in 10.",
    link: { href: "/results", label: "See our results" },
  },
  "what-1xbet-keeps": {
    title: "What 1xBet keeps",
    paragraphs: [
      "Odds pay **a little less than the risk**. The gap is what 1xBet keeps of your stake, on average.",
      "It changes from bet to bet: small on a big match's result, larger on small leagues and other bets. At equal chance, pick the cheaper one.",
      "On a ticket it multiplies. **“Over time”**: a ticket wins or loses all; this figure is the average over many tickets.",
    ],
    example:
      "A 1-in-2 bet is worth 2.00; paid 1.86, 1xBet keeps 7%. Eight bets at 1.50 whose true chance is 0.62: 1xBet keeps 44% of the stake.",
    link: { href: "/matches", label: "Build a ticket" },
  },
  abstentions: {
    title: "Why we sit out some days",
    paragraphs: [
      "A product only comes out when a bet **meets its rules**. The Favourite is a home favourite priced 1.20 to 1.35: without one, no Favourite that day.",
      "Today says why, in one line: “no home favourite between 1.20 and 1.35”.",
      "A day without a coupon **counts neither won nor lost**. We would rather sit out than force a bet that does not hold.",
    ],
    example:
      "Results, over 90 days: “11 days won of 14 · 2 days without a Favourite”.",
    link: { href: "/today", label: "See Today" },
  },
  following: {
    title: "Following a coupon",
    paragraphs: [
      "Following **stakes nothing**: EVCore never places a bet for you.",
      "It files the coupon in **Me**, running then settled, and tells you the result if you asked for it in Account.",
      "You can follow until the first kick-off. A second tap stops following.",
    ],
    example: "Me: “7 won · 4 lost”, the count of the coupons you followed.",
    link: { href: "/me", label: "See my followed coupons" },
  },
  ticket: {
    title: "Check your ticket",
    paragraphs: [
      "Add your bets from a match sheet with **[+]**: one per match, 15 at most.",
      "EVCore gives **the total odds, your chances and what 1xBet keeps**. No stake, no winnings: your chances, plainly.",
      "The ticket stays on your phone. We only count, without knowing who, that a ticket was checked.",
    ],
    example:
      "4 matches, odds 10.6: about 1 time in 9. Over time, 1xBet keeps 31% of your stake on this ticket.",
    link: { href: "/matches", label: "Go to the matches" },
  },
  products: {
    title: "The Favourite, the Combo, the Odds-2, the hunters",
    paragraphs: [
      "**Favourite**: one match, home favourite, odds 1.20 to 1.35. It rarely loses, it pays little.",
      "**Combo**: matches from different leagues, each priced 1.20 to 1.50.",
      "**Odds-2**: up to three matches for total odds of 2 to 3.",
      "**Hunters**: one bet at bigger odds — the draw, both teams score, the exact score, corners. They often lose: that is their nature, not a fault.",
    ],
    example: "At odds of 3.40, a draw lands about 1 time in 3.",
    link: { href: "/results", label: "See each product" },
  },
  results: {
    title: "Our results: how we count them",
    paragraphs: [
      "**A day** is the coupon published that day, before its first match. Refunded: neither won nor lost.",
      "Never a percentage: **a fraction**, which tells its size. Beside it, announced against realised, the worst run, and money at a fixed stake, at the odds really paid.",
      "Each product counts **from its launch**, never before. Under 10 settled days: “Too early”.",
    ],
    example:
      "In francs, at 1,000 F a day: staked 14,000 F, returned 13,600 F, from 13/10 to 28/10.",
    link: { href: "/results", label: "See our results" },
  },
  responsible: {
    title: "Responsible gambling",
    paragraphs: [
      "Betting **costs money on average**: the odds keep a margin. Play a budget you can lose, set in advance.",
      "Never stake more to win back a loss. Losing runs happen, even on a bet that often lands.",
      "If it is no longer fun, **take a break**: Today, Matches and your ticket close for the time you choose.",
    ],
    example: "A bet at 8 in 10 loses 2 days in a row about 2 months in 3.",
    link: { href: "/me/responsible", label: "Open Responsible gambling" },
  },
};

export function helpSheets(locale: DisplayLocale): HelpSheet[] {
  const content = locale === "en" ? EN : FR;
  return HELP_SLUGS.map((slug) => ({ slug, ...content[slug] }));
}

export function helpSheet(
  slug: string,
  locale: DisplayLocale,
): HelpSheet | null {
  return helpSheets(locale).find((sheet) => sheet.slug === slug) ?? null;
}
