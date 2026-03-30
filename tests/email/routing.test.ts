import { describe, it } from 'vitest';

describe('getUserFromForwardingAddress', () => {
  it.todo('returns userId when mailboxHash matches a known forwarding address');
  it.todo('returns null for unknown mailboxHash');
  it.todo('returns null for empty or malformed To address');
  it.todo('extracts mailboxHash from full email address (local part before @)');
});
