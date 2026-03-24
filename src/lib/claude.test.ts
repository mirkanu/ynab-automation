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

import { parseAmazonEmail } from './claude';

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

describe('parseAmazonEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { amount: number, description: string } for a valid single-item order', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"amount": 12.99, "description": "The Pirates\' Treasure"}' }],
    });

    const result = await parseAmazonEmail(sampleHtml, 'Manuel');

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(12.99);
    expect(result!.description).toBe("The Pirates' Treasure");
  });

  it('amount is a number (not a string)', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"amount": 12.99, "description": "Some item"}' }],
    });

    const result = await parseAmazonEmail(sampleHtml, 'Manuel');

    expect(result).not.toBeNull();
    expect(typeof result!.amount).toBe('number');
  });

  it('returns null (does not throw) when Claude returns malformed JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'This is not valid JSON at all!' }],
    });

    const result = await parseAmazonEmail(sampleHtml, 'Manuel');

    expect(result).toBeNull();
  });

  it('returns null (does not throw) when Claude API throws an error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const result = await parseAmazonEmail(sampleHtml, 'Manuel');

    expect(result).toBeNull();
  });

  it('handles multi-item orders with a summarized description', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"amount": 25.98, "description": "2 items: AirPods case, USB cable"}' }],
    });

    const result = await parseAmazonEmail(multiItemHtml, 'Manuel');

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

  it('returns null when response JSON is missing required fields', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"price": 12.99}' }],  // missing amount and description
    });

    const result = await parseAmazonEmail(sampleHtml, 'Manuel');

    expect(result).toBeNull();
  });
});
