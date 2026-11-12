// LLM integration for parsing order confirmation emails from any retailer.
// Supports two providers selected at runtime via the LLM_PROVIDER setting:
//   - "minimax" → MiniMax-M3 via the OpenAI-compatible chat-completions endpoint
//   - "anthropic" → Claude 3.5 Haiku via the Anthropic Messages API
//
// The chosen provider is read from the Setting table on every call, so the user
// can switch providers without redeploying.

import { getSetting } from '@/lib/settings'
import { htmlToPlainText } from '@/lib/html-text'

const MINIMAX_API_URL = 'https://api.minimax.io/v1/chat/completions'
const MINIMAX_MODEL = 'MiniMax-M3'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-haiku-5-5'
const ANTHROPIC_VERSION = '2023-06-01'

export interface ParsedOrder {
  amount: number;       // e.g. 12.99 (in pounds/dollars, NOT milliunits)
  description: string;  // e.g. "AirPods case" or "2 items: AirPods case, USB cable"
  retailer: string;     // e.g. "Amazon", "Costco", "Apple"
  currency: string;     // "EUR" if amount is exclusively in Euro with no GBP conversion, otherwise "GBP"
  date: string;         // Order date in YYYY-MM-DD format, or today's date if not found in email
  customNote?: string;  // Optional free-text note the forwarder typed at the very top of the email body
}

/**
 * Why a parse failed.
 *
 * - `quota_exceeded` — the provider's token plan is exhausted (HTTP 429). This is
 *   transient and recoverable: the email must be queued for a retry, NOT dropped.
 * - `api_error` — transport/auth/provider failure. Usually permanent for this call.
 * - `invalid_response` — the provider answered, but the answer was not usable order JSON.
 */
export type ParseFailureReason = 'quota_exceeded' | 'api_error' | 'invalid_response'

export interface ParseSuccess {
  ok: true
  order: ParsedOrder
}

export interface ParseFailure {
  ok: false
  reason: ParseFailureReason
  detail?: string
}

export type ParseResult = ParseSuccess | ParseFailure

// Shared extraction prompt — provider branches differ only in API plumbing, not in
// the instructions we send to the model.
//
// The prompt carries the VISIBLE TEXT of the email, not its raw HTML: the raw body
// is ~119 KB (≈33k prompt tokens) of which only ~1.3 KB is content, and sending the
// raw body is what exhausted the MiniMax token plan.
function buildExtractionPrompt(html: string, referenceDate?: string): string {
  const text = htmlToPlainText(html)
  // Many retailer emails (Amazon included) contain no date anywhere in the body, so the
  // model falls back to the date we give it here. That must be the date the EMAIL ARRIVED,
  // not the date the code happens to be running: a deferred retry parses hours or days
  // later, and "today" would then shift the transaction's date and corrupt budget periods.
  const fallbackDate = referenceDate ?? new Date().toISOString().split('T')[0]
  return (
    `Extract the total order amount, a brief item description, the retailer/merchant name, the currency, the order date, and any custom note from this order confirmation email. ` +
    `For multi-item orders, summarize as '2 items: Item1, Item2' (max 2 item names). ` +
    `For currency: set to "EUR" ONLY if the total amount is exclusively in Euros (€) with no conversion to GBP or another currency shown. ` +
    `If the email shows a Euro amount AND a GBP/sterling equivalent, or if the amount is in any non-Euro currency, set currency to "GBP". ` +
    `For date: extract the order date from the email and format as YYYY-MM-DD. If no date is found, use this date: ${fallbackDate}. ` +
    `For amount: only extract a total that is EXPLICITLY shown as a price/total in the HTML (e.g. "Total: £12.99", "Order total", a line-item price). ` +
    `The email body may be a truncated fragment that cuts off before the pricing section — if so, no real total will appear anywhere in the text. ` +
    `Never guess, estimate, or infer an amount from item names, other numbers (order IDs, quantities), or general knowledge of typical prices. ` +
    `If no explicit total or price is present anywhere in the text, return amount: 0. ` +
    `For customNote: the user sometimes types a short free-text comment at the very top of the email body BEFORE the forwarded order confirmation content (above any "---------- Forwarded message ----------" separator, quoted reply block, or "From:" header). If such a note exists, return its verbatim text (trimmed, single-line). If there is no such note — i.e. the body starts directly with the forwarded content — return an empty string "". Do NOT invent a note from the order content itself. ` +
    `Return JSON: {"amount": 12.99, "description": "brief description", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15", "customNote": ""}. ` +
    `EMAIL TEXT:\n\n${text}`
  )
}

// Validate the JSON shape we expect back from any provider. Returns the cleaned
// ParsedOrder on success, or null if any required field is missing/wrong type.
function parseAndValidate(rawText: string): ParsedOrder | null {
  let cleaned = rawText.trim()

  // Strip markdown code fences providers sometimes add despite prompt instructions
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return null
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).amount !== 'number' ||
    typeof (parsed as Record<string, unknown>).description !== 'string' ||
    typeof (parsed as Record<string, unknown>).retailer !== 'string' ||
    typeof (parsed as Record<string, unknown>).currency !== 'string' ||
    typeof (parsed as Record<string, unknown>).date !== 'string'
  ) {
    return null
  }

  const order = parsed as { amount: number; description: string; retailer: string; currency: string; date: string; customNote?: unknown }
  const rawNote = typeof order.customNote === 'string' ? order.customNote.trim() : ''

  return {
    amount: order.amount,
    description: order.description,
    retailer: order.retailer,
    currency: order.currency,
    date: order.date,
    ...(rawNote ? { customNote: rawNote } : {}),
  }
}

