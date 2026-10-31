import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { SubpageBand } from "@/components/scoreboard/shell/subpage-band";
import { PushNudge } from "@/components/scoreboard/ui/push-nudge";
import { getPlayerSession } from "@/domains/auth/use-cases/get-player-session";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { displayLocaleOf, formatTime } from "@/helpers/scoreboard-format";
import { serverApiRequest } from "@/lib/api/server-api";
import { AccountChoice, ThemeChoice } from "./components/display-choices";
import { AvatarChoice } from "./components/avatar-choice";
import { EditableValue } from "./components/editable-value";
import { EmailChange } from "./components/email-change";
import { NotificationSwitch } from "./components/notification-switch";
import { PasswordChange } from "./components/password-change";
import { SignOutOthers } from "./components/sign-out-others";
import { TwoFactorSetup } from "./components/two-factor-setup";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("playerAccount");
  return { title: `${t("title")} — EVCore` };
}

/** The four switches and « Par e-mail aussi », in screen order (09 § 5). */
const SWITCHES = [
  "morningBriefEnabled",
  "weeklyStatementEnabled",
  "followedResultEnabled",
  "teamRepliesEnabled",
  "emailNotificationsEnabled",
] as const;

// The morning and the Monday statement leave at 08:00 UTC (backend
// slip-digest.constants): 8 h in Abidjan and Dakar, 9 h in Douala. The
// screen says it in the player's own time.
const SENT_AT_UTC_HOUR = 8;

/**
 * « Compte » (09 § 5, maquette Compte) : une seule page en sections, sans
 * onglet. Profil (prénom, e-mail par code, téléphone), Sécurité (mot de
 * passe, double authentification, appareils connectés), Notifications
 * (quatre interrupteurs et « Par e-mail aussi »), Affichage (thème,
 * langue, devise). La suppression du compte vit dans Jeu responsable.
 */
