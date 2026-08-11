import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseOrderEmail } from './claude';

// Mock the settings module so we can control which LLM_PROVIDER / API keys
// the parser sees without touching the real DB.
const mockGetSetting = vi.fn<(key: string) => Promise<string | undefined>>();

vi.mock('@/lib/settings', () => ({
  getSetting: (key: string) => mockGetSetting(key),
}));

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

// Helper: wraps an Anthropic Messages-shaped response body in a fetch Response-like object
function anthropicResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: 'text', text: content }] }),
    text: async () => JSON.stringify({ content: [{ type: 'text', text: content }] }),
  };
}

// Default DB-setting stub: no LLM_PROVIDER row, no API keys. Individual tests
// override this in `mockGetSetting.mockImplementation(...)` as needed.
beforeEach(() => {
  mockGetSetting.mockReset();
  mockGetSetting.mockImplementation(async (key: string) => {
    if (key === 'MINIMAX_API_KEY') return 'test-key';
    if (key === 'ANTHROPIC_API_KEY') return '';
    if (key === 'LLM_PROVIDER') return undefined; // default → minimax
    return undefined;
  });
  // Keep process.env.MINIMAX_API_KEY set for the env-var fallback path used by
  // the "key missing from DB" branch. Tests that need to assert the key is
  // missing can clear this themselves.
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
    // Both DB setting and env-var fallback must be empty for this guard to fire.
    mockGetSetting.mockImplementation(async () => undefined);
    delete process.env.MINIMAX_API_KEY;

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('parseOrderEmail — provider=anthropic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Override default mock: provider=anthropic, ANTHROPIC key present,
    // MiniMax key present too (so the missing-key guard for anthropic
    // doesn't accidentally trip — anthropic's own key is what matters).
    mockGetSetting.mockImplementation(async (key: string) => {
      if (key === 'LLM_PROVIDER') return 'anthropic';
      if (key === 'ANTHROPIC_API_KEY') return 'sk-ant-test';
      if (key === 'MINIMAX_API_KEY') return 'test-key';
      return undefined;
    });
  });

  it('calls the Anthropic messages endpoint when LLM_PROVIDER=anthropic', async () => {
    mockFetch.mockResolvedValueOnce(anthropicResponse('{"amount": 12.99, "description": "AirPods case", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}'));

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(12.99);
    expect(result!.description).toBe('AirPods case');
    expect(result!.retailer).toBe('Amazon');

    // Verify it routed to the Anthropic endpoint, not MiniMax
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('api.anthropic.com');
    expect(url).not.toContain('api.minimax.io');

    // Verify Anthropic-specific request shape
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['Authorization']).toBeUndefined();

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('claude-3-5-haiku-latest');
    expect(body.max_tokens).toBe(1024);
    expect(body.system).toContain('Extract order information');
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages[0].role).toBe('user');
  });

  it('returns null when ANTHROPIC_API_KEY is missing for provider=anthropic', async () => {
    mockGetSetting.mockImplementation(async (key: string) => {
      if (key === 'LLM_PROVIDER') return 'anthropic';
      if (key === 'ANTHROPIC_API_KEY') return '';
      if (key === 'MINIMAX_API_KEY') return 'test-key';
      return undefined;
    });

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null when Anthropic API returns a non-2xx status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'invalid x-api-key',
    });

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).toBeNull();
  });

  it('strips markdown code fences from Anthropic text blocks', async () => {
    mockFetch.mockResolvedValueOnce(anthropicResponse('```json\n{"amount": 12.99, "description": "Test item", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}\n```'));

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(12.99);
  });

  it('returns null when Anthropic response shape is unexpected (no text block)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: [] }),
      text: async () => JSON.stringify({ content: [] }),
    });

    const result = await parseOrderEmail(sampleHtml, 'Alice');

    expect(result).toBeNull();
  });
});
