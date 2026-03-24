import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mockCreate is available in the vi.mock factory (before hoisting)
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

// Mock the Anthropic SDK — must use function syntax for constructor mocking
vi.mock('@anthropic-ai/sdk', () => {
  function MockAnthropic() {
    return { messages: { create: mockCreate } };
  }
  return { default: MockAnthropic };
});

import { parseOrderEmail } from './claude';

const sampleHtml = `
  <html><body>
    <blockquote type="cite">
      <b>From:</b> "Amazon.co.uk" &lt;auto-confirm@amazon.co.uk&gt;
      <p>Thank you for your order!</p>
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

  it('returns { amount, description, retailer, currency } for a valid single-item order', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"amount": 12.99, "description": "The Pirates\' Treasure", "retailer": "Amazon", "currency": "GBP"}' }],
    });

    const result = await parseOrderEmail(sampleHtml, 'Manuel');

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(12.99);
    expect(result!.description).toBe("The Pirates' Treasure");
    expect(result!.retailer).toBe('Amazon');
    expect(result!.currency).toBe('GBP');
  });

  it('amount is a number (not a string)', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"amount": 12.99, "description": "Some item", "retailer": "Amazon", "currency": "GBP"}' }],
    });

    const result = await parseOrderEmail(sampleHtml, 'Manuel');

    expect(result).not.toBeNull();
    expect(typeof result!.amount).toBe('number');
  });

  it('returns null (does not throw) when Claude returns malformed JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'This is not valid JSON at all!' }],
    });

    const result = await parseOrderEmail(sampleHtml, 'Manuel');

    expect(result).toBeNull();
  });

  it('returns null (does not throw) when Claude API throws an error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const result = await parseOrderEmail(sampleHtml, 'Manuel');

    expect(result).toBeNull();
  });

  it('handles multi-item orders with a summarized description', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"amount": 25.98, "description": "2 items: AirPods case, USB cable", "retailer": "Amazon", "currency": "GBP"}' }],
    });

    const result = await parseOrderEmail(multiItemHtml, 'Manuel');

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
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '```json\n{"amount": 12.99, "description": "Test item", "retailer": "Amazon", "currency": "GBP"}\n```' }],
    });

    const result = await parseOrderEmail(sampleHtml, 'Manuel');

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(12.99);
    expect(result!.description).toBe('Test item');
  });

  it('returns null when response JSON is missing required fields', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"price": 12.99}' }],  // missing amount and description
    });

    const result = await parseOrderEmail(sampleHtml, 'Manuel');

    expect(result).toBeNull();
  });

  it('extracts retailer for non-Amazon orders (Costco)', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"amount": 49.99, "description": "24-pack water", "retailer": "Costco", "currency": "GBP"}' }],
    });

    const result = await parseOrderEmail('<html><body>Costco order</body></html>', 'Manuel');

    expect(result).not.toBeNull();
    expect(result!.retailer).toBe('Costco');
    expect(result!.amount).toBe(49.99);
    expect(result!.description).toBe('24-pack water');
  });

  it('returns null when retailer field is missing from Claude response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"amount": 12.99, "description": "some item"}' }],
    });

    const result = await parseOrderEmail(sampleHtml, 'Manuel');

    expect(result).toBeNull();
  });

  it('returns currency "EUR" for a Euro-only order email', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"amount": 29.99, "description": "Wireless headphones", "retailer": "MediaMarkt", "currency": "EUR"}' }],
    });

    const result = await parseOrderEmail('<html><body>€29.99 order from MediaMarkt</body></html>', 'Manuel');

    expect(result).not.toBeNull();
    expect(result!.currency).toBe('EUR');
    expect(result!.retailer).toBe('MediaMarkt');
  });

  it('returns currency "GBP" when email shows Euro with GBP conversion', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"amount": 25.12, "description": "Book", "retailer": "FNAC", "currency": "GBP"}' }],
    });

    const result = await parseOrderEmail('<html><body>€29.99 (£25.12) order from FNAC</body></html>', 'Manuel');

    expect(result).not.toBeNull();
    expect(result!.currency).toBe('GBP');
  });

  it('returns null when currency field is missing from Claude response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"amount": 12.99, "description": "some item", "retailer": "Amazon"}' }],
    });

    const result = await parseOrderEmail(sampleHtml, 'Manuel');

    expect(result).toBeNull();
  });
});
