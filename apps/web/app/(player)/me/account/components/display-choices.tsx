"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { clsx } from "clsx";
import { playerFetch } from "@/lib/api/player-fetch";

/** A row of choices, one on (theme, language, currency). */
function Choices({
  label,
  options,
  value,
  onChoose,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChoose: (value: string) => void;
}) {
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-2">
      <span className="text-body">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            onClick={() => onChoose(option.value)}
            className={clsx(
              "min-h-10 rounded-full px-3 text-meta font-medium focus-visible:outline-2 focus-visible:outline-ring",
              option.value === value
                ? "bg-led-on text-band"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function noSubscription(): () => void {
  return () => {};
}

/** « Thème » (09 § 5): applied at once, kept on the account. */
export function ThemeChoice({
  label,
  options,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
}) {
  const { theme, setTheme } = useTheme();
  // The theme lives in the browser (next-themes): the server cannot know
  // it, so nothing is lit until hydrated, then the real one is. Lighting
  // « Système » on the server mismatched a browser set to « Clair ».
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  return (
    <Choices
      label={label}
      options={options}
      value={hydrated ? (theme ?? "system") : ""}
      onChoose={(value) => {
        setTheme(value);
        void playerFetch("/auth/me", {
          method: "PATCH",
          body: { theme: value },
        });
      }}
    />
  );
}

/**
 * « Langue » and « Devise » (09 § 5): kept on the account, then the page
 * read again (the language through its cookie as well).
 */
export function AccountChoice({
  field,
  label,
  options,
  initial,
}: {
  field: "locale" | "currency";
  label: string;
  options: readonly { value: string; label: string }[];
  initial: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  return (
    <Choices
      label={label}
      options={options}
      value={value}
      onChoose={async (next) => {
        setValue(next);
        if (field === "locale") {
          document.cookie = `NEXT_LOCALE=${next}; path=/; samesite=lax`;
        }
        try {
          await playerFetch("/auth/me", {
            method: "PATCH",
            body: { [field]: next },
          });
        } finally {
          router.refresh();
        }
      }}
    />
  );
}
