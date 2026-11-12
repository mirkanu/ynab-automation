import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseOrderEmail, type ParseResult } from './claude';

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

// Narrowing helper: returns the parsed order, failing loudly if the parse failed.
function expectOrder(result: ParseResult) {
  if (!result.ok) {
    throw new Error(`expected a successful parse, got ${result.reason}: ${result.detail ?? ''}`);
  }
  return result.order;
}

// Narrowing helper: returns the failure, failing loudly if the parse succeeded.
function expectFailure(result: ParseResult) {
  if (result.ok) {
    throw new Error(`expected a failed parse, got a successful order: ${JSON.stringify(result.order)}`);
  }
  return result;
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

    const order = expectOrder(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(order.amount).toBe(12.99);
    expect(order.description).toBe("The Pirates' Treasure");
    expect(order.retailer).toBe('Amazon');
    expect(order.currency).toBe('GBP');
    expect(order.date).toBe('2024-03-15');
  });

  it('amount is a number (not a string)', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 12.99, "description": "Some item", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}'));

    const order = expectOrder(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(typeof order.amount).toBe('number');
  });

  it('returns invalid_response (does not throw) when Claude returns malformed JSON', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('This is not valid JSON at all!'));

    const result = expectFailure(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(result.reason).toBe('invalid_response');
  });

  it('returns api_error (does not throw) when Claude API throws an error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const result = expectFailure(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(result.reason).toBe('api_error');
    expect(result.detail).toContain('API rate limit exceeded');
  });

  it('handles multi-item orders with a summarized description', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 25.98, "description": "2 items: AirPods case, USB cable", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}'));

    const order = expectOrder(await parseOrderEmail(multiItemHtml, 'Alice'));

    expect(order.amount).toBe(25.98);
    // Description should reference multiple items, not just one
    const desc = order.description.toLowerCase();
    const mentionsMultiple =
      desc.includes('2 items') ||
      desc.includes('items') ||
      (desc.includes('airpods') && desc.includes('usb'));
    expect(mentionsMultiple).toBe(true);
  });

  it('strips markdown code fences when Claude wraps JSON in ```json blocks', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('```json\n{"amount": 12.99, "description": "Test item", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}\n```'));

    const order = expectOrder(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(order.amount).toBe(12.99);
    expect(order.description).toBe('Test item');
  });

  it('returns invalid_response when response JSON is missing required fields', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"price": 12.99}'));  // missing amount and description

    const result = expectFailure(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(result.reason).toBe('invalid_response');
  });

  it('extracts retailer for non-Amazon orders (Costco)', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 49.99, "description": "24-pack water", "retailer": "Costco", "currency": "GBP", "date": "2024-03-15"}'));

    const order = expectOrder(await parseOrderEmail('<html><body>Costco order</body></html>', 'Alice'));

    expect(order.retailer).toBe('Costco');
    expect(order.amount).toBe(49.99);
    expect(order.description).toBe('24-pack water');
  });

  it('returns invalid_response when retailer field is missing from Claude response', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 12.99, "description": "some item"}'));

    const result = expectFailure(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(result.reason).toBe('invalid_response');
  });

  it('returns currency "EUR" for a Euro-only order email', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 29.99, "description": "Wireless headphones", "retailer": "MediaMarkt", "currency": "EUR", "date": "2024-03-15"}'));

    const order = expectOrder(await parseOrderEmail('<html><body>€29.99 order from MediaMarkt</body></html>', 'Alice'));

    expect(order.currency).toBe('EUR');
    expect(order.retailer).toBe('MediaMarkt');
  });

  it('returns currency "GBP" when email shows Euro with GBP conversion', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 25.12, "description": "Book", "retailer": "FNAC", "currency": "GBP", "date": "2024-03-15"}'));

    const order = expectOrder(await parseOrderEmail('<html><body>€29.99 (£25.12) order from FNAC</body></html>', 'Alice'));

    expect(order.currency).toBe('GBP');
  });

  it('returns invalid_response when currency field is missing from Claude response', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 12.99, "description": "some item", "retailer": "Amazon"}'));

    const result = expectFailure(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(result.reason).toBe('invalid_response');
  });

  it('extracts order date from email', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 12.99, "description": "The Pirates\' Treasure", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}'));

    const order = expectOrder(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(order.date).toBe('2024-03-15');
  });

  it('returns customNote when Claude extracts a top-of-body comment', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 12.99, "description": "book", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15", "customNote": "gift for Sam"}'));

    const order = expectOrder(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(order.customNote).toBe('gift for Sam');
  });

  it('customNote is undefined when Claude returns an empty string', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 12.99, "description": "book", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15", "customNote": ""}'));

    const order = expectOrder(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(order.customNote).toBeUndefined();
  });

  it('customNote is undefined when field is omitted from Claude response (backward-compat)', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 12.99, "description": "book", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}'));

    const order = expectOrder(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(order.customNote).toBeUndefined();
  });

  it('returns invalid_response when date field is missing from Claude response', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 12.99, "description": "some item", "retailer": "Amazon", "currency": "GBP"}'));

    const result = expectFailure(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(result.reason).toBe('invalid_response');
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

    const order = expectOrder(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(order.amount).toBe(0);
  });

  it('strips a leading <think>...</think> reasoning block before parsing JSON (MiniMax-M3 is a reasoning model)', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse(
      '<think>The total is £74.99, sold by Amazon.</think>\n\n{"amount": 74.99, "description": "Mattress", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}',
    ));

    const order = expectOrder(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(order.amount).toBe(74.99);
    expect(order.retailer).toBe('Amazon');
  });

  it('returns api_error when MiniMax API returns a non-2xx status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'credit balance too low',
    });

    const result = expectFailure(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(result.reason).toBe('api_error');
    expect(result.detail).toContain('credit balance too low');
  });

  it('returns quota_exceeded when MiniMax API returns HTTP 429', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Token Plan usage limit reached',
    });

    const result = expectFailure(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(result.reason).toBe('quota_exceeded');
    expect(result.detail).toContain('Token Plan usage limit reached');
  });

  it('returns api_error when MINIMAX_API_KEY is not configured', async () => {
    // Both DB setting and env-var fallback must be empty for this guard to fire.
    mockGetSetting.mockImplementation(async () => undefined);
    delete process.env.MINIMAX_API_KEY;

    const result = expectFailure(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(result.reason).toBe('api_error');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends a trimmed prompt — no raw HTML/CSS, but the visible text survives', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 16.5, "description": "Southern Comfort Original", "retailer": "Amazon", "currency": "GBP", "date": "2026-11-10"}'));

    const css = 'x'.repeat(5000);
    const html = `<html><head><style>${css}</style></head><body><p>Total £16.50</p></body></html>`;

    await parseOrderEmail(html, 'Alice');

    const sentPrompt = JSON.parse(mockFetch.mock.calls[0][1].body as string).messages[1].content as string;

    // The CSS block and its markup never reach the model.
    expect(sentPrompt).not.toContain('<style');
    expect(sentPrompt).not.toContain(css);
    // The visible text does.
    expect(sentPrompt).toContain('Total £16.50');
    // The email payload carried by the prompt is tiny compared to the raw body.
    const payload = sentPrompt.split('EMAIL TEXT:\n\n')[1] ?? '';
    expect(payload.length).toBeLessThan(100);
  });

  it('uses the caller-supplied reference date as the "no date in the email" fallback', async () => {
    // A deferred retry re-parses an email hours or days later. The email itself carries no
    // date, so the model must fall back to the date the email ARRIVED — not to today.
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 16.5, "description": "Southern Comfort Original", "retailer": "Amazon", "currency": "GBP", "date": "2026-11-10"}'));

    await parseOrderEmail(sampleHtml, 'Emily-Kate', '2026-11-10');

    const sentPrompt = JSON.parse(mockFetch.mock.calls[0][1].body as string).messages[1].content as string;

    expect(sentPrompt).toContain('use this date: 2026-11-10');
    expect(sentPrompt).not.toContain("use today's date");
  });

  it('falls back to today when no reference date is supplied', async () => {
    mockFetch.mockResolvedValueOnce(minimaxResponse('{"amount": 16.5, "description": "d", "retailer": "Amazon", "currency": "GBP", "date": "2026-11-12"}'));

    await parseOrderEmail(sampleHtml, 'Alice');

    const sentPrompt = JSON.parse(mockFetch.mock.calls[0][1].body as string).messages[1].content as string;
    const today = new Date().toISOString().split('T')[0];

    expect(sentPrompt).toContain(`use this date: ${today}`);
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

    const order = expectOrder(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(order.amount).toBe(12.99);
    expect(order.description).toBe('AirPods case');
    expect(order.retailer).toBe('Amazon');

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
    expect(body.model).toBe('claude-haiku-5-5');
    expect(body.max_tokens).toBe(1024);
    expect(body.system).toContain('Extract order information');
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages[0].role).toBe('user');
  });

  it('returns api_error when ANTHROPIC_API_KEY is missing for provider=anthropic', async () => {
    mockGetSetting.mockImplementation(async (key: string) => {
      if (key === 'LLM_PROVIDER') return 'anthropic';
      if (key === 'ANTHROPIC_API_KEY') return '';
      if (key === 'MINIMAX_API_KEY') return 'test-key';
      return undefined;
    });

    const result = expectFailure(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(result.reason).toBe('api_error');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns api_error when Anthropic API returns a non-2xx status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'invalid x-api-key',
    });

    const result = expectFailure(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(result.reason).toBe('api_error');
  });

  it('returns quota_exceeded when Anthropic API returns HTTP 429', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'rate limit exceeded',
    });

    const result = expectFailure(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(result.reason).toBe('quota_exceeded');
    expect(result.detail).toContain('rate limit exceeded');
  });

  it('strips markdown code fences from Anthropic text blocks', async () => {
    mockFetch.mockResolvedValueOnce(anthropicResponse('```json\n{"amount": 12.99, "description": "Test item", "retailer": "Amazon", "currency": "GBP", "date": "2024-03-15"}\n```'));

    const order = expectOrder(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(order.amount).toBe(12.99);
  });

  it('returns invalid_response when Anthropic response shape is unexpected (no text block)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: [] }),
      text: async () => JSON.stringify({ content: [] }),
    });

    const result = expectFailure(await parseOrderEmail(sampleHtml, 'Alice'));

    expect(result.reason).toBe('invalid_response');
    expect(result.detail).toBe('no text block in Anthropic response');
  });
});
