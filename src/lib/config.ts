export interface SenderConfig {
  email: string;
  name: string;
  accountId: string;
  notificationLabel?: string; // deprecated — name is used instead; kept for backwards compat
}

export interface AppConfig {
  senders: SenderConfig[];
  adminEmail: string;
  currencyAccounts: Record<string, string>; // currency code → YNAB account ID
}

export function loadConfig(): AppConfig {
  const sendersRaw = process.env.SENDERS;
  if (!sendersRaw) throw new Error('SENDERS env var is required');

  let senders: unknown;
  try {
    senders = JSON.parse(sendersRaw);
  } catch {
    throw new Error('SENDERS env var is not valid JSON');
  }

  if (!Array.isArray(senders) || senders.length === 0) {
    throw new Error('SENDERS must be a non-empty JSON array');
  }

  for (const s of senders) {
    if (!s.email || !s.name || !s.accountId) {
      throw new Error(`Each sender must have email, name, and accountId. Got: ${JSON.stringify(s)}`);
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) throw new Error('ADMIN_EMAIL env var is required');

  let currencyAccounts: Record<string, string> = {};
  const currencyRaw = process.env.CURRENCY_ACCOUNTS;
  if (currencyRaw) {
    try {
      currencyAccounts = JSON.parse(currencyRaw) as Record<string, string>;
    } catch {
      throw new Error('CURRENCY_ACCOUNTS env var is not valid JSON');
    }
  }

  return { senders: senders as SenderConfig[], adminEmail, currencyAccounts };
}

export function getSenderByEmail(config: AppConfig, email: string): SenderConfig | null {
  return config.senders.find(s => s.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function getAccountForCurrency(
  config: AppConfig,
  senderAccountId: string,
  currency: string,
): string {
  return config.currencyAccounts[currency] ?? senderAccountId;
}

export function notificationSuffix(sender: SenderConfig): string {
  const label = sender.notificationLabel || sender.name;
  return label ? ` (${label})` : '';
}
