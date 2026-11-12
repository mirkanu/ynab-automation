// Converts an order-confirmation email's raw HTML body into the visible plain
// text that the LLM parser actually needs.
//
// WHY THIS EXISTS
// ---------------
// The parser used to receive the raw HTML body of every forwarded email. A
// typical Amazon order confirmation body is ~119 KB, of which ~59 KB is
// `<style>` CSS and another large slice is `<!--[if mso]>` conditional
// comments. Sending that to the model costs roughly 33k prompt tokens to
// extract about 1.5k tokens of actual content — and that waste is what
// exhausted the MiniMax token plan on 2026-11-10/11, losing three orders.
//
// Measured on the real body of ActivityLog id 339:
//   raw body  : 119,433 chars
//   plain text:   1,299 chars  (98.9% smaller)
// The visible text still carries the total (£16.50), the order number
// (202-9090378-7968332), the order date, the currency symbol, the retailer
// (Amazon.co.uk) and the forwarder's typed note.
//
// This module is a pure function — no I/O, no dependencies.

/**
 * Named HTML entities we decode explicitly.
 *
 * Visible characters map to their character; formatting-only entities
 * (soft hyphen, zero-width joiners, …) map to an empty string because they
 * carry no meaning for a human reader but do cost tokens.
 */
const NAMED_ENTITIES: Record<string, string> = {
  // Core markup characters
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  // Spaces
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  // Currency
  pound: '£',
  euro: '€',
  cent: '¢',
  yen: '¥',
  dollar: '$',
  // Symbols
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  bull: '•',
  middot: '·',
  deg: '°',
  plusmn: '±',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  times: '×',
  divide: '÷',
  laquo: '«',
  raquo: '»',
  sect: '§',
  para: '¶',
  dagger: '†',
  Dagger: '‡',
  permil: '‰',
  prime: '′',
  Prime: '″',
  larr: '←',
  rarr: '→',
  harr: '↔',
  // Invisible / formatting-only — dropped
  shy: '',
  zwnj: '',
  zwj: '',
  zwnspace: '',
  ZeroWidthSpace: '',
  hairsp: '',
  numsp: '',
  puncsp: '',
};

// Block-level elements whose open AND close tags become a line break.
const BLOCK_TAGS =
  'p|div|li|tr|h[1-6]|table|section|article|header|footer|ul|ol|blockquote|pre|hr|td|th|figure|address';

// Unicode space separators (NBSP, ogham space, en/em quad … ideographic space).
const UNICODE_SPACES = /[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g;

// Zero-width and invisible formatting characters (soft hyphen, combining
// grapheme joiner, ZWSP/ZWJ/bidi marks, word joiner, BOM).
const INVISIBLE_CHARS = /[\u00ad\u034f\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g;

/**
 * Converts an HTML string to its visible plain text.
 *
 * The steps run in a fixed order — decoding entities before stripping tags
 * would let an escaped `&lt;script&gt;` become a live tag, and stripping tags
 * before decoding would leave `&amp;lt;` half-decoded.
 *
 * @param html - Raw HTML body of an email
 * @returns The visible text, with entities decoded and whitespace collapsed
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';

  let s = html;

  // 1. Drop <style> blocks (the bulk of the token cost — inline CSS).
  s = s.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');

  // 2. Drop <script> blocks.
  s = s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');

  // 3. Drop HTML comments — includes the ~12 KB of `<!--[if mso]>` blocks.
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');

  // 4. <br> becomes a line break.
  s = s.replace(/<br\s*\/?>/gi, '\n');

  // 5. Block-level open and close tags become line breaks.
  s = s.replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi'), '\n');

  // 6. Strip every remaining tag.
  s = s.replace(/<[^>]+>/g, '');

  // 7. Decode named entities. Unknown names are kept verbatim — dropping an
  //    unknown entity would silently lose characters (e.g. `&eacute;`).
  s = s.replace(/&([a-zA-Z][a-zA-Z0-9]{0,10});/g, (match, name: string) => {
    const mapped = NAMED_ENTITIES[name];
    return mapped === undefined ? match : mapped;
  });

  // 8. Decode numeric decimal and hex entities.
  s = s.replace(/&#(\d{1,7});/g, (match, code: string) => {
    const n = Number(code);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
  });
  s = s.replace(/&#x([0-9a-fA-F]{1,6});/g, (match, code: string) => {
    const n = parseInt(code, 16);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
  });

  // 9. Unicode space separators become a plain space.
  s = s.replace(UNICODE_SPACES, ' ');

  // 10. Zero-width and invisible formatting characters are removed.
  s = s.replace(INVISIBLE_CHARS, '');

  // 11. Collapse whitespace.
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/ *\n */g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');

  return s.trim();
}
