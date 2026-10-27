import type { Metadata } from "next";
import { EntityValue, LegalPage } from "../components/legal-page";
import { LEGAL_ENTITY, TO_COMPLETE } from "../legal-entity";

export const metadata: Metadata = {
  title: "Confidentialité — EVCore",
  description:
    "Quelles données EVCore collecte, pourquoi, combien de temps, et comment exercer tes droits.",
  alternates: { canonical: "/confidentialite" },
};

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      intro="Cette page dit exactement quelles données EVCore enregistre sur toi, pourquoi, avec qui elles sont partagées, et comment tu peux y accéder ou les faire supprimer."
    >
      <section>
        <h2>1. Responsable du traitement</h2>
        <p>
          <EntityValue value={LEGAL_ENTITY.publisher} fallback={TO_COMPLETE} />,
          joignable à{" "}
          <a href={`mailto:${LEGAL_ENTITY.contactEmail}`} className="underline">
            {LEGAL_ENTITY.contactEmail}
          </a>
          . Déclaration auprès de l&apos;ARTCI (loi ivoirienne n° 2013-450) :{" "}
          <EntityValue
            value={LEGAL_ENTITY.dataProtectionFiling}
            fallback={TO_COMPLETE}
          />
          .
        </p>
      </section>

      <section>
        <h2>2. Les données enregistrées</h2>
        <ul>
          <li>
            <strong>Ton compte</strong> : adresse e-mail, nom
            d&apos;utilisateur, nom complet, mot de passe (enregistré uniquement
            sous forme chiffrée irréversible), et, si tu les ajoutes, une bio et
            une photo de profil.
          </li>
          <li>
            <strong>Tes préférences</strong> : langue, devise, thème, unité de
            mise, profil de risque, championnats et canaux suivis.
          </li>
          <li>
            <strong>La sécurité de ton compte</strong> : vérification de
            l&apos;e-mail, méthode de double authentification choisie et son
            secret, et pour chaque session ouverte l&apos;adresse IP, le
            navigateur et les dates de connexion. Une session expire au bout de
            30 jours.
          </li>
          <li>
            <strong>Ton numéro de téléphone</strong>, seulement si tu
            l&apos;ajoutes et coches le consentement correspondant. Si tu
            retires ce consentement, le numéro est effacé.
          </li>
          <li>
            <strong>Ton activité dans l&apos;application</strong> : coupons que
            tu marques comme joués, mouvements de ton suivi de mise
            (déclaratifs, aucun argent ne transite), coupons consultés,
            progression dans la formation et badges.
          </li>
          <li>
            <strong>Le support</strong> : les messages et pièces jointes que tu
            envoies à l&apos;équipe.
          </li>
          <li>
            <strong>Les notifications</strong> : si tu les actives,
            l&apos;adresse technique fournie par ton navigateur pour te les
            envoyer.
          </li>
        </ul>
        <p>
          EVCore n&apos;utilise aucun pixel publicitaire ni outil de mesure
          d&apos;audience tiers. Les cookies déposés sont ceux nécessaires au
          service : la session de connexion et la langue d&apos;affichage. Ton
          thème est gardé dans ton navigateur.
        </p>
      </section>

      <section>
        <h2>3. Pourquoi</h2>
        <ul>
          <li>Te fournir le service et ton suivi personnel.</li>
          <li>Protéger ton compte et détecter les accès anormaux.</li>
          <li>Répondre à tes demandes de support.</li>
          <li>T&apos;envoyer les notifications que tu as choisies.</li>
          <li>
            Améliorer le service à partir de statistiques internes agrégées.
          </li>
        </ul>
        <p>
          Ces traitements reposent sur l&apos;exécution du service que tu
          demandes, sur ton consentement (téléphone, notifications) et sur
          l&apos;intérêt légitime à sécuriser le service. Tes données ne sont
          jamais vendues.
        </p>
      </section>

      <section>
        <h2>4. Qui y a accès</h2>
        <p>
          L&apos;équipe EVCore, et les prestataires techniques nécessaires au
          service : l&apos;hébergeur (
          <EntityValue value={LEGAL_ENTITY.host} fallback={TO_COMPLETE} />) et
          le prestataire d&apos;envoi des e-mails. Données hébergées en :{" "}
          <EntityValue
            value={LEGAL_ENTITY.hostingCountry}
            fallback={TO_COMPLETE}
          />
          .
        </p>
      </section>

      <section>
        <h2>5. Combien de temps</h2>
        <p>
          Tes données sont conservées tant que ton compte existe. À ta demande
          de suppression, le compte et les données qui y sont rattachées sont
          supprimés, sauf obligation légale de conservation.
        </p>
      </section>

      <section>
        <h2>6. Tes droits</h2>
        <p>
          Tu peux accéder à tes données, les faire corriger, t&apos;opposer à un
          traitement ou demander leur suppression en écrivant à{" "}
          <a href={`mailto:${LEGAL_ENTITY.contactEmail}`} className="underline">
            {LEGAL_ENTITY.contactEmail}
          </a>
          . Une réponse t&apos;est apportée dans un délai d&apos;un mois. Tu
          peux aussi saisir l&apos;autorité de protection des données de ton
          pays, en Côte d&apos;Ivoire l&apos;ARTCI.
        </p>
      </section>

      <section>
        <h2>7. Sécurité et mineurs</h2>
        <p>
          Les mots de passe sont chiffrés de façon irréversible et la double
          authentification est disponible. EVCore est réservé aux 18+ (21+ au
          Cameroun) : un compte ouvert par une personne mineure est supprimé.
        </p>
      </section>
    </LegalPage>
  );
}
