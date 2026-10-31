import type { Metadata } from "next";
import { EntityValue, LegalPage } from "../components/legal-page";
import { LEGAL_ENTITY, TO_COMPLETE } from "../legal-entity";

export const metadata: Metadata = {
  title: "Mentions légales — EVCore",
  description: "Éditeur, directeur de la publication et hébergeur d'EVCore.",
  alternates: { canonical: "/mentions-legales" },
};

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions légales"
      intro="Les informations sur l'éditeur et l'hébergeur du site c-evcore.com."
    >
      <section>
        <h2>Éditeur</h2>
        <ul>
          <li>
            Nom ou raison sociale :{" "}
            <EntityValue
              value={LEGAL_ENTITY.publisher}
              fallback={TO_COMPLETE}
            />
          </li>
          <li>
            Forme juridique :{" "}
            <EntityValue
              value={LEGAL_ENTITY.legalForm}
              fallback={TO_COMPLETE}
            />
          </li>
          <li>
            Siège :{" "}
            <EntityValue value={LEGAL_ENTITY.address} fallback={TO_COMPLETE} />
          </li>
          <li>
            Immatriculation :{" "}
            <EntityValue
              value={LEGAL_ENTITY.registration}
              fallback={TO_COMPLETE}
            />
          </li>
          <li>
            Directeur ou directrice de la publication :{" "}
            <EntityValue
              value={LEGAL_ENTITY.publicationDirector}
              fallback={TO_COMPLETE}
            />
          </li>
          <li>
            Contact :{" "}
            <a
              href={`mailto:${LEGAL_ENTITY.contactEmail}`}
              className="underline"
            >
              {LEGAL_ENTITY.contactEmail}
            </a>
          </li>
        </ul>
      </section>

      <section>
        <h2>Hébergeur</h2>
        <p>
          <EntityValue value={LEGAL_ENTITY.host} fallback={TO_COMPLETE} />
        </p>
      </section>

      <section>
        <h2>Activité</h2>
        <p>
          EVCore publie des analyses de matchs de football. Il n&apos;est pas un
          opérateur de jeux d&apos;argent : il ne prend aucune mise, ne détient
          aucun fonds et ne perçoit aucune commission sur les paris.
        </p>
      </section>

      <section>
        <h2>Crédits</h2>
        <p>
          Avatars : style « Micah » de{" "}
          <a href="https://www.dicebear.com" className="underline">
            DiceBear
          </a>
          , remix de « Avatar Illustration System » par Micah Lanier, sous
          licence{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/deed.fr"
            className="underline"
          >
            CC BY 4.0
          </a>
          . Fichiers repris sans modification, servis par EVCore.
        </p>
      </section>
    </LegalPage>
  );
}
