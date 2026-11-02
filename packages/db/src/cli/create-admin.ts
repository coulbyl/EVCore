import { prisma } from "../client";
import { hashPassword } from "./password";
import { openTerminalInput } from "./terminal-input";
import { ask, askConfirmed, fail } from "./terminal-prompt";

const DEFAULT_FULL_NAME = "EVCore Admin";
// Longer than a player's 8: an admin account reaches every screen.
const ADMIN_PASSWORD_MIN = 12;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creates an admin account, answers typed at the terminal (on the model of
 * iddia's create-super-admin) — run once after the first deployment:
 *
 *   docker compose -f docker-compose.prod.yml exec backend \
 *     node node_modules/@evcore/db/dist/cli/create-admin.js
 *
 * and locally `pnpm --filter @evcore/db create-admin`. Nothing is read from
 * the environment, so no password is ever written to a file. Never touches
 * an existing account.
 */
async function main(): Promise<void> {
  const input = await openTerminalInput();
  console.log("EVCore — création d’un compte admin\n");

  const email = (
    await ask(input, {
      question: "Adresse e-mail : ",
      validate: (value) =>
        EMAIL.test(value) ? null : "Adresse e-mail invalide.",
    })
  ).toLowerCase();
  if (
    await prisma.user.findUnique({ where: { email }, select: { id: true } })
  ) {
    fail("Un compte existe déjà avec cette adresse.");
  }

  const fullName = await ask(input, {
    question: `Nom complet [${DEFAULT_FULL_NAME}] : `,
    validate: (value) =>
      value.length <= 50 ? null : "Nom trop long (50 caractères au plus).",
  }).then((value) => value || DEFAULT_FULL_NAME);

  const password = await askConfirmed(input, {
    question: `Mot de passe (${ADMIN_PASSWORD_MIN} caractères ou plus) : `,
    confirmQuestion: "Confirmez le mot de passe : ",
    mismatchMessage: "Les deux mots de passe diffèrent.",
    validate: (value) =>
      value.length >= ADMIN_PASSWORD_MIN && /\S/.test(value)
        ? null
        : `Mot de passe trop court (${ADMIN_PASSWORD_MIN} caractères ou plus).`,
  });

  await prisma.user.create({
    data: {
      email,
      fullName,
      passwordHash: hashPassword(password),
      role: "ADMIN",
      emailVerified: true,
    },
    select: { id: true },
  });
  console.log(`\nCompte admin créé : ${email}. Il peut se connecter.`);
}

main()
  .catch((error: unknown) => {
    console.error("Création du compte admin impossible");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
