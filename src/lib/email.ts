// Email parsing utilities for Pipedream webhook payloads.
// All functions are pure — no side effects, no DB calls.
// Field paths derived from .planning/phases/02-email-inflow/PAYLOAD.md

export interface PipedreamPayload {
  trigger?: {
    event?: {
      headers?: {
        from?: {
          value?: Array<{ address?: string; name?: string }>;
          text?: string;
        };
        'message-id'?: string;
        subject?: string;
        to?: {
          value?: Array<{ address?: string; name?: string }>;
          text?: string;
        };
        date?: string;
        references?: string;
        'return-path'?: Array<{ value?: Array<{ address?: string }>; text?: string }>;
        [key: string]: unknown;
      };
      body?: {
        html?: string;
        htmlUrl?: string;
      };
      rawUrl?: string;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Extracts the Message-ID from a Pipedream payload.
 * Path: trigger.event.headers["message-id"]
 * Returns the message ID string, or null if absent/malformed.
 */
export function extractMessageId(payload: unknown): string | null {
  try {
    const p = payload as PipedreamPayload;
    const messageId = p?.trigger?.event?.headers?.['message-id'];
    if (typeof messageId === 'string' && messageId.length > 0) {
      return messageId;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts the original sender (the person who forwarded the email to Pipedream).
 * This is the forwarding user (Manuel or Emily-Kate), not Amazon.
 * Path: trigger.event.headers.from.value[0].address
 * Falls back to trigger.event.headers.from.text if value array is absent.
 * Returns the email address string, or null if not found.
 */
export function extractOriginalSender(payload: unknown): string | null {
  try {
    const p = payload as PipedreamPayload;
    const fromHeader = p?.trigger?.event?.headers?.from;
    if (!fromHeader) return null;

    // Prefer structured value array (most reliable)
    const address = fromHeader.value?.[0]?.address;
    if (typeof address === 'string' && address.length > 0) {
      return address;
    }

    // Fall back to text form
    const text = fromHeader.text;
    if (typeof text === 'string' && text.length > 0) {
      return text.trim();
    }

    return null;
  } catch {
    return null;
  }
}

// Amazon domain patterns to match against body HTML
const AMAZON_DOMAIN_PATTERNS = [
  /@amazon\.co\.uk/i,
  /@amazon\.com/i,
  /@amazon\.de/i,
  /@amazon\.fr/i,
  /@amazon\.it/i,
  /@amazon\.es/i,
  /@amazon\.co\.jp/i,
  /@amazon\.ca/i,
  /@amazon\.com\.au/i,
];

/**
 * Determines if an email in the Pipedream payload originated from Amazon.
 * Since the email is forwarded, the original Amazon sender appears only in
 * the body HTML (inside a blockquote), not in the top-level `from` header.
 * Scans trigger.event.body.html for known Amazon email domain patterns.
 * Returns true if an Amazon sender is detected, false otherwise.
 */
export function isFromAmazon(payload: unknown): boolean {
  try {
    const p = payload as PipedreamPayload;
    const html = p?.trigger?.event?.body?.html;
    if (typeof html !== 'string' || html.length === 0) {
      return false;
    }

    return AMAZON_DOMAIN_PATTERNS.some((pattern) => pattern.test(html));
  } catch {
    return false;
  }
}
