import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseOrderEmail } from './claude';

// Mock global fetch used to call the MiniMax chat-completions endpoint
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper: wraps a MiniMax-shaped response body in a fetch Response-like object
function minimaxResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { role: 'assistant', content } }] }),
    text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
  };
}

beforeEach(() => {
  process.env.MINIMAX_API_KEY = 'test-key';
});

const sampleHtml = `
  <html><body>
    <blockquote type="cite">
      <b>From:</b> "Amazon.co.uk" &lt;auto-confirm@amazon.co.uk&gt;
      <p>Thank you for your order!</p>
      <p>Order Date: 15 March 2024</p>
      <p>Order Total: £12.99</p>
      <p>Item: The Pirates' Treasure</p>
    </blockquote>
  </body></html>
`;

const multiItemHtml = `
  <html><body>
    <blockquote type="cite">
      <b>From:</b> "Amazon.co.uk" &lt;auto-confirm@amazon.co.uk&gt;
      <p>Order Total: £25.98</p>
      <p>Items: AirPods case, USB cable</p>
    </blockquote>
  </body></html>
`;

describe('parseOrderEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { amount, description, retailer, currency, date } for a valid single-item order', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 12.99, "description": "The Pirates\' Treasure", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}'));

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(12.99);
    expect(result!.description).toBe("The Pirates' Treasure");
    expect(result!.retailer).toBe('Amazon');
    expect(result!.currency).toBe('GBP');
    expect(result!.date).toBe('2024-03-15');
  });

  it('amount is a number (not a string)', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 12.99, "description": "Some item", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}'));

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).not.toBeNull();
    expect(typeof result!.amount).toBe('number');
  });

  it('returns null (does not throw) when Claude returns malformed JSON', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('This is not valid JSON at all!'));

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).toBeNull();
  });

  it('returns null (does not throw) when Claude API throws an error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).toBeNull();
  });

  it('handles multi-item orders with a summarized description', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 25.98, "description": "2 items: AirPods case, USB cable", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}'));

    const result = await parseOrderEmail(multiItemHtml, 'Alice');

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(25.98);
    // Description should reference multiple items, not just one
    const desc = result!.description.toLowerCase();
    const mentionsMultiple =
      desc.includes('2 items') ||
      desc.includes('items') ||
      (desc.includes('airpods') && desc.includes('usb'));
    expect(mentionsMultiple).toBe(true);
  });

  it('strips markdown code fences when Claude wraps JSON in ```json blocks', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('```json\n{"amount": 12.99, "description": "Test item", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}\n```'));

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(12.99);
    expect(result!.description).toBe('Test item');
  });

  it('returns null when response JSON is missing required fields', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"price": 12.99}'));  // missing amount and description

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).toBeNull();
  });

  it('extracts retailer for non-Amazon orders (Costco)', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 49.99, "description": "24-pack water", "retailer": "Costco", "currency": "GBP", "date": "2024-03-15"}'));

    const result = await parseOrderEmail('<html><body>Costco order</body></html>', 'Alice');

    expect(result).not.toBeNull();
    expect(result!.retailer).toBe('Costco');
    expect(result!.amount).toBe(49.99);
    expect(result!.description).toBe('24-pack water');
  });

  it('returns null when retailer field is missing from Claude response', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 12.99, "description": "some item"}'));

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).toBeNull();
  });

  it('returns currency "EUR" for a Euro-only order email', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 29.99, "description": "Wireless headphones", "retailer": "MediaMarkt", "currency": "EUR", "date": "2024-03-15"}'));

    const result = await parseOrderEmail('<html><body>€29.99 order from MediaMarkt</body></html>', 'Alice');

    expect(result).not.toBeNull();
    expect(result!.currency).toBe('EUR');
    expect(result!.retailer).toBe('MediaMarkt');
  });

  it('returns currency "GBP" when email shows Euro with GBP conversion', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 25.12, "description": "Book", "retailer": "FNAC", "currency": "GBP", "date": "2024-03-15"}'));

    const result = await parseOrderEmail('<html><body>€29.99 (£25.12) order from FNAC</body></html>', 'Alice');

    expect(result).not.toBeNull();
    expect(result!.currency).toBe('GBP');
  });

  it('returns null when currency field is missing from Claude response', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 12.99, "description": "some item", "retailer": "Amazon"}'));

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).toBeNull();
  });

  it('extracts order date from email', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 12.99, "description": "The Pirates\' Treasure", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}'));

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).not.toBeNull();
    expect(result!.date).toBe('2024-03-15');
  });

  it('returns customNote when Claude extracts a top-of-body comment', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 12.99, "description": "book", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15", "customNote": "gift for Sam"}'));

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).not.toBeNull();
    expect(result!.customNote).toBe('gift for Sam');
  });

  it('customNote is undefined when Claude returns an empty string', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 12.99, "description": "book", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15", "customNote": ""}'));

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).not.toBeNull();
    expect(result!.customNote).toBeUndefined();
  });

  it('customNote is undefined when field is omitted from Claude response (backward-compat)', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 12.99, "description": "book", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}'));

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).not.toBeNull();
    expect(result!.customNote).toBeUndefined();
  });

  it('returns null when date field is missing from Claude response', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 12.99, "description": "some item", "retailer": "Amazon", "currency": "GBP"}'));

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).toBeNull();
  });

  it('instructs Claude not to guess an amount when no explicit total is present (truncation guard)', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 0, "description": "some item", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}'));

    await parseOrderEmail(sampleHtml, 'Alice');

    const sentPrompt = JSON.parse(mockFetch.mock.calls[0][1].body as string).messages[1].content as string;
    expect(sentPrompt).toContain('Never guess, estimate, or infer an amount');
    expect(sentPrompt).toContain('return amount: 0');
  });

  it('passes through amount 0 when Claude reports no explicit total found (route layer rejects it downstream)', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 0, "description": "some item", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}'));

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(0);
  });

  it('strips a leading <think>...</think> reasoning block before parsing JSON (MiniMax-M3 is a reasoning model)', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse(
      '<think>The total is £74.99, sold by Amazon.</think>\n\n{"amount": 74.99, "description": "Mattress", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}',
    ));

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(74.99);
    expect(result!.retailer).toBe('Amazon');
  });

  it('returns null when MiniMax API returns a non-2xx status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'credit balance too low',
    });

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).toBeNull();
  });

  it('returns null when MINIMAX_API_KEY is not configured', async () => {
    delete process.env.MINIMAX_API_KEY;

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
