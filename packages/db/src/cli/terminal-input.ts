import { stdin, stdout } from "node:process";

export type TerminalInput = {
  /** Typed at a terminal: a wrong answer is asked again instead of ending the command. */
  isInteractive: boolean;
  read: (question: string, options?: { hidden?: boolean }) => Promise<string>;
};

/**
 * Answers typed at a terminal — a password echoed as nothing — or piped in
 * one per line (`printf '…' | docker compose exec -T backend …`). Taken
 * from iddia's create-super-admin.
 */
export async function openTerminalInput(): Promise<TerminalInput> {
  if (stdin.isTTY) {
    return { isInteractive: true, read: readTyped };
  }
  const lines = (await readAll()).split(/\r?\n/);
  return {
    isInteractive: false,
    read: (question) => {
      stdout.write(`${question}\n`);
      return Promise.resolve(lines.shift() ?? "");
    },
  };
}

async function readAll(): Promise<string> {
  let text = "";
  stdin.setEncoding("utf8");
  for await (const chunk of stdin) {
    text += chunk;
  }
  return text;
}

function readTyped(
  question: string,
  { hidden = false }: { hidden?: boolean } = {},
): Promise<string> {
  return new Promise((resolve) => {
    let value = "";
    stdout.write(question);
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          stdout.write("\n");
          process.exit(130);
        }
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") {
          if (value) {
            value = value.slice(0, -1);
            if (!hidden) stdout.write("\b \b");
          }
          continue;
        }
        value += char;
        if (!hidden) stdout.write(char);
      }
    };
    stdin.on("data", onData);
  });
}
