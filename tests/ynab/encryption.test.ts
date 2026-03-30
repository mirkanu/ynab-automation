import { describe, it, expect, beforeAll } from 'vitest';
import { encryptToken, decryptToken } from '@/lib/crypto';

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = 'test-key-32-bytes-exactly-padded!';
});

describe('encryptToken / decryptToken', () => {
  it('roundtrip: decryptToken(encryptToken(x)) returns original', () => {
    const original = 'ynab_oauth_access_token_abc123';
    const encrypted = encryptToken(original);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(original);
  });

  it('encrypting same string twice produces different ciphertexts (random nonce)', () => {
    const plaintext = 'same-token-value';
    const first = encryptToken(plaintext);
    const second = encryptToken(plaintext);
    expect(first).not.toBe(second);
  });

  it('decryptToken with tampered authTag throws', () => {
    const encrypted = encryptToken('some-token');
    const parts = encrypted.split(':');
    // Tamper with the authTag (3rd segment)
    const tamperedAuthTag = parts[2].split('').reverse().join('');
    const tampered = `${parts[0]}:${parts[1]}:${tamperedAuthTag}`;
    expect(() => decryptToken(tampered)).toThrow();
  });

  it('decryptToken returns exact original string', () => {
    const original = 'exact-string-with-special-chars-!@#$%^&*()';
    const encrypted = encryptToken(original);
    const result = decryptToken(encrypted);
    expect(result).toBe(original);
    expect(typeof result).toBe('string');
  });
});