export default async function Page() {
  const [t, session, locale, timeZone] = await Promise.all([
    getTranslations("playerAccount"),
    getPlayerSession(),
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const sentAt = new Date();
  sentAt.setUTCHours(SENT_AT_UTC_HOUR, 0, 0, 0);
  const time = formatTime(sentAt, displayLocaleOf(locale), timeZone);
  if (session.status !== "signed-in") redirect("/auth/login");
  const user = session.session.user;
  const { count: devices } = await serverApiRequest<{ count: number }>(
    "/auth/sessions",
  ).catch(() => ({ count: 1 }));
  const edit = {
    edit: t("edit"),
    save: t("save"),
    cancel: t("cancel"),
    failed: t("saveFailed"),
  };
  const twoFactorOn = user.mfaMethod === "TOTP" && user.totpVerified;
  const section = "flex flex-col py-3";
  const heading = "py-2 text-meta font-semibold text-muted-foreground";

  return (
    <>
      <SubpageBand
        title={t("title")}
        back={{ href: "/me", label: t("back") }}
      />
      <div className="flex flex-col divide-y divide-border px-4 pb-4 lg:px-6">
        <section className={section} aria-label={t("profile")}>
          <h2 className={heading}>{t("profile")}</h2>
          <AvatarChoice initial={user.avatarUrl} label={t("avatar")} />
          <EditableValue
            value={user.fullName}
            caption={t("firstName")}
            path="/auth/me/identity"
            field="firstName"
            labels={edit}
          />
          <EmailChange
            email={user.email}
            caption={t("email")}
            verifiedText={
              user.emailVerified ? t("emailVerified") : t("emailNotVerified")
            }
            verify={
              user.emailVerified
                ? null
                : { href: "/auth/verify", label: t("verifyEmail") }
            }
            labels={{
              edit: t("edit"),
              newEmail: t("newEmail"),
              password: t("password"),
              sendCode: t("sendCode"),
              code: t("code"),
              confirm: t("confirmEmail"),
              cancel: t("cancel"),
              failed: t("emailFailed"),
            }}
          />
          <EditableValue
            value={user.phoneNumber}
            emptyText={t("noPhone")}
            caption={t("phone")}
            path="/auth/me"
            field="phoneNumber"
            inputType="tel"
            labels={edit}
          />
        </section>

        <section className={section} aria-label={t("security")}>
          <h2 className={heading}>{t("security")}</h2>
          <details className="group">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-body [&::-webkit-details-marker]:hidden">
              {t("password")}
              <ChevronRight
                aria-hidden
                className="size-5 text-icon-subtle group-open:rotate-90"
              />
            </summary>
            <PasswordChange
              labels={{
                current: t("currentPassword"),
                next: t("newPassword"),
                submit: t("changePassword"),
                note: t("passwordNote"),
                failed: t("passwordFailed"),
              }}
            />
          </details>
          {twoFactorOn ? (
            <p className="flex min-h-12 items-center justify-between text-body">
              {t("twoFactor")}
              <span className="text-muted-foreground">{t("twoFactorOn")}</span>
            </p>
          ) : (
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-body [&::-webkit-details-marker]:hidden">
                {t("twoFactor")}
                <span className="flex items-center gap-1 text-muted-foreground">
                  {t("twoFactorOff")}
                  <ChevronRight
                    aria-hidden
                    className="size-5 text-icon-subtle group-open:rotate-90"
                  />
                </span>
              </summary>
              <TwoFactorSetup
                labels={{
                  start: t("twoFactorStart"),
                  scan: t("twoFactorScan"),
                  key: t("twoFactorKey"),
                  code: t("twoFactorCode"),
                  confirm: t("twoFactorConfirm"),
                  failed: t("twoFactorFailed"),
                }}
              />
            </details>
          )}
          <div className="flex min-h-12 items-center justify-between gap-3">
            <span className="text-body">
              {t("devices")}{" "}
              <span className="score font-semibold">{devices}</span>
            </span>
            {devices > 1 ? (
              <SignOutOthers
                labels={{
                  action: t("signOutOthers"),
                  done: t.raw("signedOutOthers") as string,
                  failed: t("signOutFailed"),
                }}
              />
            ) : null}
          </div>
        </section>

        <section className={section} aria-label={t("notifications")}>
          <h2 className={heading}>{t("notifications")}</h2>
          <PushNudge
            className="py-2"
            labels={{ text: t("pushNudge"), enable: t("pushEnable") }}
          />
          {SWITCHES.map((field) => (
            <NotificationSwitch
              key={field}
              field={field}
              label={t(`switches.${field}`)}
              hint={t(`switchHints.${field}`, { time })}
              initial={user[field]}
            />
          ))}
        </section>

        <section className={section} aria-label={t("display")}>
          <h2 className={heading}>{t("display")}</h2>
          <ThemeChoice
            label={t("theme")}
            options={(["system", "light", "dark"] as const).map((value) => ({
              value,
              label: t(`themes.${value}`),
            }))}
          />
          <AccountChoice
            field="locale"
            label={t("language")}
            initial={user.locale ?? "fr"}
            options={[
              { value: "fr", label: "Français" },
              { value: "en", label: "English" },
            ]}
          />
          <AccountChoice
            field="currency"
            label={t("currency")}
            initial={user.currency ?? "XOF"}
            options={(["XOF", "EUR", "USD"] as const).map((value) => ({
              value,
              label: t(`currencies.${value}`),
            }))}
          />
        </section>

        <p className="flex flex-wrap gap-x-3 pt-4 text-meta text-muted-foreground">
          <Link href="/cgu" className="underline-offset-4 hover:underline">
            {t("legal.cgu")}
          </Link>
          <Link
            href="/confidentialite"
            className="underline-offset-4 hover:underline"
          >
            {t("legal.privacy")}
          </Link>
          <Link
            href="/mentions-legales"
            className="underline-offset-4 hover:underline"
          >
            {t("legal.notice")}
          </Link>
        </p>
      </div>
    </>
  );
}
