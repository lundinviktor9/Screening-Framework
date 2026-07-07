import { useEffect, useMemo, useState } from 'react';
import { Inbox, Plus, Loader2 } from 'lucide-react';

import { useDealStore } from '../../store/useDealStore';
import { DealUploadPanel } from './DealUploadPanel';
import { DealDataTable } from './DealDataTable';
import { DealMap } from './DealMap';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';

export function PipelineTab() {
  const rawDeals = useDealStore((s) => s.deals);
  const filters = useDealStore((s) => s.filters);
  const loading = useDealStore((s) => s.loading);
  const fetchDeals = useDealStore((s) => s.fetchDeals);
  const createDeal = useDealStore((s) => s.createDeal);
  const [creating, setCreating] = useState(false);

  async function handleAddDeal() {
    setCreating(true);
    try {
      await createDeal('New deal');
      toast.success('Blank deal added — fill in the details in the table');
    } catch (err) {
      toast.error('Could not add deal: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setCreating(false);
    }
  }

  const deals = useMemo(
    () => useDealStore.getState().getFilteredDeals(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawDeals, filters]
  );

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  return (
    <div className="flex h-full flex-col gap-5 p-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Pipeline</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Upload IMs, review extracted deals, and export a deck.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {deals.length} deal{deals.length === 1 ? '' : 's'}
          </span>
          <Button variant="outline" onClick={handleAddDeal} disabled={creating}>
            {creating ? <Loader2 className="animate-spin" /> : <Plus />}
            Add deal
          </Button>
        </div>
      </div>

      {/* Upload zone */}
      <DealUploadPanel />

      {/* Content: table (60) + map (40) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : deals.length === 0 ? (
            <EmptyState />
          ) : (
            <DealDataTable deals={deals} />
          )}
        </Card>

        <Card className="min-h-[320px] overflow-hidden lg:min-h-0">
          {deals.length > 0 ? (
            <DealMap deals={deals} selectedDeal={null} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Deals with a matched market appear here.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
        <Inbox className="h-6 w-6" />
      </div>
      <div>
        <div className="font-medium text-foreground">No deals yet</div>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Drop an IM PDF in the upload zone above, or run “Process inbox” to extract everything in
          the <code className="rounded bg-muted px-1">deals_inbox/</code> folder.
        </p>
      </div>
    </div>
  );
}
