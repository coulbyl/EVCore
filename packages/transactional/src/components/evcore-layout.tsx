import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from "@react-email/components";
import { type PropsWithChildren } from "react";
import { palette } from "./palette";

// Hosted URL instead of an inlined data: URI — many mail clients (Gmail
// webmail, corporate security gateways in particular) strip base64-encoded
// images embedded directly in the HTML, so the logo never rendered.
const EVCORE_LOGO_URL = "https://c-evcore.com/icons/icon-192.png";

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const styles = {
  body: {
    backgroundColor: palette.bg.page,
    fontFamily: FONT_STACK,
    margin: 0,
    padding: "32px 12px",
  },
  container: {
    backgroundColor: palette.bg.surface,
    border: `1px solid ${palette.border.default}`,
    borderRadius: "12px",
    margin: "0 auto",
    maxWidth: "540px",
    overflow: "hidden" as const,
  },
  header: {
    borderBottom: `1px solid ${palette.border.default}`,
    padding: "20px 32px 18px",
  },
  logo: {
    borderRadius: "10px",
    display: "block",
  },
  brand: {
    color: palette.text.primary,
    fontSize: "15px",
    fontWeight: "700",
    letterSpacing: "0.2px",
    margin: 0,
  },
  tagline: {
    color: palette.text.subtle,
    fontSize: "11px",
    margin: "2px 0 0",
  },
  content: {
    padding: "28px 32px 8px",
  },
  divider: {
    borderColor: palette.border.default,
    margin: "8px 0 0",
  },
  footer: {
    color: palette.text.subtle,
    fontSize: "12px",
    lineHeight: "18px",
    margin: 0,
    padding: "16px 32px 22px",
    textAlign: "center" as const,
  },
} as const;

type EvCoreLayoutProps = PropsWithChildren<{
  preview: string;
}>;

export function EvCoreLayout({ preview, children }: EvCoreLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Row>
              <Column style={{ width: "36px" }}>
                <Img
                  src={EVCORE_LOGO_URL}
                  alt="EVCore"
                  width="36"
                  height="36"
                  style={styles.logo}
                />
              </Column>
              <Column style={{ paddingLeft: "12px" }}>
                <Text style={styles.brand}>EVCore</Text>
                <Text style={styles.tagline}>Autonomous EV Betting Engine</Text>
              </Column>
            </Row>
          </Section>

          <Section style={styles.content}>{children}</Section>

          <Hr style={styles.divider} />
          <Text style={styles.footer}>
            Notification automatique — ne pas répondre à cet email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
