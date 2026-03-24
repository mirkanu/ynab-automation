// Claude API integration for parsing Amazon order emails.
// Uses claude-haiku-4-5 for cost-efficient structured extraction.
import Anthropic from '@anthropic-ai/sdk';

export interface ParsedOrder {
  amount: number;       // e.g. 12.99 (in pounds/dollars, NOT milliunits)
  description: string;  // e.g. "AirPods case" or "2 items: AirPods case, USB cable"
}

/**
 * Calls the Claude API to extract order amount and item description
 * from an Amazon order confirmation email HTML body.
 *
 * @param html - Raw HTML string (trigger.event.body.html from Pipedream)
 * @param senderName - Display name of the person who forwarded (e.g. "Manuel")
 * @returns ParsedOrder with amount (number) and description, or null on any failure
 */
export async function parseAmazonEmail(
  html: string,
  senderName: string,
): Promise<ParsedOrder | null> {
  try {
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env at call time

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      system:
        'You are a data extraction assistant. Extract order information from Amazon order confirmation emails. Return ONLY valid JSON with no markdown, no explanation.',
      messages: [
        {
          role: 'user',
          content:
            `Extract the total order amount and a brief item description from this Amazon order email HTML. ` +
            `For multi-item orders, summarize as '2 items: Item1, Item2' (max 2 item names). ` +
            `Return JSON: {"amount": 12.99, "description": "brief description"}. ` +
            `HTML:\n\n${html}`,
        },
      ],
    });

    const textContent = msg.content[0];
    if (!textContent || textContent.type !== 'text') {
      return null;
    }

    const parsed = JSON.parse(textContent.text) as unknown;

    // Validate shape: must have numeric amount and string description
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).amount !== 'number' ||
      typeof (parsed as Record<string, unknown>).description !== 'string'
    ) {
      return null;
    }

    const order = parsed as { amount: number; description: string };

    return {
      amount: order.amount,
      description: order.description,
    };
  } catch {
    // Any failure (API error, JSON parse error, network error) → return null
    return null;
  }
}
