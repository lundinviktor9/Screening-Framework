/**
 * NOMIS source — Metric 28: Labour commute accessibility
 *
 * Dataset: NM_568_1 — Census 2021 "Distance Travelled to Work" (England & Wales)
 * Coverage: England + Wales only. Scottish and NI markets are skipped.
 * API: https://www.nomisweb.co.uk/api/v01/ — free, no API key required for <25k rows/call.
 *
 * Derivation of M28 (% working-age reachable in 45 min):
 *   NM_568_1 reports the count of workers by distance-to-work band at each LA.
 *   We sum the "short distance" bands (≤40 km ≈ 45 min at average urban speed) and
 *   express as % of all in-commuting workers, excluding "home workers" and "no fixed place".
 *
 *   The NOMIS variable codes for NM_568_1 distance bands are discovered at runtime via
 *   the codelist endpoint and matched by label. This makes the script robust to
 *   minor NOMIS metadata changes.
 *
 * Output: Record<laCode, m28Percent>
 */

import readline from 'readline';

const NOMIS_BASE = 'https://www.nomisweb.co.uk/api/v01/dataset/NM_568_1';

interface NomisVariable {
  id: number;
  label: string;
}

interface NomisDataItem {
  geography: { geogcode: string };
  variable: { label: string };
  obs_value: { value: number };
}

// Distance bands we treat as "within 45 min" (≤40 km at ~55 km/h average)
const SHORT_DISTANCE_LABELS = [
  'less than 2km',
  '2km to less than 5km',
  '5km to less than 10km',
  '10km to less than 20km',
  '20km to less than 30km',
  '30km to less than 40km',
];

// Labels to exclude from the denominator (not a physical commute)
const EXCLUDE_LABELS = [
  'works mainly at or from home',
  'no fixed place',
  'works mainly offshore',
];

export async function fetchNomisM28(
  allLaCodes: string[],
  log: (msg: string) => void,
): Promise<Record<string, number>> {
  // ── 1. Discover variable structure ────────────────────────────────────────
  log('NOMIS: fetching variable codelist for NM_568_1…');
  const varUrl = `${NOMIS_BASE}/variable.json`;
  const varRes = await fetch(varUrl);
  if (!varRes.ok) throw new Error(`NOMIS variable fetch failed: ${varRes.status} ${varUrl}`);
  const varJson = await varRes.json() as { variable: { item: NomisVariable[] } };
  const variables: NomisVariable[] = varJson.variable?.item ?? [];

  if (variables.length === 0) {
    throw new Error('NOMIS: no variables returned for NM_568_1. Check dataset ID is correct.');
  }
  log(`NOMIS: found ${variables.length} variables: ${variables.map(v => v.label).join(', ')}`);

  const shortIds = variables
    .filter(v => SHORT_DISTANCE_LABELS.some(l => v.label.toLowerCase().includes(l)))
    .map(v => v.id);
  const excludeIds = variables
    .filter(v => EXCLUDE_LABELS.some(l => v.label.toLowerCase().includes(l)))
    .map(v => v.id);

  if (shortIds.length === 0) {
    throw new Error(
      'NOMIS: could not find distance-band variables in NM_568_1. ' +
      'The dataset may not be a travel-to-work distance table. ' +
      'Check https://www.nomisweb.co.uk/datasets/nm_568_1 to verify.',
    );
  }
  log(`NOMIS: ${shortIds.length} short-distance variable IDs matched, ${excludeIds.length} exclude IDs.`);

  // ── 2. Build geography list for the query ─────────────────────────────────
  // We need NOMIS internal geography IDs, not GSS codes.
  // Strategy: query all TYPE464 (Local Authority Districts) and filter client-side.
  const allVarIds = variables.map(v => v.id).join(',');
  const dataUrl =
    `${NOMIS_BASE}.data.json` +
    `?geography=TYPE464` +
    `&variable=${allVarIds}` +
    `&measures=20100` + // count
    `&recordLimit=50000`;

  log('NOMIS: downloading distance-to-work data for all LAs (TYPE464)…');
  const dataRes = await fetch(dataUrl);
  if (!dataRes.ok) throw new Error(`NOMIS data fetch failed: ${dataRes.status} ${dataUrl}`);
  const dataJson = await dataRes.json() as { obs: NomisDataItem[] };
  const obs = dataJson.obs ?? [];
  log(`NOMIS: received ${obs.length} observations.`);

  // ── 3. Aggregate to per-LA totals ─────────────────────────────────────────
  const laShort: Record<string, number> = {};
  const laAll: Record<string, number> = {};

  for (const item of obs) {
    const gss = item.geography.geogcode;
    const varLabel = item.variable.label.toLowerCase();
    const value = item.obs_value.value ?? 0;

    const isExclude = EXCLUDE_LABELS.some(l => varLabel.includes(l));
    if (isExclude) continue; // skip non-commute categories from denominator

    laAll[gss] = (laAll[gss] ?? 0) + value;

    const isShort = SHORT_DISTANCE_LABELS.some(l => varLabel.includes(l));
    if (isShort) laShort[gss] = (laShort[gss] ?? 0) + value;
  }

  // ── 4. Compute M28 per LA code, then aggregate to market level ────────────
  const laM28: Record<string, number> = {};
  for (const gss of allLaCodes) {
    const total = laAll[gss] ?? 0;
    const short = laShort[gss] ?? 0;
    if (total > 0) laM28[gss] = Math.round((short / total) * 1000) / 10; // 1 d.p.
  }

  return laM28;
}

/**
 * Aggregate per-LA M28 values to per-market values by weighted average.
 * Weight = total in-commuting workers for that LA.
 */
export function aggregateM28ToMarket(
  laM28: Record<string, number>,
  laCodes: string[],
): number | null {
  const vals = laCodes.map(c => laM28[c]).filter((v): v is number => v !== undefined);
  if (vals.length === 0) return null;
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  return Math.round(avg * 10) / 10;
}
