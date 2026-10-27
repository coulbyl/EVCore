import type { Metadata } from "next";
import Link from "next/link";
import { EntityValue, LegalPage } from "../components/legal-page";
import { LEGAL_ENTITY, TO_COMPLETE } from "../legal-entity";

export const metadata: Metadata = {
  title: "Conditions d'utilisation — EVCore",
  description:
    "Les règles d'utilisation d'EVCore : un service d'analyse de matchs de football, réservé aux 18+, qui ne prend aucune mise.",
  alternates: { canonical: "/cgu" },
};

export default function CguPage() {
  return (
    <LegalPage
      title="Conditions d'utilisation"
      intro="Ces conditions s'appliquent à toute personne qui utilise EVCore, avec ou sans compte. En créant un compte, tu les acceptes."
    >
      <section>
        <h2>1. Ce qu&apos;est EVCore</h2>
        <p>
          EVCore est un service d&apos;analyse de matchs de football. Il publie,
          pour chaque match analysé, des probabilités, le raisonnement qui les a
          produites, des sélections et des coupons, puis règle tout au résultat
          réel, pertes comprises.
        </p>
      </section>

      <section>
        <h2>2. Ce qu&apos;EVCore n&apos;est pas</h2>
        <ul>
          <li>
            EVCore n&apos;est pas un opérateur de jeux d&apos;argent. Il ne
            prend aucune mise, ne détient aucun fonds et ne propose aucun lien
            pour parier.
          </li>
          <li>
            EVCore ne touche aucune commission sur tes paris et ne vend pas de
            coupons. Toute personne qui vend des « coupons EVCore » ou des accès
            « VIP » en notre nom est un usurpateur : signale-la-nous.
          </li>
          <li>
            Le suivi de mise et les coupons que tu marques comme joués sont
            déclaratifs : ils servent à ton suivi personnel, aucun argent ne
            transite par EVCore.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Qui peut utiliser EVCore</h2>
        <ul>
          <li>
            Il faut avoir 18 ans révolus, 21 ans au Cameroun, ou l&apos;âge
            légal pour parier dans ton pays de résidence s&apos;il est plus
            élevé.
          </li>
          <li>
            Tu dois vérifier que les paris sportifs sont autorisés là où tu
            résides et ne parier qu&apos;auprès d&apos;opérateurs agréés par
            l&apos;autorité de ton pays.
          </li>
          <li>
            Ton compte est personnel. Tu es responsable de la confidentialité de
            ton mot de passe et de l&apos;exactitude des informations que tu
            fournis.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Aucune garantie de gain</h2>
        <p>
          Une probabilité est une estimation, pas une promesse : une sélection
          annoncée à 75 % perd environ une fois sur quatre. Les analyses
          d&apos;EVCore ne garantissent aucun gain, et les résultats passés ne
          préjugent pas des résultats futurs. Parier comporte un risque de perte
          de tout ou partie de ta mise.
        </p>
        <p>
          Tu restes seul responsable de tes décisions de pari, des sommes que tu
          engages et du respect de la loi de ton pays. Ne mise que ce que tu
          peux perdre ; la page{" "}
          <Link href="/jeu-responsable" className="underline">
            Jeu responsable
          </Link>{" "}
          t&apos;aide à garder le contrôle.
        </p>
      </section>

      <section>
        <h2>5. Gratuité</h2>
        <p>
          L&apos;accès à EVCore est gratuit pendant la phase actuelle. Si une
          offre payante est un jour proposée, ses conditions et son prix seront
          annoncés avant toute facturation, et rien ne te sera facturé sans ton
          accord explicite.
        </p>
      </section>

      <section>
        <h2>6. Ce qui est interdit</h2>
        <ul>
          <li>
            Revendre, republier ou redistribuer commercialement les analyses
            d&apos;EVCore.
          </li>
          <li>
            Se faire passer pour EVCore ou pour un membre de l&apos;équipe.
          </li>
          <li>
            Extraire les contenus de façon automatisée, contourner les
            protections du site ou en perturber le fonctionnement.
          </li>
          <li>Ouvrir un compte pour une personne mineure.</li>
        </ul>
      </section>

      <section>
        <h2>7. Propriété intellectuelle</h2>
        <p>
          Le nom EVCore, le logo, les textes, les analyses et le code du site
          appartiennent à l&apos;éditeur. Tu peux les consulter pour ton usage
          personnel ; toute autre utilisation demande une autorisation écrite.
        </p>
      </section>

      <section>
        <h2>8. Suspension et suppression du compte</h2>
        <p>
          Tu peux demander la suppression de ton compte à tout moment en
          écrivant à{" "}
          <a href={`mailto:${LEGAL_ENTITY.contactEmail}`} className="underline">
            {LEGAL_ENTITY.contactEmail}
          </a>
          . L&apos;éditeur peut suspendre un compte qui enfreint ces conditions,
          en particulier en cas de minorité, d&apos;usurpation ou de revente des
          analyses.
        </p>
      </section>

      <section>
        <h2>9. Responsabilité</h2>
        <p>
          EVCore met tout en œuvre pour publier des informations exactes et un
          service disponible, sans pouvoir le garantir en permanence.
          L&apos;éditeur n&apos;est pas responsable des pertes liées à des
          paris, ni des décisions prises sur la base des analyses publiées.
        </p>
      </section>

      <section>
        <h2>10. Modification des conditions</h2>
        <p>
          Ces conditions peuvent évoluer. La date de mise à jour figure en tête
          de page ; en cas de changement important, tu en seras informé dans
          l&apos;application avant qu&apos;il s&apos;applique.
        </p>
      </section>

      <section>
        <h2>11. Droit applicable et contact</h2>
        <p>
          Droit applicable :{" "}
          <EntityValue
            value={LEGAL_ENTITY.jurisdiction}
            fallback={TO_COMPLETE}
          />
          .
        </p>
        <p>
          Pour toute question :{" "}
          <a href={`mailto:${LEGAL_ENTITY.contactEmail}`} className="underline">
            {LEGAL_ENTITY.contactEmail}
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
