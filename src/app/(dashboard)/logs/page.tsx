import { getActivityLogs } from '@/lib/activity-log-queries';
import { loadDbSettings } from '@/lib/settings';
import LogFilters from '../components/LogFilters';
import LogRow from '../components/LogRow';
import Pagination from '../components/Pagination';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LogsPage({ searchParams }: Props) {
  await loadDbSettings();
  const testMode = process.env.TEST_MODE === 'true';
  const params = await searchParams;
  const status = typeof params.status === 'string' ? params.status : undefined;
  const from = typeof params.from === 'string' ? params.from : undefined;
  const to = typeof params.to === 'string' ? params.to : undefined;
  const page = typeof params.page === 'string' ? Math.max(1, parseInt(params.page, 10) || 1) : 1;

  const { logs, total, pageSize } = await getActivityLogs({ status, from, to, page });

  const baseParams: Record<string, string> = {};
  if (status) baseParams.status = status;
  if (from) baseParams.from = from;
  if (to) baseParams.to = to;

  return (
    <div>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', margin: '0 0 1.25rem' }}>
        Activity Log
      </h1>

      <LogFilters />

      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}>
        {logs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No activity logs {status || from || to ? 'matching filters' : 'yet'}
          </div>
        ) : (
          logs.map(log => (
            <LogRow
              key={log.id}
              testMode={testMode}
              entry={{
                id: log.id,
                messageId: log.messageId,
                status: log.status,
                sender: log.sender,
                subject: log.subject,
                receivedAt: log.receivedAt.toISOString(),
                rawBody: log.rawBody,
                parseResult: log.parseResult as Record<string, unknown> | null,
                ynabResult: log.ynabResult as Record<string, unknown> | null,
                errorType: log.errorType,
                errorMessage: log.errorMessage,
              }}
            />
          ))
        )}
      </div>

      <Pagination total={total} pageSize={pageSize} currentPage={page} baseParams={baseParams} />
    </div>
  );
}
