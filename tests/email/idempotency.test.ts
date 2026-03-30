import { describe, it } from 'vitest';

describe('ProcessedWebhook deduplication', () => {
  it.todo('returns skipped status when MessageID already in ProcessedWebhook table');
  it.todo('processes and records webhook when MessageID is new');
  it.todo('second call with same MessageID does not call YNAB API');
  it.todo('concurrent duplicate webhooks (race condition) — only one succeeds via UNIQUE constraint');
});
