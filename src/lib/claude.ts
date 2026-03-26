// Claude API integration for parsing order confirmation emails from any retailer.
// Uses claude-haiku-4-5 for cost-efficient structured extraction.
import Anthropic from '@anthropic-ai/sdk';

export interface ParsedOrder {
  amount: number;       // e.g. 12.99 (in pounds/dollars, NOT milliunits)
  description: string;  // e.g. "AirPods case" or "2 items: AirPods case, USB cable"
  retailer: string;     // e.g. "Amazon", "Costco", "Apple"
  currency: string;     // "EUR" if amount is exclusively in Euro with no GBP conversion, otherwise "GBP"
  date: string;         // Order date in YYYY-MM-DD format, or today's date if not found in email
}

/**
 * Calls the Claude API to extract order amount, item description, and retailer name
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
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env at call time

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system:
        'You are a data extraction assistant. Extract order information from order confirmation emails from any retailer. Return ONLY valid JSON with no markdown, no explanation.',
      messages: [
        {
          role: 'user',
          content:
            `Extract the total order amount, a brief item description, the retailer/merchant name, the currency, and the order date from this order confirmation email HTML. ` +
            `For multi-item orders, summarize as '2 items: Item1, Item2' (max 2 item names). ` +
            `For currency: set to "EUR" ONLY if the total amount is exclusively in Euros (€) with no conversion to GBP or another currency shown. ` +
            `If the email shows a Euro amount AND a GBP/sterling equivalent, or if the amount is in any non-Euro currency, set currency to "GBP". ` +
            `For date: extract the order date from the email and format as YYYY-MM-DD. If no date is found, use today's date: ${new Date().toISOString().split('T')[0]}. ` +
            `Return JSON: {"amount": 12.99, "description": "brief description", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}. ` +
            `HTML:\n\n${html}`,
        },
      ],
    });

    const textContent = msg.content[0];
    if (!textContent || textContent.type !== 'text') {
      return null;
    }

    // Strip markdown code fences Claude sometimes adds despite prompt instructions
    let rawText = textContent.text.trim();
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

    const order = parsed as { amount: number; description: string; retailer: string; currency: string; date: string };

    return {
      amount: order.amount,
      description: order.description,
      retailer: order.retailer,
      currency: order.currency,
      date: order.date,
    };
  } catch (err) {
    // Any failure (API error, JSON parse error, network error) → return null
    console.error('parseOrderEmail error:', err);
    return null;
  }
}

// Backward-compat alias — route.ts uses this name until plan 02 updates it
export const parseAmazonEmail = parseOrderEmail;
