'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
}

interface NavSectionConfig {
  key: string;
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSectionConfig[] = [
  {
    key: 'emailAutomation',
    label: 'Email Automation',
    items: [
      { label: 'Activity Log', href: '/email-automation/logs' },
      { label: 'Rules', href: '/email-automation/rules' },
      { label: 'Test & Replay', href: '/email-automation/tools' },
    ],
  },
  {
    key: 'currency',
    label: 'Currency',
    items: [
      { label: 'EUR→GBP Transfers', href: '/currency/transfers' },
      { label: 'EUR Conversion', href: '/currency/conversion' },
      { label: 'EUR Reconciliation', href: '/currency/reconciliation' },
    ],
  },
];

export default function Navigation() {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    emailAutomation: false,
    currency: false,
  });

  function toggleSection(key: string) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <nav style={{
      display: 'flex',
      gap: '1.5rem',
      padding: '0.5rem 1.5rem',
      backgroundColor: '#f9fafb',
      borderBottom: '1px solid #e5e7eb',
      fontSize: '0.8125rem',
      fontWeight: 400,
      alignItems: 'flex-start',
      flexWrap: 'wrap',
    }}>
      <a
        href="/dashboard"
        aria-current={isActive('/dashboard') ? 'page' : undefined}
        style={{
          color: isActive('/dashboard') ? '#111827' : '#374151',
          fontWeight: isActive('/dashboard') ? 700 : 400,
          textDecoration: 'none',
        }}
      >
        Dashboard
      </a>

      {NAV_SECTIONS.map(section => (
        <div key={section.key} style={{ position: 'relative' }}>
          <button
            onClick={() => toggleSection(section.key)}
            aria-expanded={expandedSections[section.key]}
            aria-label={expandedSections[section.key] ? `Collapse ${section.label}` : `Expand ${section.label}`}
            style={{
              background: 'none',
              border: 'none',
              color: '#374151',
              cursor: 'pointer',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.8125rem',
              fontWeight: 400,
            }}
          >
            {section.label}
            <span style={{
              display: 'inline-block',
              transform: expandedSections[section.key] ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              fontSize: '0.625rem',
            }}>▼</span>
          </button>

          {expandedSections[section.key] && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 10,
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderTop: 'none',
              minWidth: '160px',
              padding: '0.25rem 0',
            }}>
              {section.items.map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  style={{
                    display: 'block',
                    padding: '0.375rem 1rem',
                    color: isActive(item.href) ? '#111827' : '#374151',
                    fontWeight: isActive(item.href) ? 700 : 400,
                    fontSize: '0.8125rem',
                    textDecoration: 'none',
                  }}
                >
                  {item.label}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}

      <a
        href="/settings"
        aria-current={isActive('/settings') ? 'page' : undefined}
        style={{
          color: isActive('/settings') ? '#111827' : '#374151',
          fontWeight: isActive('/settings') ? 700 : 400,
          textDecoration: 'none',
        }}
      >
        Settings
      </a>
    </nav>
  );
}
