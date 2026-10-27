import type { Metadata } from "next";
import { LegalPage } from "../components/legal-page";
import { LEGAL_ENTITY } from "../legal-entity";

export const metadata: Metadata = {
  title: "Jeu responsable — EVCore",
  description:
    "Parier comporte des risques de perte. Les règles pour garder le contrôle, les signes d'alerte et où trouver de l'aide.",
  alternates: { canonical: "/jeu-responsable" },
};

export default function JeuResponsablePage() {
  return (
    <LegalPage
      title="Jeu responsable"
      intro="Parier comporte des risques de perte. EVCore montre des probabilités et tous ses résultats, pertes comprises, pour t'aider à décider en connaissance de cause. Il ne rend aucun pari sûr."
    >
      <section>
        <h2>Réservé aux adultes</h2>
        <p>
          18 ans minimum, 21 ans au Cameroun, ou l&apos;âge légal de ton pays
          s&apos;il est plus élevé. Ne laisse jamais une personne mineure
          utiliser ton compte ou parier pour toi.
        </p>
      </section>

      <section>
        <h2>Cinq règles pour garder le contrôle</h2>
        <ul>
          <li>
            <strong>Ne mise que ce que tu peux perdre.</strong> Fixe un budget
            pour le mois et n&apos;y ajoute rien quand il est épuisé.
          </li>
          <li>
            <strong>Garde une mise fixe.</strong> Miser plus après une perte
            pour « se refaire » est la façon la plus rapide de perdre davantage.
          </li>
          <li>
            <strong>Lis une probabilité comme une fréquence.</strong> 75 % veut
            dire qu&apos;on perd environ une fois sur quatre. Les séries de
            pertes sont normales, même sur les cotes courtes.
          </li>
          <li>
            <strong>Un combiné multiplie les risques.</strong> Une cote de 10
            gagne au mieux une fois sur dix, avant même la marge du bookmaker.
          </li>
          <li>
            <strong>Le pari n&apos;est pas un revenu.</strong> Aucune méthode,
            la nôtre comprise, ne garantit de gagner sur la durée.
          </li>
        </ul>
      </section>

      <section>
        <h2>Les signes qui doivent t&apos;alerter</h2>
        <ul>
          <li>
            Tu mises plus que prévu, ou de l&apos;argent destiné à autre chose.
          </li>
          <li>Tu empruntes ou vends des biens pour parier.</li>
          <li>Tu caches tes paris à tes proches.</li>
          <li>
            Tu penses aux paris quand tu ne joues pas, ou tu es irritable sans
            eux.
          </li>
          <li>Tu continues pour récupérer ce que tu as perdu.</li>
        </ul>
        <p>
          Si un seul de ces signes te concerne, fais une pause et parles-en.
        </p>
      </section>

      <section>
        <h2>Où trouver de l&apos;aide</h2>
        <ul>
          <li>
            Parles-en à un proche ou à un médecin : l&apos;addiction au jeu se
            soigne.
          </li>
          <li>
            Les opérateurs agréés proposent des limites de dépôt, des pauses et
            l&apos;auto-exclusion : utilise-les.
          </li>
          <li>
            Gamblers Anonymous, groupes d&apos;entraide entre joueurs :{" "}
            <a
              href="https://www.gamblersanonymous.org"
              className="underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              gamblersanonymous.org
            </a>
            .
          </li>
        </ul>
      </section>

      <section>
        <h2>Ce qu&apos;EVCore fait, et ne fait pas</h2>
        <ul>
          <li>EVCore ne prend aucune mise et ne gagne rien sur tes paris.</li>
          <li>
            Il affiche ses résultats réels, pertes comprises, et la fréquence à
            laquelle chaque produit perd.
          </li>
          <li>
            Tu peux faire supprimer ton compte à tout moment en écrivant à{" "}
            <a
              href={`mailto:${LEGAL_ENTITY.contactEmail}`}
              className="underline"
            >
              {LEGAL_ENTITY.contactEmail}
            </a>
            .
          </li>
        </ul>
      </section>
    </LegalPage>
  );
}
