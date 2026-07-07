import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Check, Download, FileText, Loader2 } from 'lucide-react';

import { useDealStore } from '../store/useDealStore';
import { EditableField } from '../components/showcase/EditableField';
import { SectionBand } from '../components/showcase/SectionBand';
import { KpiStrip } from '../components/showcase/KpiStrip';
import { MapCard } from '../components/showcase/MapCard';
import { PhotoCard } from '../components/showcase/PhotoCard';
import { cn } from '@/lib/utils';
import { API_BASE } from '@/config/api';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function DealProfilePage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const deals = useDealStore((s) => s.deals);
  const loading = useDealStore((s) => s.loading);
  const fetchDeals = useDealStore((s) => s.fetchDeals);
  const patchShowcase = useDealStore((s) => s.patchShowcase);

  const deal = deals.find((d) => d.deal_id === dealId);
  const [tab, setTab] = useState<'overview' | 'financial'>('overview');
  const [editMode, setEditMode] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Support direct deep-links: hydrate the store if it hasn't loaded yet.
  useEffect(() => {
    if (deals.length === 0) fetchDeals();
  }, [deals.length, fetchDeals]);

  if (!deal) {
    if (loading || deals.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading deal…
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-muted-foreground">Deal not found</p>
          <Button onClick={() => navigate('/pipeline')}>Back to Pipeline</Button>
        </div>
      </div>
    );
  }

  const showcase = deal.showcase;
  const assetName = deal.extracted_fields?.['Project Name'] || 'Asset';
  const location = showcase?.location?.address || showcase?.location?.postcode || '—';
  const pp = deal.extracted_fields?.['Deal value, CCY'];
  const ry = deal.extracted_fields?.['Yield2'];

  const handleShowcaseChange = async (updates: any) => {
    try {
      await patchShowcase(dealId!, updates);
      toast.success('Saved');
    } catch {
      toast.error('Failed to save change');
    }
  };
  const handleKpiEdit = (key: string, value: any) =>
    handleShowcaseChange({ kpis: { ...(showcase?.kpis || {}), [key]: value } });
  const handleBulletEdit = (index: number, text: string, type: 'rationale' | 'business') => {
    if (type === 'rationale') {
      const bullets = [...(showcase?.rationale_bullets || [])];
      if (bullets[index]) bullets[index] = { ...bullets[index], text };
      return handleShowcaseChange({ rationale_bullets: bullets });
    }
    const bullets = [...(showcase?.business_plan_bullets || [])];
    bullets[index] = text;
    return handleShowcaseChange({ business_plan_bullets: bullets });
  };
  const handleLocationChange = (lat: number, lng: number) =>
    handleShowcaseChange({ location: { ...(showcase?.location || {}), lat, lng } });
  const handleImageSelect = (file: string) =>
    handleShowcaseChange({
      images: (showcase?.images || []).map((img) => ({ ...img, selected: img.file === file })),
    });

  async function exportDeck() {
    setExporting(true);
    try {
      const r = await fetch(`${API_BASE}/export/deck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_ids: [dealId], include_pipeline_summary: false }),
      });
      if (!r.ok) throw new Error(`Server responded ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${assetName.replace(/\s+/g, '_')}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Deck exported');
    } catch (err) {
      toast.error('Export failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setExporting(false);
    }
  }

  const latestPassedRun = deal.underwrite?.runs
    ?.slice()
    .reverse()
    .find((r: any) => r.checks?.pass && r.returns?.cfo);
  const cfoMetric = (view: 'unlevered' | 'levered', key: string, kind: 'pct' | 'mult' | 'gbp') => {
    const v = latestPassedRun?.returns?.cfo?.[view]?.[key];
    if (v == null) return '—';
    if (kind === 'pct') return `${(v * 100).toFixed(2)}%`;
    if (kind === 'mult') return `${v.toFixed(2)}×`;
    return `£${Math.round(v).toLocaleString('en-GB')}`;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-10 border-b bg-card/95 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button size="icon" variant="ghost" onClick={() => navigate('/pipeline')} title="Back to Pipeline">
              <ArrowLeft />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">{assetName}</h1>
              <p className="text-xs text-muted-foreground">
                {location} · PP £{pp ? (pp / 1_000_000).toFixed(1) + 'm' : '—'} · RY {ry ? `${ry}%` : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={editMode ? 'default' : 'outline'}
              onClick={() => setEditMode((e) => !e)}
            >
              {editMode ? <Check /> : <Pencil />}
              {editMode ? 'Done' : 'Edit'}
            </Button>
            <Button variant="outline" onClick={exportDeck} disabled={exporting}>
              {exporting ? <Loader2 className="animate-spin" /> : <Download />}
              Export this deal (.pptx)
            </Button>
            <Button variant="outline" asChild>
              <a href={`${API_BASE}/pdf/${dealId}`} target="_blank" rel="noreferrer">
                <FileText /> Open IM PDF
              </a>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex gap-1">
          {(['overview', 'financial'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === t ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {t === 'overview' ? 'Overview' : 'Financial Overview'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'overview' && (
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {showcase?.kpis && (
                <Card className="p-6">
                  <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Key metrics
                  </h3>
                  <KpiStrip kpis={showcase.kpis} onEdit={handleKpiEdit} readOnly={!editMode} />
                </Card>
              )}

              <SectionBand title="Investment Rationale">
                <div className="space-y-4">
                  {showcase?.rationale_bullets && showcase.rationale_bullets.length > 0 ? (
                    showcase.rationale_bullets.map((bullet, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="text-sm font-semibold text-foreground">{bullet.label}</div>
                        <div className="text-sm text-muted-foreground">
                          <EditableField
                            value={bullet.text}
                            readOnly={!editMode}
                            onChange={(v) => handleBulletEdit(idx, v, 'rationale')}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No rationale bullets</p>
                  )}
                </div>
              </SectionBand>

              <SectionBand title="Business Plan">
                <div className="space-y-3">
                  {showcase?.business_plan_bullets && showcase.business_plan_bullets.length > 0 ? (
                    showcase.business_plan_bullets.map((bullet, idx) => (
                      <div key={idx} className="text-sm text-muted-foreground">
                        <EditableField
                          value={bullet}
                          readOnly={!editMode}
                          onChange={(v) => handleBulletEdit(idx, v, 'business')}
                        />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No business plan bullets</p>
                  )}
                </div>
              </SectionBand>
            </div>

            <div className="space-y-6">
              <Card className="p-4">
                <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Location
                </h3>
                <MapCard location={showcase?.location} onLocationChange={handleLocationChange} />
              </Card>
              <Card className="p-4">
                <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Asset photo
                </h3>
                <PhotoCard images={showcase?.images} onSelectImage={handleImageSelect} />
              </Card>
            </div>
          </div>
        )}

        {tab === 'financial' && (
          <div className="mx-auto max-w-7xl space-y-6">
            {latestPassedRun ? (
              <>
                <SectionBand title="Key Assumptions">
                  <div className="grid grid-cols-2 gap-8 text-sm">
                    <div>
                      <div className="font-semibold text-foreground">Entry</div>
                      <dl className="mt-3 space-y-2">
                        <Row label="Acq date" value={latestPassedRun.assumptions?.entry_date || '—'} />
                        <Row
                          label="PP"
                          value={
                            latestPassedRun.returns?.net_purchase_price
                              ? `£${Math.round(latestPassedRun.returns.net_purchase_price).toLocaleString('en-GB')}`
                              : '—'
                          }
                        />
                        <Row
                          label="NIY %"
                          value={
                            latestPassedRun.assumptions?.entry_yield
                              ? `${(latestPassedRun.assumptions.entry_yield * 100).toFixed(2)}%`
                              : '—'
                          }
                        />
                      </dl>
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">Financing</div>
                      <dl className="mt-3 space-y-2">
                        <Row
                          label="LTV"
                          value={
                            latestPassedRun.assumptions?.ltv != null
                              ? `${(latestPassedRun.assumptions.ltv * 100).toFixed(0)}%`
                              : '—'
                          }
                        />
                        <Row label="Hold (yrs)" value={latestPassedRun.assumptions?.hold_years ?? '—'} />
                        <Row
                          label="Exit yield"
                          value={
                            latestPassedRun.assumptions?.exit_yield
                              ? `${(latestPassedRun.assumptions.exit_yield * 100).toFixed(2)}%`
                              : '—'
                          }
                        />
                      </dl>
                    </div>
                  </div>
                </SectionBand>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <SectionBand title="Unlevered Returns, Pre-Tax, Post BRE Fees">
                    <dl className="space-y-2 text-sm">
                      <Row label="IRR" value={cfoMetric('unlevered', 'irr', 'pct')} accent />
                      <Row label="EM" value={cfoMetric('unlevered', 'em', 'mult')} accent />
                      <Row label="CoC (Y5)" value={cfoMetric('unlevered', 'coc_y5', 'pct')} accent />
                      <Row label="Profit" value={cfoMetric('unlevered', 'profit', 'gbp')} accent />
                      <Row label="Equity" value={cfoMetric('unlevered', 'equity', 'gbp')} accent />
                    </dl>
                  </SectionBand>

                  <SectionBand title="Levered Returns, Post Tax, BRE Promote">
                    <dl className="space-y-2 text-sm">
                      <Row label="IRR" value={cfoMetric('levered', 'irr', 'pct')} accent />
                      <Row label="EM" value={cfoMetric('levered', 'em', 'mult')} accent />
                      <Row label="CoC (Y5)" value={cfoMetric('levered', 'coc_y5', 'pct')} accent />
                      <Row label="Profit" value={cfoMetric('levered', 'profit', 'gbp')} accent />
                      <Row label="Equity" value={cfoMetric('levered', 'equity', 'gbp')} accent />
                    </dl>
                  </SectionBand>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-6 text-center">
                <p className="font-medium text-warning">Returns withheld — checks not passed</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Run a successful underwrite to see financial projections.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('font-semibold', accent ? 'text-primary' : 'text-foreground')}>{value}</dd>
    </div>
  );
}
