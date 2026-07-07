import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calculator } from 'lucide-react';

import { useDealStore } from '../store/useDealStore';
import { UnderwriteStepper } from '../components/underwrite/UnderwriteStepper';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'secondary' }> = {
  underwritten: { label: 'Underwritten', variant: 'success' },
  checks_failed: { label: 'Checks failed', variant: 'danger' },
  flagged: { label: 'Flags pending', variant: 'warning' },
};

export default function UnderwritePage() {
  const rawDeals = useDealStore((s) => s.deals);
  const loading = useDealStore((s) => s.loading);
  const fetchDeals = useDealStore((s) => s.fetchDeals);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('deal');

  const deals = useMemo(
    () => useDealStore.getState().getFilteredDeals(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawDeals]
  );

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const select = (id: string) => setParams(id ? { deal: id } : {});

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-foreground">Underwrite</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          MLI underwrite: upload a rent roll, review mapping &amp; flags, set assumptions, run.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
        {/* Master: deal list */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Deals
          </div>
          <div className="flex-1 overflow-auto p-2">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : deals.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No deals yet. Upload an IM in the Pipeline tab.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {deals.map((deal) => {
                  const uw = deal.underwrite;
                  const badge = STATUS_BADGE[uw?.status || ''] || {
                    label: 'Not started',
                    variant: 'secondary' as const,
                  };
                  const irr = uw?.returns?.unlevered_irr;
                  const active = deal.deal_id === selectedId;
                  return (
                    <li key={deal.deal_id}>
                      <button
                        onClick={() => select(deal.deal_id)}
                        className={cn(
                          'w-full rounded-md border p-3 text-left transition-colors',
                          active ? 'border-primary bg-accent/50' : 'border-border hover:bg-muted'
                        )}
                      >
                        <div className="truncate text-sm font-medium text-foreground">
                          {deal.extracted_fields?.['Project Name'] || 'Untitled deal'}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          {irr != null && (
                            <span className="text-xs font-semibold text-primary">
                              {(irr * 100).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* Detail: stepper */}
        <Card className="min-h-0 overflow-hidden">
          {selectedId ? (
            <UnderwriteStepper key={selectedId} dealId={selectedId} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
                <Calculator className="h-6 w-6" />
              </div>
              <div>
                <div className="font-medium text-foreground">Select a deal to underwrite</div>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Pick a deal on the left to start the upload → review → assumptions → run workflow.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
