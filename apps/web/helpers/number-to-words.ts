const ONES = [
  "",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
  "dix-sept",
  "dix-huit",
  "dix-neuf",
] as const;

const TENS = [
  "",
  "",
  "vingt",
  "trente",
  "quarante",
  "cinquante",
  "soixante",
  "soixante",
  "quatre-vingt",
  "quatre-vingt",
] as const;

function belowHundred(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n]!;
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  if (ten === 8) {
    return unit === 0 ? "quatre-vingts" : `quatre-vingt-${ONES[unit]}`;
  }
  if (ten === 7) {
    if (unit === 0) return "soixante-dix";
    if (unit === 1) return "soixante et onze";
    return `soixante-${ONES[10 + unit]}`;
  }
  if (ten === 9) {
    return `quatre-vingt-${ONES[10 + unit]}`;
  }
  if (unit === 0) return TENS[ten]!;
  if (unit === 1) return `${TENS[ten]} et un`;
  return `${TENS[ten]}-${ONES[unit]}`;
}

function belowThousand(n: number): string {
  if (n === 0) return "";
  if (n < 100) return belowHundred(n);
  const hundred = Math.floor(n / 100);
  const remainder = n % 100;
  if (hundred === 1) {
    return remainder === 0 ? "cent" : `cent ${belowHundred(remainder)}`;
  }
  const h = `${ONES[hundred]} cent`;
  return remainder === 0 ? `${h}s` : `${h} ${belowHundred(remainder)}`;
}

function belowMillion(n: number): string {
  if (n < 1_000) return belowThousand(n);
  const thousands = Math.floor(n / 1_000);
  const remainder = n % 1_000;
  const thousandStr =
    thousands === 1 ? "mille" : `${belowThousand(thousands)} mille`;
  return remainder === 0
    ? thousandStr
    : `${thousandStr} ${belowThousand(remainder)}`;
}

export function numberToFrench(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "zéro";
  const negative = n < 0;
  const abs = Math.abs(Math.floor(n));
  const parts: string[] = [];
  const milliards = Math.floor(abs / 1_000_000_000);
  const millions = Math.floor((abs % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((abs % 1_000_000) / 1_000);
  const remainder = abs % 1_000;
  if (milliards > 0) {
    parts.push(
      milliards === 1 ? "un milliard" : `${belowMillion(milliards)} milliards`,
    );
  }
  if (millions > 0) {
    parts.push(
      millions === 1 ? "un million" : `${belowThousand(millions)} millions`,
    );
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? "mille" : `${belowThousand(thousands)} mille`);
  }
  if (remainder > 0) {
    parts.push(belowThousand(remainder));
  }
  const result = parts.join(" ");
  return negative ? `moins ${result}` : result;
}
