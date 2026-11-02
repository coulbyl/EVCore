import type { TerminalInput } from "./terminal-input";

/** Asks until the answer is valid — once only when the answers are piped in. */
export async function ask(
  input: TerminalInput,
  options: {
    question: string;
    validate: (value: string) => string | null;
    hidden?: boolean;
    trim?: boolean;
  },
): Promise<string> {
  const { question, validate, hidden = false, trim = true } = options;
  for (;;) {
    const raw = await input.read(question, { hidden });
    const value = trim ? raw.trim() : raw;
    const error = validate(value);
    if (!error) return value;
    retryOrFail(input, error);
  }
}

/** A secret asked twice, hidden, until both answers match. */
export async function askConfirmed(
  input: TerminalInput,
  options: {
    question: string;
    confirmQuestion: string;
    mismatchMessage: string;
    validate: (value: string) => string | null;
  },
): Promise<string> {
  for (;;) {
    const value = await ask(input, {
      question: options.question,
      validate: options.validate,
      hidden: true,
      trim: false,
    });
    const confirmation = await input.read(options.confirmQuestion, {
      hidden: true,
    });
    if (confirmation === value) return value;
    retryOrFail(input, options.mismatchMessage);
  }
}

export function retryOrFail(input: TerminalInput, message: string): void {
  if (!input.isInteractive) fail(message);
  console.error(message);
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
