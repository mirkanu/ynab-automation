import { describe, it } from 'vitest';

describe('verifyPostmarkIp', () => {
  it.todo('returns true for an IP in the POSTMARK_IPS allowlist');
  it.todo('returns false for an IP not in the allowlist');
  it.todo('returns false when POSTMARK_IPS env var is not set');
  it.todo('handles comma-separated IP list in env var');
});

describe('POST /api/email/inbound — signature verification', () => {
  it.todo('returns 403 when request IP is not in Postmark allowlist');
  it.todo('returns 200 when request IP is in allowlist');
});
