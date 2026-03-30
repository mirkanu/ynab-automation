export type EmailProvider = 'gmail' | 'outlook' | 'apple' | 'other'

export function detectEmailProvider(email: string): EmailProvider {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  if (['gmail.com', 'googlemail.com'].includes(domain)) return 'gmail'
  if (['outlook.com', 'hotmail.com', 'live.com'].includes(domain)) return 'outlook'
  if (['icloud.com', 'me.com', 'mac.com'].includes(domain)) return 'apple'
  return 'other'
}

interface ProviderInstructions {
  title: string
  steps: string[]
  helpUrl: string
}

const INSTRUCTIONS: Record<EmailProvider, ProviderInstructions> = {
  gmail: {
    title: 'Set up forwarding in Gmail',
    helpUrl: 'https://support.google.com/mail/answer/10957',
    steps: [
      'Open Gmail and click the gear icon → See all settings',
      'Click "Forwarding and POP/IMAP" tab',
      'Click "Add a forwarding address" and paste: {address}',
      'Click Next, then Proceed, then OK to confirm',
      'Check your inbox for the verification email from Gmail and click Confirm',
      'Back in Settings, select your forwarding address in the "Forward a copy of incoming mail to" dropdown',
      'Click Save Changes',
    ],
  },
  outlook: {
    title: 'Set up forwarding in Outlook',
    helpUrl: 'https://support.microsoft.com/en-us/office/turn-on-automatic-forwarding-in-outlook-7f2f0867-1d37-4c5d-a791-d12be7da1e5a',
    steps: [
      'Open Outlook and click the gear icon (Settings)',
      'Search for "Forwarding" or go to Mail → Forwarding',
      'Toggle "Enable forwarding" on',
      'Paste your forwarding address: {address}',
      'Optionally check "Keep a copy of forwarded messages"',
      'Click Save',
    ],
  },
  apple: {
    title: 'Set up forwarding in iCloud Mail',
    helpUrl: 'https://support.apple.com/en-gb/guide/icloud/mm6b1a4da6/icloud',
    steps: [
      'Open iCloud.com → Mail, then click the gear icon → Preferences',
      'Click "Rules" → "Add a Rule"',
      'Set condition: "Every Message"',
      'Set action: "Forward to" and paste: {address}',
      'Click Done and confirm',
    ],
  },
  other: {
    title: 'Set up email forwarding',
    helpUrl: 'https://www.google.com/search?q=how+to+set+up+email+forwarding',
    steps: [
      'Open your email provider\'s settings or preferences',
      'Find the "Forwarding" or "Auto-forward" option',
      'Add your forwarding address: {address}',
      'Confirm any verification step your provider requires',
      'Save your settings',
    ],
  },
}

export function getForwardingInstructions(
  provider: EmailProvider,
  forwardingAddress: string,
): ProviderInstructions {
  const template = INSTRUCTIONS[provider]
  return {
    ...template,
    steps: template.steps.map(s => s.replace('{address}', forwardingAddress)),
  }
}
