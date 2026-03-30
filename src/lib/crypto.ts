import * as nodeCrypto from 'crypto';

function getDerivedKey(): Buffer {
  const rawKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!rawKey || rawKey.length < 32) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY env var is missing or shorter than 32 characters'
    );
  }
  // Deterministic 32-byte key derivation via SHA-256
  return nodeCrypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypts a plaintext token using AES-256-GCM.
 * Returns a string in the format: `{nonce_hex}:{ciphertext_hex}:{authTag_hex}`
 * Each call produces a different ciphertext due to a random 12-byte nonce.
 */
export function encryptToken(plaintext: string): string {
  const derivedKey = getDerivedKey();
  const nonce = nodeCrypto.randomBytes(12);
  const cipher = nodeCrypto.createCipheriv('aes-256-gcm', derivedKey, nonce);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${nonce.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
}

/**
 * Decrypts a ciphertext produced by encryptToken.
 * Throws if the ciphertext is tampered with or malformed.
 * Never exposes plaintext in error messages.
 */
export function decryptToken(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Decryption failed');
  }
  const [nonceHex, encryptedHex, authTagHex] = parts;
  try {
    const derivedKey = getDerivedKey();
    const nonce = Buffer.from(nonceHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = nodeCrypto.createDecipheriv(
      'aes-256-gcm',
      derivedKey,
      nonce
    );
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error('Decryption failed');
  }
}
