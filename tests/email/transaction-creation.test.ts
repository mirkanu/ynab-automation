import { describe, it } from 'vitest';

describe('POST /api/email/inbound — YNAB transaction creation', () => {
  it.todo('creates YNAB transaction with correct userId when email forwarded to known address');
  it.todo('returns skipped when user has no connected YNAB account');
  it.todo('returns unknown_recipient when mailboxHash not found');
  it.todo('records ProcessedWebhook with status=success after YNAB transaction created');
  it.todo('records ProcessedWebhook with status=skipped when user has no YNAB token');
});
