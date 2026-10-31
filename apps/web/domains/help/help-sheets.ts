import type { DisplayLocale } from "@/helpers/scoreboard-format";

/**
 * « Aide » (09 § 3): short sheets in code, one per word the app uses. A
 * sheet is one screen, 150 words at most, one example with figures, and
 * one link, to the screen it is about. No video, no badge, no path: the
 * five sheets of Formation (2026-10-27) are rewritten here for the four
 * tabs, and the glossary disappears into them.
 *
 * Written as one would say it to a friend, « tu » (31/10): never the
 * dry voice of a manual. `**…**` marks the few words read first.
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
      "Un coupon, c'est un ou plusieurs matchs, avec pour chacun le pari qu'on te propose. On l'écrit comme tu le dirais : « Victoire du PSG », « Plus de 2,5 buts ».",
      "À droite, tu as **la cote**, celle que tu trouveras chez ton bookmaker. Juste en dessous, **ta chance** de gagner : « Passe 8 fois sur 10 », avec les petites diodes pour la voir d'un coup d'œil.",
      "Les petits carrés racontent les derniers jours du produit : vert quand il a gagné, barré quand il a perdu.",
      "Une fois les matchs finis, **un ✓ ou un ✗** prend la place de la cote. Si c'est gagné, tu vois la cote vraiment payée.",
      "Nos cotes viennent de 1xBet, le bookmaker que nos joueurs utilisent le plus. On n'a aucun lien avec eux : on lit simplement leurs prix.",
    ],
    example:
      "Favori du jour · 19:00 · Paris SG – Lens · Victoire Paris SG · 1,28 · 8 sur 10.",
    link: { href: "/today", label: "Voir le coupon du jour" },
  },
  chances: {
    title: "« 8 sur 10 », ça veut dire quoi",
    paragraphs: [
      "Imagine 10 jours comme celui-ci : ce pari passerait **à peu près 8 fois, et raterait 2 fois**. Ce n'est pas une garantie pour aujourd'hui, juste une idée honnête de tes chances.",
      "Pour les petites cotes, jusqu'à 1,80, le chiffre vient de notre moteur, qu'on vérifie tous les jours sur ses vrais résultats. Au-delà, on prend **ce que dit la cote elle-même** : sur ces paris-là, notre moteur était trop optimiste.",
      "Pour que tu n'aies pas à nous croire sur parole, Résultats met côte à côte **ce qu'on avait annoncé et ce qui s'est vraiment passé**.",
    ],
    example:
      "Le Favori annonce 8 sur 10 depuis le 13/10. Dans les faits : 11 jours gagnés sur 14, soit 8 sur 10.",
    link: { href: "/results", label: "Voir nos résultats" },
  },
  abstentions: {
    title: "Pourquoi certains jours, il n'y a pas de coupon",
    paragraphs: [
      "Chaque produit a ses règles, et on ne les tord pas. Le Favori, par exemple, c'est un favori qui joue à domicile, coté entre 1,20 et 1,35. **S'il n'y en a pas, il n'y a pas de Favori ce jour-là.**",
      "Dans Aujourd'hui, on te dit simplement pourquoi : « aucun favori à domicile entre 1,20 et 1,35 ».",
      "Un jour sans coupon **ne compte ni comme gagné, ni comme perdu**. On préfère ne rien te proposer plutôt qu'un pari bancal.",
    ],
    example:
      "Dans Résultats, sur 90 jours : « 11 jours gagnés sur 14 · 2 jours sans Favori ».",
    link: { href: "/today", label: "Voir Aujourd'hui" },
  },
  following: {
    title: "Suivre un coupon",
    paragraphs: [
      "Suivre un coupon **ne mise pas un centime** : EVCore ne parie jamais à ta place.",
      "Ça te permet de le retrouver dans **Moi**, pendant les matchs puis une fois réglé. Et si tu as activé les notifications dans Compte, on te prévient du résultat.",
      "Tu peux suivre un coupon jusqu'au coup d'envoi du premier match. Tu as changé d'avis ? Appuie de nouveau pour ne plus le suivre.",
    ],
    example:
      "Dans Moi : « 7 gagnés · 4 perdus », le bilan des coupons que tu as suivis.",
    link: { href: "/me", label: "Voir mes coupons suivis" },
  },
  ticket: {
    title: "Vérifie ton ticket",
    paragraphs: [
      "Tu as ton propre combiné en tête ? Ajoute tes paris depuis la fiche d'un match avec **[+]**, un par match, jusqu'à 15.",
      "On te montre **la cote totale et tes vraies chances** de le gagner. Pas de mise, pas de gain promis : juste tes chances, sans détour.",
      "Ton ticket reste sur ton téléphone. De notre côté, on sait seulement qu'un ticket a été vérifié, jamais par qui.",
    ],
    example: "4 matchs, une cote de 10,6 : ça passe environ 1 fois sur 9.",
    link: { href: "/matches", label: "Aller aux matchs" },
  },
  products: {
    title: "Le Favori, le Combiné, le Cote 2, les chasseurs",
    paragraphs: [
      "**Le Favori** : un seul match, un favori qui joue à domicile, coté entre 1,20 et 1,35. Il perd rarement, mais il rapporte peu.",
      "**Le Combiné** : quelques matchs de championnats différents, chacun coté entre 1,20 et 1,50.",
      "**Le Cote 2** : jusqu'à trois matchs, pour une cote totale entre 2 et 3.",
      "**Les chasseurs** : un seul pari, mais à plus grosse cote : le nul, les deux équipes marquent, le score exact, les corners. Ils perdent souvent, c'est normal : quand ils passent, ils rapportent plus.",
    ],
    example: "À la cote 3,40, un match nul passe environ 1 fois sur 3.",
    link: { href: "/results", label: "Voir chaque produit" },
  },
  results: {
    title: "Nos résultats : comment on les compte",
    paragraphs: [
      "Chaque jour, on compte **le coupon publié ce jour-là**, avant son premier match, et on n'y touche plus après. Remboursé, il ne compte ni comme gagné, ni comme perdu.",
      "Pas de pourcentage qui arrange : on écrit **« 11 jours gagnés sur 14 »**, pour que tu voies sur combien de jours on se juge. À côté, ce qu'on avait annoncé, la pire série, et ce que tu aurais gagné ou perdu en misant pareil chaque jour.",
      "Chaque produit compte **depuis le jour où il est sorti**, jamais avant. Tant qu'il a moins de 10 jours réglés, on écrit « Trop tôt ».",
    ],
    example:
      "En francs, à 1 000 F par jour : misé 14 000 F, rendu 13 600 F, du 13/10 au 28/10.",
    link: { href: "/results", label: "Voir nos résultats" },
  },
  responsible: {
    title: "Jeu responsable",
    paragraphs: [
      "Sur la durée, **parier coûte plus que ça ne rapporte**, pour presque tout le monde. Fixe-toi un budget à l'avance, une somme que tu peux perdre sans que ça te gêne.",
      "Après une perte, ne mise jamais plus pour te refaire. Les séries perdantes arrivent, même sur les paris qui passent souvent.",
      "Si ce n'est plus un plaisir, **fais une pause** : Aujourd'hui, Matchs et ton ticket se ferment pendant la durée que tu choisis.",
    ],
    example:
      "Même un pari qui passe 8 fois sur 10 perd 2 jours de suite environ 2 mois sur 3.",
    link: { href: "/me/responsible", label: "Ouvrir Jeu responsable" },
  },
};

const EN: Record<HelpSlug, Omit<HelpSheet, "slug">> = {
  "reading-a-coupon": {
    title: "How to read a coupon",
    paragraphs: [
      "A coupon is one or more matches, each with the bet we suggest. We write it the way you would say it: “PSG to win”, “Over 2.5 goals”.",
      "On the right you have **the odds**, the ones you will find at your bookmaker. Just below, **your chance** of winning: “Lands 8 times in 10”, with the little lights to see it at a glance.",
      "The small squares tell the product's last days: green when it won, crossed when it lost.",
      "Once the matches are over, **a ✓ or a ✗** takes the place of the odds. If it won, you see the odds really paid.",
      "Our odds come from 1xBet, the bookmaker our players use most. We have no tie to them: we simply read their prices.",
    ],
    example:
      "Favourite of the day · 19:00 · Paris SG – Lens · Paris SG to win · 1.28 · 8 in 10.",
    link: { href: "/today", label: "See today's coupon" },
  },
  chances: {
    title: "“8 in 10”, what does it mean",
    paragraphs: [
      "Picture 10 days like this one: this bet would land **about 8 times and miss 2**. It is no guarantee for today, just an honest idea of your chances.",
      "For small odds, up to 1.80, the figure comes from our engine, which we check every day against its real results. Above that, we use **what the odds themselves say**: on those bets our engine was too optimistic.",
      "So you don't have to take our word for it, Results puts **what we announced next to what really happened**.",
    ],
    example:
      "The Favourite has announced 8 in 10 since 13/10. In fact: 11 days won out of 14, that is 8 in 10.",
    link: { href: "/results", label: "See our results" },
  },
  abstentions: {
    title: "Why some days there is no coupon",
    paragraphs: [
      "Each product has its rules, and we don't bend them. The Favourite, for instance, is a home favourite priced between 1.20 and 1.35. **If there isn't one, there is no Favourite that day.**",
      "Today simply tells you why: “no home favourite between 1.20 and 1.35”.",
      "A day without a coupon **counts neither as won nor as lost**. We would rather suggest nothing than a shaky bet.",
    ],
    example:
      "In Results, over 90 days: “11 days won out of 14 · 2 days without a Favourite”.",
    link: { href: "/today", label: "See Today" },
  },
  following: {
    title: "Following a coupon",
    paragraphs: [
      "Following a coupon **stakes nothing at all**: EVCore never bets for you.",
      "It keeps the coupon in **Me**, while the matches are on and once settled. And if you turned on notifications in Account, we tell you the result.",
      "You can follow a coupon until the first kick-off. Changed your mind? Tap again to stop following it.",
    ],
    example: "In Me: “7 won · 4 lost”, the record of the coupons you followed.",
    link: { href: "/me", label: "See my followed coupons" },
  },
  ticket: {
    title: "Check your ticket",
    paragraphs: [
      "Got your own accumulator in mind? Add your bets from a match sheet with **[+]**, one per match, up to 15.",
      "We show you **the total odds and your real chances** of winning it. No stake, no promised winnings: just your chances, straight.",
      "Your ticket stays on your phone. On our side, we only know that a ticket was checked, never by whom.",
    ],
    example: "4 matches, odds of 10.6: it lands about 1 time in 9.",
    link: { href: "/matches", label: "Go to the matches" },
  },
  products: {
    title: "The Favourite, the Combo, the Odds-2, the hunters",
    paragraphs: [
      "**The Favourite**: one match, a home favourite priced between 1.20 and 1.35. It rarely loses, but it pays little.",
      "**The Combo**: a few matches from different leagues, each priced between 1.20 and 1.50.",
      "**The Odds-2**: up to three matches, for total odds between 2 and 3.",
      "**The hunters**: one bet, at bigger odds: the draw, both teams score, the exact score, corners. They lose often, that's normal: when they land, they pay more.",
    ],
    example: "At odds of 3.40, a draw lands about 1 time in 3.",
    link: { href: "/results", label: "See each product" },
  },
  results: {
    title: "Our results: how we count them",
    paragraphs: [
      "Each day we count **the coupon published that day**, before its first match, and we never touch it afterwards. Refunded, it counts neither as won nor as lost.",
      "No flattering percentage: we write **“11 days won out of 14”**, so you see how many days we are judged on. Beside it, what we announced, the worst run, and what you would have won or lost staking the same every day.",
      "Each product counts **from the day it came out**, never before. Under 10 settled days, we write “Too early”.",
    ],
    example:
      "In francs, at 1,000 F a day: staked 14,000 F, returned 13,600 F, from 13/10 to 28/10.",
    link: { href: "/results", label: "See our results" },
  },
  responsible: {
    title: "Responsible gambling",
    paragraphs: [
      "Over time, **betting costs more than it pays**, for nearly everyone. Set yourself a budget in advance, a sum you can lose without it hurting.",
      "After a loss, never stake more to win it back. Losing runs happen, even on bets that often land.",
      "If it's no longer fun, **take a break**: Today, Matches and your ticket close for as long as you choose.",
    ],
    example:
      "Even a bet that lands 8 times in 10 loses 2 days in a row about 2 months in 3.",
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
