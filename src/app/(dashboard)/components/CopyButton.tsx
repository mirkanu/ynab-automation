'use client';
import { useState } from 'react';

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        fontSize: '0.75rem', padding: '0.25rem 0.625rem',
        backgroundColor: copied ? '#dcfce7' : '#f3f4f6',
        color: copied ? '#166534' : '#374151',
        border: '1px solid ' + (copied ? '#bbf7d0' : '#e5e7eb'),
        borderRadius: '4px', cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
