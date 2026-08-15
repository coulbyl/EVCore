import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type MlModelMissingProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";
import {
  headingStyle,
  insetBlock,
  label,
  note,
} from "../components/shared-styles";

export function MlModelMissingEmail({ segments }: MlModelMissingProps) {
  return (
    <EvCoreLayout
      preview={`ML — ${segments.length} segment(s) actif(s) en DB jamais chargé(s)`}
    >
      <Heading style={headingStyle(palette.status.warning)}>
        ML Model Missing — Garde-fou isActive
      </Heading>
      <Section>
        <Text style={label}>Segments concernés</Text>
        <Text style={insetBlock}>{segments.join("\n")}</Text>
        <Text style={note}>
          Ces segments sont marqués isActive=true en base mais n&apos;apparaissent
          pas dans les active_segments du ml-worker (/health) : fichier de
          modèle manquant, chemin invalide, ou échec de chargement. Les paris
          sur ces segments tournent sans correction ML tant que ce n&apos;est
          pas résolu.
        </Text>
      </Section>
    </EvCoreLayout>
  );
}

export const renderMlModelMissing = (props: MlModelMissingProps) =>
  renderEmail(createElement(MlModelMissingEmail, props));

export default function MlModelMissingEmailPreview() {
  return (
    <MlModelMissingEmail segments={["CONF:ONE_X_TWO", "SAFE:BTTS"]} />
  );
}
