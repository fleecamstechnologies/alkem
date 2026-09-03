/**
 * Turn a user phrase into a safe MySQL BOOLEAN MODE FULLTEXT query with prefix
 * match:  "ashok med"  ->  "+ashok* +med*"
 *
 * Tokens shorter than the InnoDB minimum token size (default 3) are dropped; if
 * nothing survives we return '' and the caller should fall back to a prefix LIKE.
 */
export function toBooleanFulltextQuery(input: string): string {
  const tokens = input
    .toLowerCase()
    .replace(/[+\-><()~*"@]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return '';
  return tokens.map((t) => `+${t}*`).join(' ');
}