/**
 * Calls the configured LLM provider (LLM_PROVIDER setting) to extract order
 * amount, item description, and retailer name from an order confirmation email
 * HTML body.
 *
 * @param html - Raw HTML string (trigger.event.body.html from Pipedream)
 * @param senderName - Display name of the person who forwarded (e.g. "Alice")
 * @param referenceDate - YYYY-MM-DD date to use when the email itself contains no date.
 *   Callers that re-parse a stored email later (the retry worker, the replay route) MUST
 *   pass the date the email arrived, otherwise the transaction is dated to the moment of
 *   the re-parse instead of the day the order was placed.
 * @returns A discriminated result: `{ ok: true, order }` on success, or
 *          `{ ok: false, reason, detail }` describing WHY the parse failed.
 *          `reason: 'quota_exceeded'` means the provider's token plan is exhausted
 *          and the call should be retried later — never silently dropped.
 */
export async function parseOrderEmail(
  html: string,
  senderName: string,
  referenceDate?: string,
): Promise<ParseResult> {
  try {
    // Read provider choice from DB. Default to "minimax" to preserve existing
    // behavior for installs that pre-date the provider selector.
    const provider = ((await getSetting('LLM_PROVIDER')) ?? 'minimax').toLowerCase()

    // Read both keys up front so we can log a clear error naming the missing key
    // regardless of which provider is active.
    const [anthropicKey, minimaxKey] = await Promise.all([
      getSetting('ANTHROPIC_API_KEY'),
      getSetting('MINIMAX_API_KEY'),
    ])

    if (provider === 'anthropic') {
      if (!anthropicKey) {
        console.error(`parseOrderEmail error: ANTHROPIC_API_KEY not configured for provider=anthropic`)
        return {
          ok: false,
          reason: 'api_error',
          detail: 'ANTHROPIC_API_KEY not configured for provider=anthropic',
        }
      }

      const res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 1024,
          system:
            'You are a data extraction assistant. Extract order information from order confirmation emails from any retailer. Return ONLY valid JSON with no markdown, no explanation.',
          messages: [
            { role: 'user', content: buildExtractionPrompt(html, referenceDate) },
          ],
        }),
      })

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        console.error('parseOrderEmail error: Anthropic API returned', res.status, errBody)
        // The 429 check must come BEFORE the generic non-2xx branch: an exhausted
        // token plan is recoverable, a generic API error is not.
        if (res.status === 429) {
          return { ok: false, reason: 'quota_exceeded', detail: errBody.slice(0, 500) }
        }
        return {
          ok: false,
          reason: 'api_error',
          detail: `HTTP ${res.status}: ${errBody.slice(0, 500)}`,
        }
      }

      const data = (await res.json()) as {
        content?: Array<{ type?: string; text?: string }>
      }
      // Anthropic Messages API returns content as an array of blocks; for non-tool
      // calls the JSON payload lives in the first text block. There is no <think>
      // wrapper and no `choices` array.
      const textBlock = data.content?.find((b) => b?.type === 'text')
      const textContent = textBlock?.text
      if (!textContent) {
        return {
          ok: false,
          reason: 'invalid_response',
          detail: 'no text block in Anthropic response',
        }
      }

      const parsed = parseAndValidate(textContent)
      if (!parsed) {
        return {
          ok: false,
          reason: 'invalid_response',
          detail: 'LLM response was not valid order JSON',
        }
      }
      return { ok: true, order: parsed }
    }

    // Default / "minimax" path — preserves the pre-selector behavior byte-for-byte
    // except the key now comes from the DB Setting instead of process.env.
    const apiKey = minimaxKey ?? process.env.MINIMAX_API_KEY
    if (!apiKey) {
      console.error(`parseOrderEmail error: MINIMAX_API_KEY not configured for provider=${provider}`)
      return {
        ok: false,
        reason: 'api_error',
        detail: `MINIMAX_API_KEY not configured for provider=${provider}`,
      }
    }

    const res = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        temperature: 0,
        // MiniMax-M3 spends tokens on a <think> reasoning block before the JSON answer,
        // so this needs much more headroom than a non-reasoning model would.
        max_tokens: 2048,
        messages: [
          {
            role: 'system',
            content:
              'You are a data extraction assistant. Extract order information from order confirmation emails from any retailer. Return ONLY valid JSON with no markdown, no explanation.',
          },
          {
            role: 'user',
            content: buildExtractionPrompt(html, referenceDate),
          },
        ],
      }),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error('parseOrderEmail error: MiniMax API returned', res.status, errBody)
      // Same ordering rule as the Anthropic branch: 429 means "retry later".
      if (res.status === 429) {
        return { ok: false, reason: 'quota_exceeded', detail: errBody.slice(0, 500) }
      }
      return {
        ok: false,
        reason: 'api_error',
        detail: `HTTP ${res.status}: ${errBody.slice(0, 500)}`,
      }
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const textContent = data.choices?.[0]?.message?.content
    if (!textContent) {
      return {
        ok: false,
        reason: 'invalid_response',
        detail: 'no choices in MiniMax response',
      }
    }

    // MiniMax-M3 is a reasoning model and prefixes its answer with a <think>...</think>
    // block; strip it before looking at the actual JSON payload.
    const rawText = textContent.replace(/<think>[\s\S]*?<\/think>/, '').trim()

    const parsed = parseAndValidate(rawText)
    if (!parsed) {
      return {
        ok: false,
        reason: 'invalid_response',
        detail: 'LLM response was not valid order JSON',
      }
    }
    return { ok: true, order: parsed }
  } catch (err) {
    // Any failure (network error, JSON parse error) → report it as an API error
    console.error('parseOrderEmail error:', err)
    return {
      ok: false,
      reason: 'api_error',
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}

// Backward-compat alias — route.ts uses this name until plan 02 updates it
export const parseAmazonEmail = parseOrderEmail
