// MiniMax API integration for parsing order confirmation emails from any retailer.
// Uses the MiniMax-M3 chat-completions endpoint (OpenAI-compatible request/response shape).

const MINIMAX_API_URL = 'https://api.minimax.io/v1/chat/completions';
const MINIMAX_MODEL = 'MiniMax-M3';

export interface ParsedOrder {
  amount: number;       // e.g. 12.99 (in pounds/dollars, NOT milliunits)
  description: string;  // e.g. "AirPods case" or "2 items: AirPods case, USB cable"
  retailer: string;     // e.g. "Amazon", "Costco", "Apple"
  currency: string;     // "EUR" if amount is exclusively in Euro with no GBP conversion, otherwise "GBP"
  date: string;         // Order date in YYYY-MM-DD format, or today's date if not found in email
  customNote?: string;  // Optional free-text note the forwarder typed at the very top of the email body
}

/**
 * Calls the MiniMax API to extract order amount, item description, and retailer name
 * from an order confirmation email HTML body.
 *
 * @param html - Raw HTML string (trigger.event.body.html from Pipedream)
 * @param senderName - Display name of the person who forwarded (e.g. "Alice")
 * @returns ParsedOrder with amount (number), description, and retailer, or null on any failure
 */
export async function parseOrderEmail(
  html: string,
  senderName: string,
): Promise<ParsedOrder | null> {
  try {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      console.error('parseOrderEmail error: MINIMAX_API_KEY not configured');
      return null;
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
            content:
              `Extract the total order amount, a brief item description, the retailer/merchant name, the currency, the order date, and any custom note from this order confirmation email HTML. ` +
              `For multi-item orders, summarize as '2 items: Item1, Item2' (max 2 item names). ` +
              `For currency: set to "EUR" ONLY if the total amount is exclusively in Euros (€) with no conversion to GBP or another currency shown. ` +
              `If the email shows a Euro amount AND a GBP/sterling equivalent, or if the amount is in any non-Euro currency, set currency to "GBP". ` +
              `For date: extract the order date from the email and format as YYYY-MM-DD. If no date is found, use today's date: ${new Date().toISOString().split('T')[0]}. ` +
              `For amount: only extract a total that is EXPLICITLY shown as a price/total in the HTML (e.g. "Total: £12.99", "Order total", a line-item price). ` +
              `The email body may be a truncated fragment that cuts off before the pricing section — if so, no real total will appear anywhere in the text. ` +
              `Never guess, estimate, or infer an amount from item names, other numbers (order IDs, quantities, CSS/class values), or general knowledge of typical prices. ` +
              `If no explicit total or price is present anywhere in the HTML, return amount: 0. ` +
              `For customNote: the user sometimes types a short free-text comment at the very top of the email body BEFORE the forwarded order confirmation content (above any "---------- Forwarded message ----------" separator, quoted reply block, or "From:" header). If such a note exists, return its verbatim text (trimmed, single-line). If there is no such note — i.e. the body starts directly with the forwarded content — return an empty string "". Do NOT invent a note from the order content itself. ` +
              `Return JSON: {"amount": 12.99, "description": "brief description", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15", "customNote": ""}. ` +
              `HTML:\n\n${html}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('parseOrderEmail error: MiniMax API returned', res.status, errBody);
      return null;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const textContent = data.choices?.[0]?.message?.content;
    if (!textContent) {
      return null;
    }

    // MiniMax-M3 is a reasoning model and prefixes its answer with a <think>...</think>
    // block; strip it before looking at the actual JSON payload.
    let rawText = textContent.replace(/<think>[\s\S]*?<\/think>/, '').trim();

    // Strip markdown code fences MiniMax sometimes adds despite prompt instructions
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
    }

    const parsed = JSON.parse(rawText) as unknown;

    // Validate shape: must have numeric amount, string description, string retailer, string currency, and string date
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).amount !== 'number' ||
      typeof (parsed as Record<string, unknown>).description !== 'string' ||
      typeof (parsed as Record<string, unknown>).retailer !== 'string' ||
      typeof (parsed as Record<string, unknown>).currency !== 'string' ||
      typeof (parsed as Record<string, unknown>).date !== 'string'
    ) {
      return null;
    }

    const order = parsed as { amount: number; description: string; retailer: string; currency: string; date: string; customNote?: unknown };

    const rawNote = typeof order.customNote === 'string' ? order.customNote.trim() : '';

    return {
      amount: order.amount,
      description: order.description,
      retailer: order.retailer,
      currency: order.currency,
      date: order.date,
      ...(rawNote ? { customNote: rawNote } : {}),
    };
  } catch (err) {
    // Any failure (network error, JSON parse error) → return null
    console.error('parseOrderEmail error:', err);
    return null;
  }
}

// Backward-compat alias — route.ts uses this name until plan 02 updates it
export const parseAmazonEmail = parseOrderEmail;
