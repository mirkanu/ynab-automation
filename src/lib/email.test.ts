import { describe, it, expect } from 'vitest';
import {
  extractMessageId,
  extractOriginalSender,
  isFromAmazon,
} from './email';

// Minimal valid Pipedream payload matching PAYLOAD.md structure
const validPayload = {
  trigger: {
    event: {
      headers: {
        from: {
          value: [{ address: 'manuelkuhs@gmail.com', name: '' }],
          text: 'manuelkuhs@gmail.com',
        },
        'message-id': '<8A6ECA90-6F2A-432C-977E-F6622E6BF878@gmail.com>',
        subject: "Fwd: Ordered: 'The Pirates' Treasure'",
        to: {
          value: [{ address: 'empk1lk0u08wjyn@upload.pipedream.net', name: '' }],
          text: 'empk1lk0u08wjyn@upload.pipedream.net',
        },
        date: '2026-03-24T10:08:47.000Z',
      },
      body: {
        html: '<html><body><div>See attached</div><blockquote type="cite"><b>From:</b> "Amazon.co.uk" &lt;auto-confirm@amazon.co.uk&gt;<br>Hello, your order...</blockquote></body></html>',
        htmlUrl: 'https://s3.amazonaws.com/fake-url',
      },
      rawUrl: 'https://s3.amazonaws.com/fake-raw-url',
    },
    trace_id: 'trace-123',
  },
};

const nonAmazonPayload = {
  trigger: {
    event: {
      headers: {
        from: {
          value: [{ address: 'friend@gmail.com', name: 'Friend' }],
          text: 'friend@gmail.com',
        },
        'message-id': '<ABC123@gmail.com>',
        subject: 'Hello there',
      },
      body: {
        html: '<html><body><p>Just a regular email from friend@gmail.com</p></body></html>',
      },
    },
  },
};

describe('extractMessageId', () => {
  it('returns the message-id string from a valid payload', () => {
    const result = extractMessageId(validPayload);
    expect(result).toBe('<8A6ECA90-6F2A-432C-977E-F6622E6BF878@gmail.com>');
  });

  it('returns null when message-id is absent', () => {
    const payload = { trigger: { event: { headers: {}, body: { html: '' } } } };
    expect(extractMessageId(payload)).toBeNull();
  });

  it('returns null for empty payload', () => {
    expect(extractMessageId({})).toBeNull();
  });

  it('returns null for null input', () => {
    expect(extractMessageId(null)).toBeNull();
  });
});

describe('extractOriginalSender', () => {
  it('returns the forwarding user email (Manuel) from a valid payload', () => {
    const result = extractOriginalSender(validPayload);
    expect(result).toBe('manuelkuhs@gmail.com');
  });

  it('returns null when from header is absent', () => {
    const payload = { trigger: { event: { headers: {}, body: { html: '' } } } };
    expect(extractOriginalSender(payload)).toBeNull();
  });

  it('returns null for empty payload', () => {
    expect(extractOriginalSender({})).toBeNull();
  });

  it('returns null for null input', () => {
    expect(extractOriginalSender(null)).toBeNull();
  });

  it('does NOT return the Amazon sender — returns the forwarder', () => {
    const result = extractOriginalSender(validPayload);
    expect(result).not.toContain('amazon');
  });
});

describe('isFromAmazon', () => {
  it('returns true when body HTML contains @amazon.co.uk', () => {
    expect(isFromAmazon(validPayload)).toBe(true);
  });

  it('returns false for a non-Amazon email', () => {
    expect(isFromAmazon(nonAmazonPayload)).toBe(false);
  });

  it('returns true when body HTML contains @amazon.com', () => {
    const payload = {
      trigger: {
        event: {
          headers: { 'message-id': '<x@gmail.com>' },
          body: {
            html: '<blockquote><b>From:</b> "Amazon" &lt;ship-confirm@amazon.com&gt;</blockquote>',
          },
        },
      },
    };
    expect(isFromAmazon(payload)).toBe(true);
  });

  it('returns true when body HTML contains @amazon.de', () => {
    const payload = {
      trigger: {
        event: {
          headers: { 'message-id': '<y@gmail.com>' },
          body: {
            html: '<blockquote>From: auto-confirm@amazon.de</blockquote>',
          },
        },
      },
    };
    expect(isFromAmazon(payload)).toBe(true);
  });

  it('returns false when body HTML is absent', () => {
    const payload = { trigger: { event: { headers: {}, body: {} } } };
    expect(isFromAmazon(payload)).toBe(false);
  });

  it('returns false for empty payload', () => {
    expect(isFromAmazon({})).toBe(false);
  });

  it('returns false for null input', () => {
    expect(isFromAmazon(null)).toBe(false);
  });
});
