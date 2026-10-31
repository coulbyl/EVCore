/**
 * The text a team search compares, the same on the server (the row's
 * `data-search`) and in the search box: lower case, without accents, so
 * « koln » finds « Köln » and « atletico » « Atlético ».
 */
export function searchKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
