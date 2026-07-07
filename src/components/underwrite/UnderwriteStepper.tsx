import { useEffect, useState } from 'react';
import {
  Upload,
  ListChecks,
  SlidersHorizontal,
  PlayCircle,
  Loader2,
  Check,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  CircleCheck,
  CircleX,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { API_BASE } from '@/config/api';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

type Flag = Record<string, any>;
const flagKey = (f: Flag) => `${f.unit || ''}|${f.signal || f.field || ''}`;
const pct = (x?: number | null) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`);
const mult = (x?: number | null) => (x == null ? '—' : `${x.toFixed(2)}×`);
const gbp = (x?: number | null) =>
  x == null
    ? '—'
    : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(x);

const STEPS = [
  { n: 1, label: 'Upload rent roll', icon: Upload },
  { n: 2, label: 'Review mapping & flags', icon: ListChecks },
  { n: 3, label: 'Assumptions', icon: SlidersHorizontal },
  { n: 4, label: 'Run & results', icon: PlayCircle },
];

export function UnderwriteStepper({ dealId }: { dealId: string }) {
  const [block, setBlock] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const [mappingOk, setMappingOk] = useState(false);
  const [flagsOk, setFlagsOk] = useState(false);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [analyst, setAnalyst] = useState('');
  const [changeNote, setChangeNote] = useState('');

  const [entryDate, setEntryDate] = useState('');
  const [holdYears, setHoldYears] = useState('5');
  const [entryYield, setEntryYield] = useState('');
  const [exitYield, setExitYield] = useState('6.25');
  const [rentalGrowth, setRentalGrowth] = useState('4.5');
  const [ltv, setLtv] = useState('0');
  const [scenario, setScenario] = useState('1');

  const [gapOverrides, setGapOverrides] = useState<Record<string, string>>({});

  // v22 three-tier assumptions + hardcode PP + asset-inclusion checklist
  const [ppMode, setPpMode] = useState<'yield' | 'hardcoded'>('yield');
  const [ppValue, setPpValue] = useState('');
  const [excludedAssets, setExcludedAssets] = useState<Record<string, boolean>>({});
  const [assetOverrides, setAssetOverrides] = useState<Record<string, { entry_yield?: string; exit_yield?: string }>>({});
  const [breakUnits, setBreakUnits] = useState('');
  const [vacateUnits, setVacateUnits] = useState('');

  const [editingMapping, setEditingMapping] = useState(false);
  const [mappingEdits, setMappingEdits] = useState<Record<string, string>>({});
  const [mappingSaveBusy, setMappingSaveBusy] = useState(false);

  useEffect(() => {
    setBlock(null);
    setStep(1);
    setMappingOk(false);
    setFlagsOk(false);
    setErr(null);
    fetch(`${API_BASE}/underwrite/${dealId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (b) {
          setBlock(b);
          setStep(2);
        }
      })
      .catch(() => {});
  }, [dealId]);

  const flags: Flag[] = block?.flags || [];
  const gaps: any[] = block?.gaps || [];
  const assets: string[] = block?.assets || [];
  const missingRequired: any[] = block?.missing_required || [];
  const hasUpload = !!block?.status;
  const checks = block?.checks;
  const showReturns = !!checks?.pass && block?.returns;
  const runs: any[] = (block?.runs || []).filter((r: any) => r.type !== 'mapping_correction');
  const reachable = (n: number) => n === 1 || hasUpload;

  async function handleUpload(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`${API_BASE}/underwrite/${dealId}`, { method: 'POST', body: fd });
      if (!r.ok) throw new Error((await r.json()).detail || 'Upload failed');
      const data = await r.json();
      setBlock(data);
      setMappingOk(false);
      setFlagsOk(false);
      setResolutions({});
      setStep(2);
      toast.success('Rent roll normalised — review mapping & flags');
    } catch (e: any) {
      setErr(e.message);
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveMapping() {
    if (!block?.mapping) return;
    setMappingSaveBusy(true);
    try {
      const corrected = { ...block.mapping };
      if (corrected.columns) {
        Object.entries(mappingEdits).forEach(([k, v]) => {
          corrected.columns[k] = v;
        });
      }
      const r = await fetch(`${API_BASE}/underwrite/${dealId}/confirm-mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping: corrected }),
      });
      if (!r.ok) throw new Error((await r.json()).detail || 'Failed to save mapping');
      const data = await r.json();
      setBlock(data);
      setEditingMapping(false);
      setMappingEdits({});
      setMappingOk(false);
      toast.success('Mapping re-applied');
    } catch (e: any) {
      setErr(e.message);
      toast.error(e.message);
    } finally {
      setMappingSaveBusy(false);
    }
  }

  async function handleRun() {
    if (!entryDate) return setErr('Entry date is required.');
    if (!mappingOk) return setErr('Column mapping must be reviewed & checked.');
    if (!flagsOk) return setErr('Judgement flags must be reviewed & resolved.');
    setBusy(true);
    setErr(null);
    try {
      const num = (s: string) => (s.trim() === '' ? null : Number(s));
      const dec = (s: string) => (s.trim() === '' ? null : Number(s) / 100);
      const assumptions = {
        entry_date: entryDate,
        hold_years: num(holdYears),
        entry_yield: dec(entryYield),
        exit_yield: dec(exitYield),
        rental_growth: dec(rentalGrowth),
        ltv: dec(ltv),
        scenario: num(scenario),
      };
      const gap_overrides: Record<string, number> = {};
      Object.entries(gapOverrides).forEach(([f, v]) => {
        if (v.trim() !== '') gap_overrides[f] = Number(v);
      });

      // --- v22: three-tier underwrite_assumptions (per-asset overrides + per-unit break/vacate) ---
      const uaAssets: Record<string, any> = {};
      Object.entries(assetOverrides).forEach(([a, o]) => {
        const e: Record<string, number> = {};
        if (o.entry_yield && o.entry_yield.trim() !== '') e.entry_yield = Number(o.entry_yield) / 100;
        if (o.exit_yield && o.exit_yield.trim() !== '') e.exit_yield = Number(o.exit_yield) / 100;
        if (Object.keys(e).length) uaAssets[a] = e;
      });
      const uaUnits: Record<string, any> = {};
      const addUnit = (raw: string, patch: any) =>
        raw.split(',').map((s) => s.trim()).filter(Boolean).forEach((u) => {
          uaUnits[u] = { ...(uaUnits[u] || {}), ...patch };
        });
      addUnit(breakUnits, { break_taken: true });
      addUnit(vacateUnits, { vacate_at_expiry: true });
      const underwrite_assumptions: Record<string, any> = {};
      if (Object.keys(uaAssets).length) underwrite_assumptions.assets = uaAssets;
      if (Object.keys(uaUnits).length) underwrite_assumptions.units = uaUnits;

      const exclude_assets = Object.entries(excludedAssets)
        .filter(([, v]) => v)
        .map(([a]) => a);

      const flag_resolutions = (block?.flags || []).map((f: Flag) => ({
        unit: f.unit,
        signal: f.signal,
        field: f.field,
        decision: 'reviewed',
        note: resolutions[flagKey(f)] || '',
      }));
      const r = await fetch(`${API_BASE}/underwrite/${dealId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assumptions,
          gap_overrides,
          underwrite_assumptions: Object.keys(underwrite_assumptions).length ? underwrite_assumptions : null,
          pp_mode: ppMode,
          pp_value: ppMode === 'hardcoded' && ppValue.trim() !== '' ? Number(ppValue) : null,
          exclude_assets: exclude_assets.length ? exclude_assets : null,
          flag_resolutions,
          mapping_signed_off: mappingOk,
          flags_signed_off: flagsOk,
          analyst: analyst || null,
          note: changeNote || null,
        }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.detail || `Server error (${r.status})`);
      }
      const fresh = await fetch(`${API_BASE}/underwrite/${dealId}`).then((x) => x.json());
      setBlock(fresh);
      setChangeNote('');
      toast.success(fresh?.checks?.pass ? 'Run complete — checks passed' : 'Run complete — checks failed, returns withheld');
    } catch (e: any) {
      setErr(e.message);
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Stepper header */}
      <div className="flex items-center gap-1 border-b px-4 py-3">
        {STEPS.map((s, i) => {
          const active = step === s.n;
          const done =
            (s.n === 1 && hasUpload) ||
            (s.n === 2 && mappingOk && flagsOk) ||
            (s.n === 3 && !!entryDate) ||
            (s.n === 4 && showReturns);
          const can = reachable(s.n);
          const Icon = s.icon;
          return (
            <div key={s.n} className="flex flex-1 items-center">
              <button
                disabled={!can}
                onClick={() => can && setStep(s.n)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                  active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted',
                  !can && 'cursor-not-allowed opacity-50'
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : done
                      ? 'bg-success text-white'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {done && !active ? <Check className="h-3.5 w-3.5" /> : s.n}
                </span>
                <span className="hidden font-medium md:inline">{s.label}</span>
                <Icon className="h-4 w-4 md:hidden" />
              </button>
              {i < STEPS.length - 1 && <div className="mx-1 h-px flex-1 bg-border" />}
            </div>
          );
        })}
      </div>

      {err && (
        <div className="mx-4 mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {err}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {/* STEP 1 — Upload */}
        {step === 1 && (
          <div className="mx-auto max-w-lg">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card px-6 py-10 text-center transition-colors hover:border-primary/60">
              {busy ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <FileSpreadsheet className="h-6 w-6 text-primary" />
              )}
              <div className="text-sm font-medium">
                {busy ? 'Normalising…' : hasUpload ? 'Replace rent roll (.xlsx)' : 'Upload rent roll (.xlsx)'}
              </div>
              <div className="text-xs text-muted-foreground">
                Parsed into the canonical schedule, then validated (Mode A).
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                disabled={busy}
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
            </label>
            {hasUpload && (
              <div className="mt-3 text-center text-xs text-muted-foreground">
                {block?.units ?? '—'} units · {block?.asset} · {block?.region}
                {block?.mapping?._source && <> · {block.mapping._source}</>}
              </div>
            )}
          </div>
        )}

        {/* STEP 2 — Mapping & flags */}
        {step === 2 && hasUpload && (
          <div className="space-y-5">
            {/* Mapping */}
            <section className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Column mapping
                </h3>
                {!editingMapping && (
                  <Button size="sm" variant="ghost" onClick={() => { setEditingMapping(true); setMappingEdits({}); }}>
                    Edit
                  </Button>
                )}
              </div>
              {!editingMapping ? (
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {Object.entries(block.mapping?.columns || {}).map(([schema, col]: any) => (
                    <div key={schema} className="flex justify-between gap-2 rounded bg-muted/50 px-2 py-1">
                      <span className="text-muted-foreground">{schema}</span>
                      <span className="font-medium">{String(col)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {block?.sample_rows?.[0] &&
                    Object.keys(block.mapping?.columns || {}).map((schema: string) => {
                      const current = mappingEdits[schema] ?? (block.mapping.columns?.[schema] || '');
                      const cols = Object.keys(block.sample_rows[0] || {});
                      return (
                        <div key={schema} className="grid grid-cols-2 items-center gap-2 text-xs">
                          <span className="text-muted-foreground">{schema}</span>
                          <select
                            value={current}
                            onChange={(e) => setMappingEdits((s) => ({ ...s, [schema]: e.target.value }))}
                            className="rounded border bg-background px-1.5 py-1"
                          >
                            <option value="">(not mapped)</option>
                            {cols.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  <div className="flex justify-end gap-2 pt-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditingMapping(false); setMappingEdits({}); }}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveMapping} disabled={mappingSaveBusy}>
                      {mappingSaveBusy ? <Loader2 className="animate-spin" /> : null}
                      Save mapping
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {/* Flags */}
            {flags.length > 0 && (
              <section>
                <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Judgement flags ({flags.length}) — review each
                </h3>
                <ul className="space-y-2">
                  {flags.map((f, i) => (
                    <li key={i} className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {f.unit ? `${f.unit}: ` : ''}
                            {f.signal || f.field}
                          </div>
                          {f.rationale && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              <span className="font-semibold">Why:</span> {f.rationale}
                            </div>
                          )}
                          <Input
                            placeholder="resolution note (how you treated it)…"
                            value={resolutions[flagKey(f)] || ''}
                            onChange={(e) => setResolutions((s) => ({ ...s, [flagKey(f)]: e.target.value }))}
                            className="mt-2 h-8 text-xs"
                          />
                          {f.resolution?.note && (
                            <div className="mt-1 text-xs text-success">✓ {f.resolution.note}</div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Sign-off */}
            <section className="space-y-2 rounded-lg border bg-card p-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={mappingOk} onCheckedChange={(v) => setMappingOk(!!v)} />
                Column mapping reviewed &amp; correct
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={flagsOk} onCheckedChange={(v) => setFlagsOk(!!v)} />
                Judgement flags reviewed &amp; resolved
              </label>
              <div className="pt-1">
                <Button size="sm" onClick={() => setStep(3)} disabled={!mappingOk || !flagsOk}>
                  Continue to assumptions
                </Button>
              </div>
            </section>
          </div>
        )}

        {/* STEP 3 — Assumptions (gap-overrides first, model dials in accordion) */}
        {step === 3 && hasUpload && (
          <div className="space-y-5">
            {gaps.length > 0 && (
              <section className="rounded-lg border bg-card p-4">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Gap overrides
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Fill missing per-unit values with a deal-level default. Blank cells only — broker data is never
                  overwritten.
                </p>
                <div className="mt-3 space-y-2">
                  {gaps.map((g: any) => {
                    const complete = g.missing === 0;
                    return (
                      <div key={g.field} className="grid grid-cols-2 items-center gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{g.field}</span>
                          <Badge variant={complete ? 'success' : 'warning'}>
                            {complete ? 'complete' : `${g.missing}/${g.total} missing`}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="any"
                            disabled={complete}
                            value={gapOverrides[g.field] ?? ''}
                            onChange={(e) => setGapOverrides((s) => ({ ...s, [g.field]: e.target.value }))}
                            placeholder={complete ? '—' : `default ${g.unit}`}
                            className="h-8 text-xs"
                          />
                          <span className="w-10 shrink-0 text-muted-foreground">{g.unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Missing required fields (per-asset roll-up from the normaliser) */}
            {missingRequired.length > 0 && (
              <section className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-warning">
                  Still needs input ({missingRequired.length})
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Fields the broker schedule left blank. Set a deal-level default below (gap overrides), a
                  per-asset override, or confirm the pricing dials — nothing is fabricated.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {missingRequired.slice(0, 24).map((m: any, i: number) => (
                    <Badge key={i} variant={m.priority === 'REQUIRED' ? 'danger' : m.priority === 'PRICING' ? 'warning' : 'secondary'}>
                      {m.asset}: {m.field} ({m.missing}/{m.total})
                    </Badge>
                  ))}
                  {missingRequired.length > 24 && (
                    <span className="text-xs text-muted-foreground">+{missingRequired.length - 24} more…</span>
                  )}
                </div>
              </section>
            )}

            {/* Purchase price — yield-derived (default) or hardcoded */}
            <section className="rounded-lg border bg-card p-4">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                Purchase price
              </h3>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pp-mode"
                    checked={ppMode === 'yield'}
                    onChange={() => setPpMode('yield')}
                  />
                  Yield-derived (net cap of passing rent at NIY)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pp-mode"
                    checked={ppMode === 'hardcoded'}
                    onChange={() => setPpMode('hardcoded')}
                  />
                  Hardcoded
                  <Input
                    type="number"
                    step="any"
                    disabled={ppMode !== 'hardcoded'}
                    value={ppValue}
                    onChange={(e) => setPpValue(e.target.value)}
                    placeholder="net purchase price £"
                    className="h-8 w-44 text-xs"
                  />
                </label>
              </div>
            </section>

            {/* Asset inclusion checklist + per-asset overrides */}
            {assets.length > 0 && (
              <section className="rounded-lg border bg-card p-4">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Assets ({assets.length})
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Untick to exclude an asset from portfolio totals. Optional per-asset entry/exit yield
                  overrides the schedule for that asset.
                </p>
                <div className="mt-3 space-y-2">
                  {assets.map((a) => {
                    const included = !excludedAssets[a];
                    const ov = assetOverrides[a] || {};
                    return (
                      <div key={a} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-xs">
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={included}
                            onCheckedChange={(v) => setExcludedAssets((s) => ({ ...s, [a]: !v }))}
                          />
                          <span className={cn(!included && 'text-muted-foreground line-through')}>{a}</span>
                        </label>
                        <Input
                          type="number"
                          step="0.05"
                          disabled={!included}
                          value={ov.entry_yield ?? ''}
                          onChange={(e) => setAssetOverrides((s) => ({ ...s, [a]: { ...s[a], entry_yield: e.target.value } }))}
                          placeholder="entry %"
                          className="h-8 w-24 text-xs"
                        />
                        <Input
                          type="number"
                          step="0.05"
                          disabled={!included}
                          value={ov.exit_yield ?? ''}
                          onChange={(e) => setAssetOverrides((s) => ({ ...s, [a]: { ...s[a], exit_yield: e.target.value } }))}
                          placeholder="exit %"
                          className="h-8 w-24 text-xs"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Field label="Units that break at break date (unit ids, comma-sep)">
                    <Input value={breakUnits} onChange={(e) => setBreakUnits(e.target.value)} placeholder="e.g. A1, B3" className="h-8 text-xs" />
                  </Field>
                  <Field label="Units that vacate at expiry (unit ids, comma-sep)">
                    <Input value={vacateUnits} onChange={(e) => setVacateUnits(e.target.value)} placeholder="e.g. C2" className="h-8 text-xs" />
                  </Field>
                </div>
              </section>
            )}

            <section className="rounded-lg border bg-card px-4">
              <Accordion type="single" collapsible defaultValue="dials">
                <AccordionItem value="dials" className="border-b-0">
                  <AccordionTrigger className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Model dials
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <Field label="Entry date *">
                        <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="h-8" />
                      </Field>
                      <Field label="Hold (yrs)">
                        <Input type="number" value={holdYears} onChange={(e) => setHoldYears(e.target.value)} className="h-8" />
                      </Field>
                      <Field label="Entry yield % (opt)">
                        <Input type="number" step="0.05" value={entryYield} onChange={(e) => setEntryYield(e.target.value)} className="h-8" />
                      </Field>
                      <Field label="Exit yield %">
                        <Input type="number" step="0.05" value={exitYield} onChange={(e) => setExitYield(e.target.value)} className="h-8" />
                      </Field>
                      <Field label="Rental growth %">
                        <Input type="number" step="0.1" value={rentalGrowth} onChange={(e) => setRentalGrowth(e.target.value)} className="h-8" />
                      </Field>
                      <Field label="LTV %">
                        <Input type="number" step="1" value={ltv} onChange={(e) => setLtv(e.target.value)} className="h-8" />
                      </Field>
                      <Field label="Scenario">
                        <select value={scenario} onChange={(e) => setScenario(e.target.value)} className="h-8 rounded border bg-background px-1.5">
                          <option value="1">1 · Base UK SPV</option>
                          <option value="2">2 · Alt</option>
                          <option value="3">3 · Alt</option>
                          <option value="4">4 · Alt</option>
                        </select>
                      </Field>
                      <Field label="Analyst">
                        <Input value={analyst} onChange={(e) => setAnalyst(e.target.value)} className="h-8" />
                      </Field>
                    </div>
                    <Field label="Change note (what differs from the machine output & why)" className="mt-3">
                      <textarea
                        value={changeNote}
                        onChange={(e) => setChangeNote(e.target.value)}
                        rows={2}
                        className="w-full rounded border bg-background px-2 py-1 text-xs"
                      />
                    </Field>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </section>

            <Button onClick={() => setStep(4)}>Continue to run</Button>
          </div>
        )}

        {/* STEP 4 — Run & results */}
        {step === 4 && hasUpload && (
          <div className="space-y-5">
            <div>
              <Button onClick={handleRun} disabled={busy || !mappingOk || !flagsOk || !entryDate} className="w-full">
                {busy ? <Loader2 className="animate-spin" /> : <PlayCircle />}
                {busy ? 'Running (~30s, LibreOffice recalculating)…' : 'Run underwrite'}
              </Button>
              {!busy && (!mappingOk || !flagsOk || !entryDate) && (
                <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {!mappingOk && <div>• Sign off the mapping (step 2)</div>}
                  {!flagsOk && <div>• Sign off the flags (step 2)</div>}
                  {!entryDate && <div>• Set an entry date (step 3)</div>}
                </div>
              )}
            </div>

            {checks && !checks.pass && (
              <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                Checks failed — returns withheld (no false precision). Tie-out:{' '}
                {checks.anchor_tieout_ok ? 'ok' : 'FAIL'}; error cells: {checks.workbook_error_cells}.
              </div>
            )}

            {showReturns && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Returns {block?.latest_version ? `(v${block.latest_version})` : ''}
                  </h3>
                  <Badge variant="success">
                    pass · tie-out ok · {checks.workbook_error_cells} errs
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <Metric label="Net purchase price" value={gbp(block?.returns?.net_purchase_price)} />
                  <Metric label="Unlevered IRR" value={pct(block?.returns?.unlevered_irr)} accent />
                  <Metric label="Net investor IRR" value={pct(block?.returns?.net_investor_irr)} />
                  <Metric label="Equity multiple" value={mult(block?.returns?.equity_multiple)} />
                  <Metric label="Cash-on-cash" value={pct(block?.returns?.cash_on_cash)} />
                </div>
                <a
                  href={`${API_BASE}/underwrite/${dealId}/model`}
                  className="mt-3 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Download className="h-4 w-4" /> Download editable model (.xlsx)
                </a>
              </section>
            )}

            {/* Run history */}
            {runs.length > 0 && (
              <section>
                <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Run history ({runs.length})
                </h3>
                {/* pass/fail tracker squares */}
                <div className="mb-3 flex gap-1">
                  {runs.map((r) => (
                    <div
                      key={r.version}
                      title={`v${r.version} — ${r.passed ? 'pass' : 'checks failed'}`}
                      className={cn('h-7 w-7 rounded-sm', r.passed ? 'bg-success' : 'bg-danger')}
                    />
                  ))}
                </div>
                <Accordion type="single" collapsible className="rounded-lg border bg-card px-3">
                  {runs
                    .slice()
                    .reverse()
                    .map((r) => (
                      <AccordionItem key={r.version} value={`v${r.version}`} className="last:border-b-0">
                        <AccordionTrigger className="text-sm">
                          <span className="flex items-center gap-2">
                            {r.passed ? (
                              <CircleCheck className="h-4 w-4 text-success" />
                            ) : (
                              <CircleX className="h-4 w-4 text-danger" />
                            )}
                            v{r.version}
                            {r.is_baseline ? ' · machine baseline' : ''}
                            {r.analyst ? ` · ${r.analyst}` : ''}
                            <span className="text-muted-foreground">Unlev {pct(r.returns?.unlevered_irr)}</span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div>
                              EM {mult(r.returns?.equity_multiple)} · NetPP {gbp(r.returns?.net_purchase_price)}
                            </div>
                            {r.note && <div className="italic">{r.note}</div>}
                            {r.vs_baseline && Object.keys(r.vs_baseline).length > 0 && (
                              <div>
                                vs baseline:{' '}
                                {Object.entries(r.vs_baseline)
                                  .map(([k, v]: any) => `${k} ${v.from}→${v.to}`)
                                  .join(', ')}
                              </div>
                            )}
                            {Array.isArray(r.assumption_notes) &&
                              r.assumption_notes.map((n: string, i: number) => <div key={i}>• {n}</div>)}
                            <a
                              href={`${API_BASE}/underwrite/${dealId}/model?version=${r.version}`}
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <Download className="h-3 w-3" /> model v{r.version}
                            </a>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                </Accordion>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-1 text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-xl font-bold', accent ? 'text-primary' : 'text-foreground')}>{value}</div>
    </div>
  );
}
