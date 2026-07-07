import type { MetricDef } from '../types';

export const METRICS: MetricDef[] = [
  // ── SUPPLY (metrics 1–10, weight 2.0 each) ────────────────────────────────
  { id: 1,  pillar: 'Supply', name: 'Vacancy rate',                        unit: '% of stock',          ruleType: 'Lower',  weight: 2.0, t5: 3,    t4: 5,    t3: 7,    t2: 10,   inputGuidance: 'Enter headline vacancy as a % of total industrial stock. Lower is better.' },
  { id: 2,  pillar: 'Supply', name: 'Prime vacancy rate',                  unit: '% of prime stock',    ruleType: 'Lower',  weight: 2.0, t5: 2,    t4: 4,    t3: 6,    t2: 8,    inputGuidance: 'Enter vacancy in modern/prime stock only. Lower is better.' },
  { id: 3,  pillar: 'Supply', name: 'Pipeline as % of existing stock',     unit: '% of stock',          ruleType: 'Lower',  weight: 2.0, t5: 4,    t4: 7,    t3: 10,   t2: 15,   inputGuidance: 'Development pipeline divided by standing stock. Lower is better for rent tension.' },
  { id: 4,  pillar: 'Supply', name: 'Speculative development share',       unit: '% of pipeline',       ruleType: 'Lower',  weight: 2.0, t5: 20,   t4: 35,   t3: 50,   t2: 65,   inputGuidance: 'Share of pipeline without pre-lets. Lower is better.' },
  { id: 5,  pillar: 'Supply', name: 'Availability of zoned industrial land', unit: 'score 1–5',         ruleType: 'Direct', weight: 2.0, t5: null, t4: null, t3: null, t2: null, inputGuidance: 'Expert score: 5 = highly supply-constrained/advantageous; 1 = abundant competing supply.' },
  { id: 6,  pillar: 'Supply', name: 'Brownfield redevelopment potential',  unit: 'score 1–5',           ruleType: 'Direct', weight: 2.0, t5: null, t4: null, t3: null, t2: null, inputGuidance: 'Expert score: 5 = strong redevelopment optionality; 1 = very limited.' },
  { id: 7,  pillar: 'Supply', name: 'Land price growth (5yr CAGR)',        unit: '% CAGR',              ruleType: 'Higher', weight: 2.0, t5: 10,   t4: 7,    t3: 4,    t2: 1,    inputGuidance: 'Use industrial land price CAGR over 5 years. Higher is better.' },
  { id: 8,  pillar: 'Supply', name: 'Planning approval time',              unit: 'months',              ruleType: 'Lower',  weight: 2.0, t5: 6,    t4: 9,    t3: 12,   t2: 18,   inputGuidance: 'Median planning determination period in months. Lower is better.' },
  { id: 9,  pillar: 'Supply', name: 'Planning approval rate',              unit: '%',                   ruleType: 'Higher', weight: 2.0, t5: 90,   t4: 80,   t3: 70,   t2: 60,   inputGuidance: 'Share of industrial applications approved. Higher is better.' },
  { id: 10, pillar: 'Supply', name: 'Share of Grade A stock',              unit: '% of stock',          ruleType: 'Higher', weight: 2.0, t5: 60,   t4: 50,   t3: 40,   t2: 30,   inputGuidance: 'Share of modern high-spec stock. Higher is better.' },

  // ── DEMAND (metrics 11–20, weight 2.0 each) ───────────────────────────────
  { id: 11, pillar: 'Demand', name: 'Gross take-up growth (5yr CAGR)',     unit: '% CAGR',              ruleType: 'Higher', weight: 2.0, t5: 8,    t4: 6,    t3: 4,    t2: 2,    inputGuidance: 'Use 5-year CAGR of gross industrial take-up. Higher is better.' },
  { id: 12, pillar: 'Demand', name: 'Net absorption as % of stock',        unit: '% of stock',          ruleType: 'Higher', weight: 2.0, t5: 4,    t4: 3,    t3: 2,    t2: 1,    inputGuidance: 'Net occupied growth divided by stock. Higher is better.' },
  { id: 13, pillar: 'Demand', name: 'Take-up as % of available supply',    unit: '%',                   ruleType: 'Higher', weight: 2.0, t5: 25,   t4: 18,   t3: 12,   t2: 6,    inputGuidance: 'Gross take-up divided by current availability. Higher is better.' },
  { id: 14, pillar: 'Demand', name: 'Pre-let rate on new developments',    unit: '% of pipeline',       ruleType: 'Higher', weight: 2.0, t5: 70,   t4: 60,   t3: 50,   t2: 35,   inputGuidance: 'Share of pipeline pre-let before completion. Higher is better.' },
  { id: 15, pillar: 'Demand', name: 'Business formation growth',           unit: '% YoY / CAGR',        ruleType: 'Higher', weight: 2.0, t5: 5,    t4: 4,    t3: 3,    t2: 1.5,  inputGuidance: 'Growth in new business registrations. Higher is better.' },
  { id: 16, pillar: 'Demand', name: 'SME density',                         unit: 'SMEs per 1,000 pop.', ruleType: 'Higher', weight: 2.0, t5: 90,   t4: 75,   t3: 60,   t2: 45,   inputGuidance: 'SMEs per 1,000 population. Higher is better.' },
  { id: 17, pillar: 'Demand', name: 'Large occupier presence',             unit: 'deals / year',        ruleType: 'Higher', weight: 2.0, t5: 12,   t4: 8,    t3: 5,    t2: 2,    inputGuidance: 'Average annual count of large occupier or big-box deals. Higher is better.' },
  { id: 18, pillar: 'Demand', name: 'Industrial / logistics clustering',   unit: 'location quotient',   ruleType: 'Higher', weight: 2.0, t5: 1.5,  t4: 1.3,  t3: 1.0,  t2: 0.8,  inputGuidance: 'Cluster location quotient or similar density measure. Higher is better.' },
  { id: 19, pillar: 'Demand', name: 'Tenant diversification',              unit: '# sectors >10% take-up', ruleType: 'Higher', weight: 2.0, t5: 7, t4: 6,  t3: 5,    t2: 4,    inputGuidance: 'Count of meaningful demand sectors. Higher is better.' },
  { id: 20, pillar: 'Demand', name: 'Lease renewal rate',                  unit: '%',                   ruleType: 'Higher', weight: 2.0, t5: 75,   t4: 65,   t3: 55,   t2: 45,   inputGuidance: 'Share of expiring tenants renewing. Higher is better.' },

  // ── CONNECTIVITY (metrics 21–30, weight 2.0 each) ─────────────────────────
  { id: 21, pillar: 'Connectivity', name: 'Drive time to primary urban core', unit: 'minutes',         ruleType: 'Lower',  weight: 2.0, t5: 30,   t4: 45,   t3: 60,   t2: 90,   inputGuidance: 'Typical drive time to the nearest major urban core. Lower is better.' },
  { id: 22, pillar: 'Connectivity', name: 'Distance to motorway junction',    unit: 'km',              ruleType: 'Lower',  weight: 2.0, t5: 3,    t4: 5,    t3: 10,   t2: 20,   inputGuidance: 'Distance from key industrial node to motorway junction. Lower is better.' },
  { id: 23, pillar: 'Connectivity', name: 'Distance to rail freight terminal', unit: 'km',             ruleType: 'Lower',  weight: 2.0, t5: 15,   t4: 30,   t3: 50,   t2: 80,   inputGuidance: 'Distance to nearest intermodal or rail freight terminal. Lower is better.' },
  { id: 24, pillar: 'Connectivity', name: 'Distance to major port',           unit: 'km',              ruleType: 'Lower',  weight: 2.0, t5: 25,   t4: 50,   t3: 100,  t2: 200,  inputGuidance: 'Distance to nearest major container / freight port. Lower is better.' },
  { id: 25, pillar: 'Connectivity', name: 'Distance to cargo airport',        unit: 'km',              ruleType: 'Lower',  weight: 2.0, t5: 30,   t4: 60,   t3: 100,  t2: 150,  inputGuidance: 'Distance to cargo-capable airport. Lower is better.' },
  { id: 26, pillar: 'Connectivity', name: 'Road freight capacity / reliability', unit: 'score 1–5',    ruleType: 'Direct', weight: 2.0, t5: null, t4: null, t3: null, t2: null, inputGuidance: 'Expert score: 5 = excellent truck corridor capacity/reliability; 1 = constrained.' },
  { id: 27, pillar: 'Connectivity', name: 'Congestion index',                unit: 'index',            ruleType: 'Lower',  weight: 2.0, t5: 1.1,  t4: 1.2,  t3: 1.4,  t2: 1.5,  inputGuidance: 'Typical peak/off-peak travel time ratio. Lower is better.' },
  { id: 28, pillar: 'Connectivity', name: 'Labour commute accessibility',    unit: '% reachable in 45 min', ruleType: 'Higher', weight: 2.0, t5: 80, t4: 70,  t3: 60,   t2: 50,   inputGuidance: 'Working-age population reachable within 45 minutes. Higher is better.' },
  { id: 29, pillar: 'Connectivity', name: 'Distance to power substation',    unit: 'km',               ruleType: 'Lower',  weight: 2.0, t5: 2,    t4: 5,    t3: 10,   t2: 20,   inputGuidance: 'Distance to suitable power substation. Lower is better.' },
  { id: 30, pillar: 'Connectivity', name: 'Available grid capacity',         unit: 'MW',               ruleType: 'Higher', weight: 2.0, t5: 100,  t4: 50,   t3: 20,   t2: 5,    inputGuidance: 'Immediately available or committed power capacity for occupiers. Higher is better.' },

  // ── LABOUR (metrics 31–40, weight 1.5 each) ───────────────────────────────
  { id: 31, pillar: 'Labour', name: 'Population within 30-minute drive',   unit: 'people',              ruleType: 'Higher', weight: 1.5, t5: 1000000, t4: 750000,  t3: 500000,  t2: 250000,  inputGuidance: 'Population reachable within 30 minutes. Higher is better.' },
  { id: 32, pillar: 'Labour', name: 'Population within 60-minute drive',   unit: 'people',              ruleType: 'Higher', weight: 1.5, t5: 3000000, t4: 2000000, t3: 1000000, t2: 500000,  inputGuidance: 'Population reachable within 60 minutes. Higher is better.' },
  { id: 33, pillar: 'Labour', name: 'Population growth (10yr)',             unit: '% over 10 years',     ruleType: 'Higher', weight: 1.5, t5: 10,   t4: 7,    t3: 4,    t2: 1,    inputGuidance: '10-year population growth. Higher is better.' },
  { id: 34, pillar: 'Labour', name: 'Household formation growth (5yr)',     unit: '% over 5 years',      ruleType: 'Higher', weight: 1.5, t5: 8,    t4: 6,    t3: 4,    t2: 2,    inputGuidance: 'Household growth over 5 years. Higher is better.' },
  { id: 35, pillar: 'Labour', name: 'Working-age share',                    unit: '% of population',     ruleType: 'Higher', weight: 1.5, t5: 65,   t4: 62,   t3: 60,   t2: 58,   inputGuidance: 'Share of population in working age band. Higher is better.' },
  { id: 36, pillar: 'Labour', name: 'Unemployment rate',                    unit: '%',                   ruleType: 'Lower',  weight: 1.5, t5: 4,    t4: 5.5,  t3: 7,    t2: 9,    inputGuidance: 'Headline unemployment rate. Lower is better in this investment lens.' },
  { id: 37, pillar: 'Labour', name: 'Economic activity rate',               unit: '%',                   ruleType: 'Higher', weight: 1.5, t5: 78,   t4: 74,   t3: 70,   t2: 66,   inputGuidance: 'Labour force participation / activity rate. Higher is better.' },
  { id: 38, pillar: 'Labour', name: 'Average logistics wage index',         unit: 'index (national=100)', ruleType: 'Lower', weight: 1.5, t5: 90,  t4: 100,  t3: 110,  t2: 120,  inputGuidance: 'Average logistics wage indexed to national average. Lower is better.' },
  { id: 39, pillar: 'Labour', name: 'Labour cost index',                    unit: 'index (national=100)', ruleType: 'Lower', weight: 1.5, t5: 90,  t4: 100,  t3: 110,  t2: 120,  inputGuidance: 'Total labour cost indexed to national average. Lower is better.' },
  { id: 40, pillar: 'Labour', name: 'Logistics / manufacturing workforce share', unit: '% of employment', ruleType: 'Higher', weight: 1.5, t5: 20, t4: 15,   t3: 10,   t2: 7,    inputGuidance: 'Share of local employment in logistics/manufacturing. Higher is better.' },

  // ── RENTS & YIELDS (metrics 41–50, weight 1.5 each) ───────────────────────
  // M41/M42 redefined v5: now direct £psf values sourced from Newmark Multi-let Winter Bulletin Q3 2025
  { id: 41, pillar: 'Rents & Yields', name: 'All-grades ERV (Newmark)',         unit: '£psf', ruleType: 'Higher', weight: 1.5, t5: 15,  t4: 10,  t3: 8,   t2: 6,  inputGuidance: 'Regional all-grades ERV from Newmark Q3 2025. Higher is better.' },
  { id: 42, pillar: 'Rents & Yields', name: 'Prime rent (Newmark)',             unit: '£psf', ruleType: 'Higher', weight: 1.5, t5: 20,  t4: 13,  t3: 10,  t2: 7,  inputGuidance: 'Named location prime rent (market) or regional prime rent (proxy). Higher is better.' },
  { id: 43, pillar: 'Rents & Yields', name: 'Average-to-prime rent ratio',      unit: '%',                    ruleType: 'Higher', weight: 1.5, t5: 80,  t4: 70,  t3: 60,  t2: 50,  inputGuidance: 'Average rent divided by prime rent. Higher is better.' },
  { id: 44, pillar: 'Rents & Yields', name: 'Historic rental growth (5yr CAGR)', unit: '% CAGR',              ruleType: 'Higher', weight: 1.5, t5: 6,   t4: 4.5, t3: 3,   t2: 1.5, inputGuidance: '5-year CAGR in market rents. Higher is better.' },
  { id: 45, pillar: 'Rents & Yields', name: 'Forecast rental growth (3yr CAGR)', unit: '% CAGR',              ruleType: 'Higher', weight: 1.5, t5: 4,   t4: 3,   t3: 2,   t2: 1,   inputGuidance: 'Forward 3-year CAGR in market rents. Higher is better.' },
  { id: 46, pillar: 'Rents & Yields', name: 'Business rates / occupancy cost burden', unit: '% of occupancy cost', ruleType: 'Lower', weight: 1.5, t5: 8, t4: 10,  t3: 12,  t2: 15,  inputGuidance: 'Business rates or equivalent burden as % of occupancy cost. Lower is better.' },
  { id: 47, pillar: 'Rents & Yields', name: 'Incentive level',                  unit: 'months free on 10yr lease', ruleType: 'Lower', weight: 1.5, t5: 3, t4: 6,  t3: 9,   t2: 12,  inputGuidance: 'Typical leasing incentive. Lower is better.' },
  { id: 48, pillar: 'Rents & Yields', name: 'Prime yield',                      unit: '%',                    ruleType: 'Lower',  weight: 1.5, t5: 4.5, t4: 5,  t3: 5.5, t2: 6,   inputGuidance: 'Prime yield. Lower generally indicates stronger liquidity and pricing.' },
  { id: 49, pillar: 'Rents & Yields', name: 'Prime yield vs prior peak',        unit: 'bps',                  ruleType: 'Higher', weight: 1.5, t5: 150, t4: 100, t3: 50,  t2: 0,   inputGuidance: 'Current prime yield minus previous cycle trough/peak in bps. Higher is better for entry point.' },
  { id: 50, pillar: 'Rents & Yields', name: 'Yield spread vs government bonds', unit: 'bps',                  ruleType: 'Higher', weight: 1.5, t5: 300, t4: 250, t3: 200, t2: 150, inputGuidance: 'Prime yield spread over government bonds. Higher is better.' },

  // ── STRATEGIC / RISK (metrics 51–60, weight 1.0 each) ────────────────────
  { id: 51, pillar: 'Strategic / Risk', name: 'Investment transaction volume', unit: 'GBP £m',              ruleType: 'Higher', weight: 1.0, t5: 1000, t4: 500,  t3: 250, t2: 100, inputGuidance: '12-month industrial investment volume. Higher is better.' },
  { id: 52, pillar: 'Strategic / Risk', name: 'Investment deal count',         unit: 'deals / year',        ruleType: 'Higher', weight: 1.0, t5: 20,   t4: 15,   t3: 10,  t2: 5,   inputGuidance: 'Number of meaningful investment trades. Higher is better.' },
  { id: 53, pillar: 'Strategic / Risk', name: 'Lot size depth',                unit: 'count of active bands', ruleType: 'Higher', weight: 1.0, t5: 4, t4: 3,    t3: 2,   t2: 1,   inputGuidance: 'Count of active lot-size bands (small/mid/large/XXL) with evidence of liquidity. Higher is better.' },
  { id: 54, pillar: 'Strategic / Risk', name: 'Competing land-use pressure',   unit: 'residential/industrial land value multiple', ruleType: 'Lower', weight: 1.0, t5: 1.2, t4: 1.5, t3: 2.0, t2: 3.0, inputGuidance: 'Residential land value premium versus industrial land. Lower is better.' },
  { id: 55, pillar: 'Strategic / Risk', name: 'Planning policy support for industrial', unit: 'score 1–5',   ruleType: 'Direct', weight: 1.0, t5: null, t4: null, t3: null, t2: null, inputGuidance: 'Expert score: 5 = very supportive policy environment; 1 = hostile or restrictive.' },
  { id: 56, pillar: 'Strategic / Risk', name: 'Proximity to housing growth',   unit: 'annual new homes within 15km', ruleType: 'Higher', weight: 1.0, t5: 5000, t4: 2500, t3: 1000, t2: 500, inputGuidance: 'New home completions within labour catchment. Higher is better.' },
  { id: 57, pillar: 'Strategic / Risk', name: 'ESG quality of stock',          unit: '% of stock certified', ruleType: 'Higher', weight: 1.0, t5: 60,   t4: 45,   t3: 30,  t2: 15,  inputGuidance: 'Share of stock with strong ESG certification/specification. Higher is better.' },
  { id: 58, pillar: 'Strategic / Risk', name: 'Climate / flood risk exposure',  unit: '% of stock in high-risk zones', ruleType: 'Lower', weight: 1.0, t5: 5, t4: 10, t3: 20, t2: 30, inputGuidance: 'Share of stock exposed to high climate/flood risk. Lower is better.' },
  { id: 59, pillar: 'Strategic / Risk', name: 'Digital infrastructure quality', unit: 'Mbps available',      ruleType: 'Higher', weight: 1.0, t5: 1000, t4: 500,  t3: 200, t2: 100, inputGuidance: 'Typical business-grade broadband speed. Higher is better.' },
  { id: 60, pillar: 'Strategic / Risk', name: 'EV / fleet electrification readiness', unit: '% of stock EV-ready', ruleType: 'Higher', weight: 1.0, t5: 50, t4: 35, t3: 20, t2: 10, inputGuidance: 'Share of stock with meaningful EV charging / power readiness. Higher is better.' },

  // ── SUPPLY — VOA MLI (metrics 61–64, weight 1.0 each) ──────────────────────
  // Derived from the VOA compiled rating list via scrapers/voa_scraper.py.
  // See scrapers/config/voa_scat_filter.json for filter methodology.
  // Scotland + NI have no VOA coverage (these metrics will be null there).
  { id: 61, pillar: 'Supply', name: 'MLI stock (VOA)',                    unit: 'sqft',            ruleType: 'Higher', weight: 1.0, t5: 5000000, t4: 2500000, t3: 1500000, t2: 750000,  inputGuidance: 'Total gross internal area of multi-let light industrial stock (<464m² GIA). Higher = more investable stock depth.' },
  { id: 62, pillar: 'Supply', name: 'MLI unit count (VOA)',               unit: 'units',           ruleType: 'Higher', weight: 1.0, t5: 5000,    t4: 2500,    t3: 1500,    t2: 750,     inputGuidance: 'Number of MLI hereditaments (SCat 096/408/994). Higher = deeper transaction pool.' },
  { id: 63, pillar: 'Supply', name: 'MLI concentration (VOA)',            unit: '%',               ruleType: 'Higher', weight: 1.0, t5: 80,      t4: 75,      t3: 70,      t2: 60,      inputGuidance: 'Share of industrial units under 464m² GIA. Higher = MLI-dominated structure (favourable for small-unit investors).' },
  { id: 64, pillar: 'Supply', name: 'MLI net new supply (VOA)',           unit: 'units (3yr)',     ruleType: 'Lower',  weight: 1.0, t5: 20,      t4: 50,      t3: 100,     t2: 250,     inputGuidance: 'Net change in MLI unit count between 2023 and 2026 VOA lists. Lower = tighter supply, more rent tension.' },

  // ── NEWMARK (metrics 65–72) — Newmark Multi-let Winter Bulletin Q3 2025 ───
  // Regional-level unless noted. String IDs (newmark_*) are mapped to these
  // numeric IDs by scrapers/data_merger.py.
  { id: 65, pillar: 'Rents & Yields',   name: 'Equivalent yield (Newmark)',         unit: '%',      ruleType: 'Higher', weight: 1.5, t5: 5.75, t4: 5.30, t3: 5.00, t2: 4.75, inputGuidance: 'Regional equivalent yield from Newmark Q3 2025. For a buyer, higher yield is better.' },
  { id: 66, pillar: 'Rents & Yields',   name: 'Yield spread vs 10-yr gilt',         unit: '%',      ruleType: 'Higher', weight: 1.5, t5: 3.0,  t4: 2.0,  t3: 1.0,  t2: 0.0,  inputGuidance: 'Newmark equivalent yield minus live UK 10-year gilt yield (calculated in data_merger). Higher is better.' },
  { id: 67, pillar: 'Rents & Yields',   name: 'Rental reversion (Newmark)',         unit: '%',      ruleType: 'Higher', weight: 1.5, t5: 20,   t4: 15,   t3: 10,   t2: 5,    inputGuidance: 'Regional rental reversion (chart-approximated). Higher = more upside in passing rents.' },
  { id: 68, pillar: 'Rents & Yields',   name: 'Prime rent growth forecast',         unit: '% pa',   ruleType: 'Higher', weight: 1.5, t5: 4.0,  t4: 3.0,  t3: 2.0,  t2: 1.0,  inputGuidance: 'Newmark 2024-29 annual prime rent growth forecast (regional).' },
  { id: 69, pillar: 'Supply',           name: 'MLI vacancy (Newmark)',              unit: '%',      ruleType: 'Lower',  weight: 2.0, t5: 6,    t4: 9,    t3: 12,   t2: 15,   inputGuidance: 'Regional MLI vacancy rate from Newmark (chart-approx). Lower is better.' },
  { id: 70, pillar: 'Demand',           name: 'Occupier retention rate',            unit: '%',      ruleType: 'Higher', weight: 2.0, t5: 72,   t4: 65,   t3: 58,   t2: 50,   inputGuidance: 'UK multi-let retention after expiry (Newmark, national).' },
  { id: 71, pillar: 'Demand',           name: 'MLI default rate',                   unit: '%',      ruleType: 'Lower',  weight: 2.0, t5: 0.5,  t4: 1.0,  t3: 1.5,  t2: 2.5,  inputGuidance: 'Newmark multi-let default rate (national). Lower is better.' },
  { id: 72, pillar: 'Strategic / Risk', name: 'Development pipeline months supply', unit: 'months', ruleType: 'Lower',  weight: 1.0, t5: 1,    t4: 2,    t3: 3,    t2: 5,    inputGuidance: 'Months of supply from Newmark pipeline at current take-up rate. Lower = tighter supply.' },
];

// Default pillar weights: equal across all six (≈ 16.67% each), sums to 100.
// Integer approximation (17/17/17/17/16/16) so display is clean; scoring normalizes.
export const PILLARS: Array<{ name: import('../types').Pillar; totalWeight: number; colour: string }> = [
  { name: 'Supply',           totalWeight: 17, colour: '#7C3AED' },
  { name: 'Demand',           totalWeight: 17, colour: '#4F46E5' },
  { name: 'Connectivity',     totalWeight: 17, colour: '#0891B2' },
  { name: 'Labour',           totalWeight: 17, colour: '#059669' },
  { name: 'Rents & Yields',   totalWeight: 16, colour: '#D97706' },
  { name: 'Strategic / Risk', totalWeight: 16, colour: '#DC2626' },
];

export const CONFIG = {
  totalGreen: 80,
  totalAmber: 60,
  metricGreen: 4,
  metricAmber: 3,
};
