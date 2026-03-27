interface PaginationProps {
  total: number;
  pageSize: number;
  currentPage: number;
  baseParams: Record<string, string>;
}

export default function Pagination({ total, pageSize, currentPage, baseParams }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function buildHref(page: number) {
    const params = new URLSearchParams(baseParams);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return '/logs' + (qs ? '?' + qs : '');
  }

  const linkStyle = (disabled: boolean) => ({
    fontSize: '0.8125rem',
    fontWeight: 500 as const,
    color: disabled ? '#d1d5db' : '#2563eb',
    textDecoration: 'none' as const,
    pointerEvents: (disabled ? 'none' : 'auto') as 'none' | 'auto',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.8125rem', color: '#6b7280' }}>
      <span>Page {currentPage} of {totalPages} ({total} entries)</span>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <a href={buildHref(currentPage - 1)} style={linkStyle(currentPage <= 1)}>
          Previous
        </a>
        <a href={buildHref(currentPage + 1)} style={linkStyle(currentPage >= totalPages)}>
          Next
        </a>
      </div>
    </div>
  );
}
