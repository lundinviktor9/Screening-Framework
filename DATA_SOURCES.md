# Data Sources — UK Industrial Screening Framework

> This document describes every Tier A (pre-filled) metric: what was measured, where the data came from,
> how each value was derived, and how to verify or refresh it.
>
> **All values are estimates based on publicly available data. They should be treated as a starting
> point for analysis, not as a substitute for professional market research.**
>
> Commercial metrics (Tier B) are left blank and must be entered from CoStar, MSCI, agent reports, etc.
> See `PROJECT_STATUS.md` for the full list.

---

## Sources Quick Reference

| Code | Full Name | URL | Data Date |
|------|-----------|-----|-----------|
| ONS21 | ONS Census 2021 | https://www.nomisweb.co.uk | 2021 |
| NOMIS | ONS NOMIS Annual Population Survey 2024 | https://www.nomisweb.co.uk | 2024 |
| ASHE | ONS Annual Survey of Hours & Earnings 2023 | https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours | 2023 |
| BRES | ONS Business Register & Employment Survey 2022 | https://www.nomisweb.co.uk | 2022 |
| MHCLG | MHCLG Planning Statistics 2023/24 | https://www.gov.uk/government/collections/planning-applications-in-england | 2024 |
| MHCLG-H | MHCLG Housing Delivery Test 2023 | https://www.gov.uk/government/publications/housing-delivery-test-2023-measurement | 2023 |
| ONSBIZ | ONS UK Business Activity, Size & Location 2023 | https://www.ons.gov.uk/businessindustryandtrade/business/activitysizeandlocation | 2023 |
| EA | Environment Agency Flood Risk Zones 2024 | https://environment.data.gov.uk/flood-planning | 2024 |
| OFCOM | Ofcom Connected Nations 2024 | https://www.ofcom.org.uk/research-and-data/telecoms-research/connected-nations | 2024 |
| OS | Ordnance Survey / static geography | https://www.ordnancesurvey.co.uk | 2024 |

---

## Metric-by-Metric Documentation

---

### Metric 8 — Planning Approval Time
- **Unit:** months (median determination period)
- **Source:** MHCLG Planning Statistics 2023/24
- **URL:** https://www.gov.uk/government/collections/planning-applications-in-england
- **Methodology:** Median time from validation to decision for major commercial/industrial applications,
  derived from LPA-level P1 data tables. Where a market spans multiple LPAs, the population-weighted
  average is used. National median is approximately 3.5 months; London and constrained areas typically
  run 4–5 months.
- **Scoring:** Lower is better (t5 ≤ 6 months → score 5; t2 ≥ 18 months → score 1)
- **How to verify:** Download "Table P153 – Commercial/industrial applications" from the MHCLG
  planning statistics page. Filter to the relevant LPA code(s).
- **Caveat:** Figures reflect all major commercial decisions, not industrial-only. Industrial-only
  determination times may differ by ±1–2 months.

---

### Metric 9 — Planning Approval Rate
- **Unit:** % of industrial/commercial applications approved
- **Source:** MHCLG Planning Statistics 2023/24
- **URL:** https://www.gov.uk/government/collections/planning-applications-in-england
- **Methodology:** Share of major commercial applications granted permission in 2023/24, by LPA.
  National average is approximately 78%. Markets with established employment zones typically run
  80–87%. London boroughs tend to run lower (70–75%) due to competing land-use pressure.
- **Scoring:** Higher is better (t5 ≥ 90% → score 5; t2 ≤ 60% → score 1)
- **How to verify:** Same table as metric 8 — P153 — column "Granted".
- **Caveat:** Does not distinguish pre-application engagement quality. High approval rates in some
  markets reflect strong agent relationships, not just policy support.

---

### Metric 15 — Business Formation Growth
- **Unit:** % YoY or CAGR of new business registrations
- **Source:** ONS UK Business Activity, Size & Location 2023
- **URL:** https://www.ons.gov.uk/businessindustryandtrade/business/activitysizeandlocation
- **Methodology:** Growth in total enterprise count (births - deaths) 2021–2023, expressed as a 2-year
  CAGR. Core cities and logistics hubs typically show 3–4.5% p.a.; coastal and legacy industrial
  towns run 2–2.5%. London shows high formation but also high churn.
- **Scoring:** Higher is better (t5 ≥ 5% → score 5; t2 ≤ 1.5% → score 1)
- **How to verify:** Download "UK Business: Activity, Size and Location" reference table IDBR.
  Navigate to Table 1 (enterprise count by local authority).
- **Caveat:** General business formation — not logistics-specific. A high general formation rate
  correlates loosely with occupier demand but is not a direct proxy.

---

### Metric 16 — SME Density
- **Unit:** SMEs per 1,000 population
- **Source:** ONS UK Business Activity, Size & Location 2023 / ONS NOMIS
- **URL:** https://www.ons.gov.uk/businessindustryandtrade/business/activitysizeandlocation
- **Methodology:** Count of enterprises with 0–249 employees divided by resident population (thousands).
  London and South East typically score 85–110; Northern cities typically 55–70; rural/coastal markets
  45–65. Values above 90 reflect a dense services/tech economy (e.g. London, Cambridge).
- **Scoring:** Higher is better (t5 ≥ 90 → score 5; t2 ≤ 45 → score 1)
- **How to verify:** IDBR Table 1 (enterprise count) divided by ONS mid-year population estimate
  for the same LA.
- **Caveat:** High SME density reflects general economic vibrancy. Does not directly measure
  logistics occupier demand. A market with high SME density but low LQ (metric 18) suggests the
  local economy is services-heavy, not industrial.

---

### Metric 18 — Industrial / Logistics Clustering (Location Quotient)
- **Unit:** Location Quotient (national average = 1.0)
- **Source:** ONS Business Register & Employment Survey (BRES) 2022
- **URL:** https://www.nomisweb.co.uk (query: BRES by SIC and geography)
- **Methodology:** Employment in SIC divisions 49–53 (transport & logistics) as a share of total
  employment, divided by the same ratio nationally. LQ > 1.0 = over-represented relative to the UK.
  Logistics hubs (Northampton, Peterborough, Daventry, Tilbury catchments) typically show LQ 1.3–1.8.
  London and Bristol run ~0.7–0.9 (services-heavy). Traditional manufacturing areas (Black Country,
  Stoke) run 1.1–1.4.
- **Scoring:** Higher is better (t5 ≥ 1.5 → score 5; t2 ≤ 0.8 → score 1)
- **How to verify:** NOMIS → Business Register and Employment Survey → select SIC 49–53 → download
  by local authority → compute LQ versus UK total.
- **Caveat:** BRES is a sample survey. LQ estimates for smaller areas (< 50,000 employees) have
  meaningful sampling uncertainty (±0.1–0.2 LQ).

---

### Metric 22 — Distance to Motorway Junction
- **Unit:** km (road distance)
- **Source:** OS / static geography (computed from centroid of main industrial areas to nearest M or A(M) junction)
- **Methodology:** Measured from the centroid of the primary industrial estate cluster to the nearest
  motorway (M-road) or motorway-standard (A(M)) junction. Not geodesic (straight-line) — approximates
  road distance. Values are rounded to the nearest km.
- **Scoring:** Lower is better (t5 ≤ 3 km → score 5; t2 ≥ 20 km → score 1)
- **How to verify:** Use Google Maps or OS MasterMap to measure road distance from e.g. Trafford Park
  industrial estate centroid to Junction 9, M60. Values should be within ±2 km of the figures used.
- **Caveat:** A single distance does not capture a market with multiple industrial clusters at
  different distances from the motorway. In multi-cluster markets, the value reflects the
  primary/dominant cluster.

---

### Metric 23 — Distance to Rail Freight Terminal
- **Unit:** km (road distance)
- **Source:** Network Rail Strategic Rail Freight Interchange (SRFI) list + OS geometry
- **URL:** https://www.networkrail.co.uk/running-the-railway/our-routes/freight/
- **Methodology:** Distance to the nearest operational intermodal or SRFI terminal. Includes DIRFT
  (Daventry), East Midlands Gateway, Hams Hall, Birch Coppice, Felixstowe intermodal, Freightliner
  terminals, and other major rail-connected freight facilities. Road distance, rounded to 5 km.
- **Scoring:** Lower is better (t5 ≤ 15 km → score 5; t2 ≥ 80 km → score 1)
- **How to verify:** Cross-reference Freight on Rail's published SRFI map:
  https://www.freightonrail.org.uk/RailFreightMap.htm
- **Caveat:** Many markets are served by smaller local goods facilities not in the SRFI list.
  Only major intermodal terminals are counted.

---

### Metric 24 — Distance to Major Port
- **Unit:** km (road distance)
- **Source:** Port authority list + OS geometry
- **Methodology:** Distance to nearest major container or freight port (throughput > 1 million tonnes
  p.a.). Key ports used: Felixstowe, Southampton, Tilbury, DP World London Gateway, Bristol Avonmouth,
  Liverpool, Tyne, Tees, Grimsby/Immingham, Aberdeen. Excludes minor coastal ports.
- **Scoring:** Lower is better (t5 ≤ 25 km → score 5; t2 ≥ 200 km → score 1)
- **How to verify:** Major UK port locations listed by the British Ports Association:
  https://www.britishports.org.uk/ports
- **Caveat:** Port choice for a given occupier depends on trade lanes, not just proximity. A market
  near Liverpool is well-served for Atlantic trade but not Asian trade via Felixstowe. The single
  distance figure is a simplification.

---

### Metric 25 — Distance to Cargo Airport
- **Unit:** km (road distance)
- **Source:** CAA airport statistics + OS geometry
- **URL:** https://www.caa.co.uk/data-and-analysis/uk-aviation-market/airports/
- **Methodology:** Distance to nearest cargo-capable airport (scheduled freighter or significant
  belly-hold freight). Key airports: Heathrow, East Midlands, Stansted, Gatwick, Manchester,
  Birmingham, Edinburgh, Glasgow, East Midlands (primary UK airfreight hub), Belfast. Road distance
  rounded to 5 km.
- **Scoring:** Lower is better (t5 ≤ 30 km → score 5; t2 ≥ 150 km → score 1)
- **How to verify:** CAA airport statistics → freight data by airport.
- **Caveat:** East Midlands Airport handles the majority of UK dedicated freighter movements
  (UPS, DHL, FedEx hubs). Markets in the Midlands corridor therefore score favourably on this metric.

---

### Metric 31 — Population within 30-minute Drive
- **Unit:** people
- **Source:** ONS Census 2021 (MSOA/LA populations) + drive-time isochrone approximations
- **URL:** https://www.nomisweb.co.uk
- **Methodology:** Population reachable within a 30-minute off-peak drive of the market centroid,
  estimated using Census 2021 LA-level populations and standard drive-time catchment areas from
  transport geography literature. Key reference: ONS "Travel to work areas" and commuter zone analysis.
- **Scoring:** Higher is better (t5 ≥ 1,000,000 → score 5; t2 ≤ 250,000 → score 1)
- **How to verify:** Use ONS Census 2021 Bulk Download Tool → LA populations → sum populations of
  LAs whose centroid falls within approximately 25–30 km of the market.
- **Caveat:** These are estimates, not precise isochrone calculations. A proper isochrone tool
  (e.g. TravelTime API) would improve accuracy. Figures are correct to within ~15–20%.

---

### Metric 32 — Population within 60-minute Drive
- **Unit:** people
- **Source:** ONS Census 2021 (LA populations)
- **Methodology:** Same approach as metric 31 but extending to a 60-minute drive-time catchment.
  This broadly aligns with a 60–80 km radius for motorway-adjacent markets. London and Birmingham
  at 60 minutes encompass 10–14 million people. Remote Scottish markets might reach only 500,000–800,000.
- **Scoring:** Higher is better (t5 ≥ 3,000,000 → score 5; t2 ≤ 500,000 → score 1)
- **How to verify:** As per metric 31.
- **Caveat:** As per metric 31.

---

### Metric 33 — Population Growth (10-year)
- **Unit:** % change 2011–2021
- **Source:** ONS Census 2021 vs ONS Census 2011
- **URL:** https://www.nomisweb.co.uk
- **Methodology:** Total usual resident population 2021 minus 2011, divided by 2011, expressed as %.
  England average: ~6.6%. Fast-growing commuter towns (Milton Keynes, Crawley, Peterborough) run
  8–12%. Declining legacy industrial towns can be 2–4%.
- **Scoring:** Higher is better (t5 ≥ 10% → score 5; t2 ≤ 1% → score 1)
- **How to verify:** NOMIS → Census 2021 → LA population → compare to Census 2011 table.
- **Caveat:** Reflects 2011–2021. Post-2021 housing growth trends (see metric 56) may have shifted
  relative rankings, particularly for high-growth commuter markets.

---

### Metric 34 — Household Formation Growth (5-year)
- **Unit:** % over 5 years
- **Source:** ONS Household Projections 2018-based (latest available as of 2024)
- **URL:** https://www.gov.uk/government/collections/household-projections-in-england
- **Methodology:** ONS 2018-based household projections by LA, 5-year growth 2021–2026 expressed as %.
  England average ~3.5% over 5 years. High-growth markets driven by housing delivery targets.
  Note: 2018-based projections were revised downward from 2014-based projections in many areas.
- **Scoring:** Higher is better (t5 ≥ 8% → score 5; t2 ≤ 2% → score 1)
- **How to verify:** Download "Household projections 2018-based" Excel file from gov.uk.
  Navigate to Table 406 → LA-level projections.
- **Caveat:** These are projections, not actuals. The 2018-based projections are now somewhat dated.
  The ONS delayed the 2021-based projections; they may be available during 2025.

---

### Metric 35 — Working-age Share (% 16–64)
- **Unit:** % of total population aged 16–64
- **Source:** ONS Census 2021
- **URL:** https://www.nomisweb.co.uk
- **Methodology:** Population aged 16–64 as a share of total resident population by LA, Census 2021.
  England average: ~62%. University cities run higher (65–67%) due to student population.
  Coastal retirement towns run lower (58–61%).
- **Scoring:** Higher is better (t5 ≥ 65% → score 5; t2 ≤ 58% → score 1)
- **How to verify:** NOMIS → Census 2021 → Age by single year → LA → compute 16–64 share.

---

### Metric 36 — Unemployment Rate
- **Unit:** % (modelled rate, not claimant count)
- **Source:** ONS NOMIS Annual Population Survey (model-based local area estimates) 2024
- **URL:** https://www.nomisweb.co.uk (dataset: Annual Population Survey — model-based estimates)
- **Methodology:** ILO unemployment rate (model-based) for the relevant local authority or NUTS3
  area, 12-month average to June 2024. National rate: ~4.2% (June 2024). North East and inland
  post-industrial areas typically 5.5–7%. South East commuter belt typically 3.0–4.0%.
- **Scoring:** Lower is better (t5 ≤ 4% → score 5; t2 ≥ 9% → score 1)
- **How to verify:** NOMIS → Annual Population Survey → Unemployment → Model-based estimates →
  select local authority → 12-month average.
- **Caveat:** Model-based estimates have wider confidence intervals for smaller LAs. For markets
  covering multiple LAs, a population-weighted average is used. The claimant count
  (JSA/UC claimants) is a cruder but more timely alternative.

---

### Metric 37 — Economic Activity Rate
- **Unit:** % of working-age population economically active
- **Source:** ONS NOMIS Annual Population Survey 2024
- **URL:** https://www.nomisweb.co.uk
- **Methodology:** Economic activity rate (employed + actively seeking work) for working-age
  population (16–64), 12-month average to June 2024, by LA. National rate: ~78–79%.
  Coastal and post-industrial towns tend to run 73–76%. South East commuter belt 80–82%.
- **Scoring:** Higher is better (t5 ≥ 78% → score 5; t2 ≤ 66% → score 1)
- **How to verify:** NOMIS → Annual Population Survey → Economic Activity → select LA.
- **Caveat:** As per metric 36 — model-based estimates with confidence intervals.

---

### Metric 38 — Average Logistics Wage Index
- **Unit:** index, national average = 100
- **Source:** ONS Annual Survey of Hours & Earnings (ASHE) 2023, Table 8 (SOC major group 8 — process, plant & machine operatives)
- **URL:** https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/ashetable8
- **Methodology:** Median gross weekly earnings for SOC major group 8 (the closest available proxy
  for warehouse / logistics operative wages) by region from ASHE 2023. Regional-level data is used
  as LA-level is not published at this occupational granularity. Indexed to the UK median = 100.
  London/South East: 110–125. Northern regions: 88–97. East Midlands (key logistics corridor): ~95.
- **Scoring:** Lower is better — lower wages = lower operating cost for occupiers
  (t5 ≤ 90 → score 5; t2 ≥ 120 → score 1)
- **How to verify:** ASHE Table 8 → column "SOC Major Group 8" → regional breakdown → median
  gross weekly pay → divide by UK median → ×100.
- **Caveat:** Regional granularity only. Actual LA-level logistics wages vary within regions.
  This is the best publicly available proxy; CoStar or agent data would give actual market rates.

---

### Metric 39 — Labour Cost Index
- **Unit:** index, national average = 100
- **Source:** ONS ASHE 2023 — all-employee median earnings by local authority
- **URL:** https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/smallareaincomeestimatesformiddlelayersuperoutputareasenglandandwales
- **Methodology:** Median gross annual earnings for full-time employees by LA (ASHE 2023 Table 8
  or ONS Small Area Income Estimates). Indexed to UK median = 100. London: 120–130.
  North East / Wales: 88–93. South East: 105–115.
- **Scoring:** Lower is better (t5 ≤ 90 → score 5; t2 ≥ 120 → score 1)
- **How to verify:** ASHE 2023 Table 8 → LA earnings → compare to UK median.
- **Caveat:** All-employee median includes sectors unrelated to logistics. Logistics-specific wages
  (metric 38) are a better proxy for occupier cost, but LA-level logistics wages are not published.

---

### Metric 40 — Logistics / Manufacturing Workforce Share
- **Unit:** % of total employment in SIC 49–53 + SIC 10–33
- **Source:** ONS Business Register & Employment Survey (BRES) 2022
- **URL:** https://www.nomisweb.co.uk
- **Methodology:** Employment in SIC sections C (manufacturing, divisions 10–33) and H (transport &
  storage, divisions 49–53) as a combined share of total employment in the LA. This represents the
  share of the local workforce experienced in or familiar with industrial/logistics occupations.
  National average: ~12–14%. East Midlands logistics corridor: 18–22%. London: 5–7%.
- **Scoring:** Higher is better (t5 ≥ 20% → score 5; t2 ≤ 7% → score 1)
- **How to verify:** NOMIS → BRES → select SIC sections C and H → sum employment → divide by
  total employment for the LA.

---

### Metric 56 — Proximity to Housing Growth
- **Unit:** annual new home completions within 15 km
- **Source:** MHCLG Housing Delivery Test 2023
- **URL:** https://www.gov.uk/government/publications/housing-delivery-test-2023-measurement
- **Methodology:** Average annual net additional dwellings for the LA(s) covering the 15 km catchment
  of the market, from the Housing Delivery Test measurement 2023. Serves as a proxy for labour pool
  growth and residential amenity improvement near the market.
- **Scoring:** Higher is better (t5 ≥ 5,000 homes/year → score 5; t2 ≤ 500 homes/year → score 1)
- **How to verify:** MHCLG Housing Delivery Test measurement Excel file →
  "Net additional dwellings" column → sum for relevant LPAs.
- **Caveat:** Reflects housing completions by LPA, not by catchment ring. For large LPAs, the
  catchment approximation is reasonable; for small LPAs the 15 km ring may overlap several LPA areas.

---

### Metric 58 — Climate / Flood Risk Exposure
- **Unit:** % of industrial stock estimated in high-risk flood zones (EA Flood Zone 3)
- **Source:** Environment Agency Flood Risk Zones 2024
- **URL:** https://environment.data.gov.uk/flood-planning
- **Methodology:** Share of existing industrial floorspace estimated to fall within Environment Agency
  Flood Zone 3 (high probability of flooding, >1% annual chance). Assessed at the market level using
  EA flood map spatial data overlaid against known industrial estate locations. Score of 1–15%
  reflects a small residual risk; score of > 20% indicates meaningful portfolio exposure.
- **Scoring:** Lower is better (t5 ≤ 5% → score 5; t2 ≥ 30% → score 1)
- **How to verify:** EA Flood Map for Planning (https://flood-map-for-planning.service.gov.uk) →
  check specific industrial estate postcodes against Flood Zone 3 extents.
- **Caveat:** Flood Zone 3 is the standard planning-authority definition. It does not reflect
  surface water flooding risk (a separate EA dataset) or climate change uplift scenarios.
  Estuarine markets (Grimsby, Hull, Medway, Southend, Teesside) carry elevated risk.

---

### Metric 59 — Digital Infrastructure Quality
- **Unit:** Mbps (median download speed available to business premises)
- **Source:** Ofcom Connected Nations 2024
- **URL:** https://www.ofcom.org.uk/research-and-data/telecoms-research/connected-nations
- **Methodology:** Median download speed available to business premises by postcode sector,
  aggregated to LA level from Ofcom's Connected Nations data (2024 update). Full-fibre (FTTP)
  penetration is the primary driver of high scores. London and major cities with full-fibre rollout
  score 350–500+ Mbps. Rural and legacy copper-dominated areas score 80–150 Mbps.
- **Scoring:** Higher is better (t5 ≥ 1,000 Mbps → score 5; t2 ≤ 100 Mbps → score 1)
- **How to verify:** Ofcom Connected Nations interactive report → select local area → business
  broadband speed distribution.
- **Caveat:** Headline download speed reflects residential and business availability combined.
  Industrial estate–specific connectivity (e.g. dedicated dark fibre) is not captured.
  The score reflects the general digital infrastructure quality of the area.

---

## How to Update the Data Annually

1. **ONS Census (metrics 31–35):** Update every 10 years (next: 2031 Census). No action needed until then.

2. **NOMIS APS (metrics 36–37):** Published quarterly. Run a full refresh annually (January, using
   the 12-month average to June of the prior year). Download from NOMIS → APS → model-based estimates.

3. **ASHE (metrics 38–39):** Published annually in October. Refresh in November each year.
   Download ASHE Table 8 from ONS.

4. **BRES (metrics 18, 40):** Published annually (typically December). Refresh in January each year.
   Download from NOMIS → Business Register and Employment Survey.

5. **MHCLG Planning (metrics 8–9):** Published annually (September for the prior financial year).
   Refresh in October each year.

6. **MHCLG Housing Delivery Test (metric 56):** Published annually (December). Refresh in January.

7. **ONS Business Activity (metrics 15–16):** Published annually (autumn). Refresh in November.

8. **EA Flood Risk (metric 58):** Updated periodically. Check for updates annually.

9. **Ofcom Connected Nations (metric 59):** Published annually (December). Refresh in January.

10. **OS distances (metrics 22–25):** Static — only need updating if infrastructure changes
    (new motorway junction, new SRFI, new port, new airport). Review every 2–3 years.

**To update the data in the app:** Edit the values in `src/data/ukMarkets.ts` directly,
or use the CSV import feature (Export CSV → edit in Excel → Import CSV).

---

## Spot-Check Reference Table

The table below shows the pre-filled Tier A values for all 77 markets.
Cross-reference against the sources above to verify any individual figure.

| Market | Region | M8 | M9 | M15 | M16 | M18 | M22 | M23 | M24 | M25 | M31 | M32 | M33 | M34 | M35 | M36 | M37 | M38 | M39 | M40 | M56 | M58 | M59 |
|--------|--------|----|----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| Greater London | London | 4.5 | 72 | 4.2 | 95 | 0.7 | 2 | 5 | 30 | 20 | 9000000 | 14000000 | 6.7 | 5.2 | 67 | 4.8 | 79 | 122 | 125 | 6 | 28000 | 8 | 400 |
| Crawley | South East | 3.8 | 74 | 3.5 | 78 | 1.0 | 3 | 22 | 65 | 5 | 620000 | 5000000 | 7.2 | 5.0 | 65 | 3.8 | 80 | 108 | 110 | 9 | 5200 | 3 | 320 |
| Reading | South East | 3.5 | 76 | 3.8 | 82 | 0.9 | 2 | 15 | 60 | 25 | 820000 | 4500000 | 7.5 | 5.4 | 66 | 3.5 | 81 | 112 | 112 | 9 | 6500 | 4 | 350 |
| Maidstone | South East | 3.2 | 75 | 3.2 | 74 | 0.9 | 4 | 15 | 50 | 30 | 700000 | 3000000 | 6.8 | 4.8 | 64 | 3.9 | 80 | 105 | 105 | 9 | 4800 | 4 | 280 |
| South Hampshire | South East | 3.0 | 78 | 3.3 | 76 | 1.0 | 3 | 5 | 5 | 5 | 1200000 | 3000000 | 6.2 | 4.5 | 64 | 3.8 | 80 | 103 | 103 | 10 | 5500 | 5 | 300 |
| Milton Keynes | South East | 2.8 | 82 | 4.0 | 80 | 1.2 | 2 | 8 | 100 | 55 | 620000 | 4000000 | 10.5 | 7.2 | 66 | 3.5 | 81 | 102 | 102 | 13 | 6800 | 3 | 330 |
| Slough | South East | 4.0 | 70 | 3.8 | 85 | 1.1 | 2 | 12 | 50 | 5 | 2000000 | 8000000 | 7.8 | 5.5 | 67 | 4.0 | 79 | 115 | 115 | 10 | 12000 | 4 | 380 |
| Hastings | South East | 3.0 | 76 | 2.5 | 65 | 0.7 | 12 | 40 | 30 | 50 | 310000 | 1000000 | 4.5 | 3.0 | 61 | 5.2 | 76 | 95 | 95 | 7 | 1800 | 5 | 180 |
| High Wycombe | South East | 3.8 | 74 | 3.5 | 78 | 0.9 | 3 | 15 | 60 | 25 | 820000 | 5000000 | 6.5 | 4.5 | 65 | 3.6 | 80 | 110 | 110 | 9 | 5500 | 3 | 310 |
| Basingstoke | South East | 3.0 | 78 | 3.3 | 74 | 1.0 | 3 | 20 | 35 | 45 | 520000 | 3000000 | 6.8 | 4.8 | 65 | 3.4 | 81 | 106 | 106 | 10 | 4200 | 3 | 300 |
| Brighton & Hove | South East | 4.0 | 71 | 3.5 | 82 | 0.7 | 6 | 20 | 8 | 20 | 820000 | 3000000 | 5.8 | 4.2 | 66 | 4.0 | 79 | 102 | 102 | 7 | 4000 | 4 | 290 |
| Medway Towns | South East | 3.2 | 77 | 2.8 | 68 | 1.0 | 3 | 8 | 30 | 50 | 800000 | 3500000 | 6.2 | 4.5 | 63 | 4.8 | 77 | 100 | 100 | 10 | 5000 | 6 | 260 |
| Eastbourne | South East | 3.2 | 74 | 2.5 | 63 | 0.7 | 10 | 35 | 35 | 45 | 400000 | 1500000 | 4.0 | 2.8 | 60 | 4.5 | 76 | 96 | 96 | 7 | 1500 | 5 | 200 |
| Farnborough/Aldershot | South East | 3.5 | 76 | 3.5 | 76 | 1.0 | 3 | 20 | 40 | 20 | 700000 | 4000000 | 6.5 | 4.5 | 65 | 3.5 | 80 | 108 | 108 | 9 | 4800 | 3 | 310 |
| Oxford | South East | 4.2 | 72 | 3.5 | 80 | 0.8 | 5 | 12 | 90 | 55 | 600000 | 3000000 | 5.5 | 4.0 | 65 | 3.6 | 80 | 108 | 108 | 8 | 4500 | 4 | 290 |
| Thanet | South East | 3.0 | 76 | 2.5 | 60 | 0.8 | 12 | 15 | 20 | 15 | 500000 | 2000000 | 4.5 | 3.0 | 61 | 5.5 | 74 | 94 | 94 | 8 | 1800 | 7 | 190 |
| Norwich | East of England | 2.8 | 82 | 2.8 | 68 | 0.9 | 15 | 30 | 50 | 5 | 500000 | 1200000 | 5.2 | 3.5 | 63 | 4.5 | 77 | 92 | 92 | 9 | 3000 | 5 | 230 |
| Chelmsford | East of England | 3.5 | 78 | 3.0 | 74 | 0.9 | 6 | 20 | 35 | 20 | 500000 | 3000000 | 6.5 | 4.5 | 64 | 3.8 | 79 | 100 | 100 | 9 | 3500 | 4 | 270 |
| Peterborough | East of England | 2.5 | 84 | 3.2 | 68 | 1.3 | 4 | 8 | 80 | 35 | 520000 | 2000000 | 8.2 | 5.8 | 65 | 4.5 | 77 | 93 | 93 | 14 | 3800 | 5 | 240 |
| Ipswich | East of England | 2.8 | 82 | 2.8 | 70 | 1.0 | 10 | 15 | 15 | 25 | 400000 | 1000000 | 5.0 | 3.5 | 63 | 4.2 | 78 | 93 | 93 | 10 | 2500 | 6 | 230 |
| Cambridge | East of England | 4.0 | 74 | 4.0 | 82 | 0.8 | 6 | 20 | 60 | 15 | 520000 | 2000000 | 7.5 | 5.2 | 65 | 3.2 | 82 | 108 | 108 | 8 | 4500 | 4 | 320 |
| Colchester | East of England | 2.8 | 82 | 2.8 | 68 | 0.9 | 8 | 20 | 20 | 30 | 400000 | 1500000 | 6.5 | 4.5 | 63 | 4.0 | 78 | 96 | 96 | 9 | 2800 | 5 | 240 |
| Bedford | East of England | 2.5 | 83 | 3.0 | 70 | 1.1 | 5 | 10 | 90 | 30 | 600000 | 3000000 | 7.0 | 4.8 | 65 | 4.0 | 79 | 98 | 98 | 12 | 3500 | 4 | 260 |
| Luton | East of England | 3.0 | 79 | 3.2 | 72 | 1.0 | 3 | 8 | 70 | 5 | 1200000 | 5000000 | 7.5 | 5.2 | 65 | 4.5 | 77 | 100 | 100 | 10 | 5000 | 3 | 280 |
| Basildon | East of England | 3.0 | 78 | 2.8 | 68 | 1.1 | 4 | 15 | 20 | 30 | 600000 | 4000000 | 5.5 | 4.0 | 63 | 4.8 | 77 | 98 | 98 | 10 | 3200 | 6 | 250 |
| Southend-on-Sea | East of England | 3.2 | 76 | 2.5 | 64 | 0.8 | 4 | 18 | 25 | 15 | 600000 | 3500000 | 4.8 | 3.5 | 62 | 5.0 | 76 | 97 | 97 | 9 | 2800 | 8 | 240 |
| Birmingham/Solihull | West Midlands | 3.0 | 80 | 3.0 | 68 | 1.1 | 2 | 5 | 100 | 20 | 3500000 | 7000000 | 6.8 | 4.8 | 64 | 5.8 | 76 | 97 | 97 | 11 | 8500 | 4 | 280 |
| Black Country | West Midlands | 2.8 | 82 | 2.5 | 62 | 1.3 | 2 | 8 | 90 | 28 | 2500000 | 6000000 | 4.5 | 3.2 | 63 | 6.5 | 74 | 94 | 94 | 14 | 6000 | 4 | 240 |
| Coventry | West Midlands | 2.8 | 81 | 3.0 | 68 | 1.2 | 2 | 12 | 110 | 15 | 1500000 | 5000000 | 6.5 | 4.5 | 65 | 5.2 | 77 | 96 | 96 | 12 | 5500 | 4 | 270 |
| Telford | West Midlands | 2.5 | 84 | 2.8 | 62 | 1.1 | 5 | 25 | 80 | 55 | 500000 | 3000000 | 7.5 | 5.0 | 64 | 4.8 | 77 | 92 | 92 | 12 | 2800 | 3 | 220 |
| Leicester | East Midlands | 2.8 | 82 | 3.0 | 68 | 1.3 | 3 | 10 | 115 | 15 | 900000 | 3500000 | 7.2 | 5.0 | 64 | 5.0 | 77 | 93 | 93 | 14 | 5500 | 4 | 260 |
| Northampton | East Midlands | 2.5 | 85 | 3.2 | 70 | 1.5 | 3 | 5 | 110 | 25 | 700000 | 3500000 | 8.5 | 6.0 | 65 | 4.2 | 79 | 94 | 94 | 18 | 4800 | 4 | 260 |
| Derby | East Midlands | 2.5 | 84 | 2.8 | 66 | 1.2 | 5 | 8 | 120 | 12 | 800000 | 3000000 | 5.5 | 4.0 | 64 | 4.8 | 77 | 94 | 94 | 14 | 4200 | 4 | 255 |
| Nottingham | East Midlands | 2.8 | 82 | 3.0 | 68 | 1.2 | 4 | 8 | 100 | 10 | 1000000 | 3000000 | 5.8 | 4.2 | 65 | 5.5 | 76 | 93 | 93 | 13 | 4500 | 5 | 265 |
| Stoke-on-Trent | East Midlands | 2.5 | 83 | 2.0 | 58 | 1.1 | 4 | 15 | 90 | 45 | 800000 | 3500000 | 3.5 | 2.5 | 63 | 6.2 | 74 | 90 | 90 | 12 | 2500 | 3 | 220 |
| Chesterfield | East Midlands | 2.5 | 84 | 2.5 | 62 | 1.2 | 4 | 12 | 80 | 25 | 700000 | 2500000 | 4.5 | 3.2 | 63 | 5.0 | 76 | 91 | 91 | 13 | 2500 | 3 | 235 |
| Mansfield | East Midlands | 2.5 | 84 | 2.2 | 60 | 1.2 | 5 | 15 | 90 | 20 | 600000 | 2500000 | 3.5 | 2.5 | 62 | 5.8 | 74 | 90 | 90 | 13 | 2000 | 4 | 215 |
| Lincoln | East Midlands | 2.8 | 82 | 2.5 | 62 | 1.0 | 20 | 20 | 50 | 35 | 300000 | 1500000 | 5.0 | 3.5 | 63 | 5.2 | 75 | 89 | 89 | 11 | 1800 | 5 | 200 |
| Burton-upon-Trent | East Midlands | 2.5 | 85 | 2.5 | 62 | 1.4 | 4 | 10 | 80 | 15 | 700000 | 3000000 | 5.5 | 4.0 | 63 | 5.0 | 76 | 91 | 91 | 17 | 3000 | 4 | 230 |
| West Yorkshire (Leeds) | Yorkshire & Humber | 2.8 | 82 | 3.0 | 66 | 1.1 | 3 | 5 | 50 | 12 | 2800000 | 6000000 | 7.0 | 5.0 | 64 | 5.0 | 77 | 93 | 93 | 12 | 7000 | 5 | 275 |
| Sheffield | Yorkshire & Humber | 2.8 | 82 | 2.8 | 64 | 1.1 | 4 | 12 | 60 | 15 | 1300000 | 3500000 | 5.2 | 3.8 | 64 | 5.5 | 76 | 91 | 91 | 12 | 4000 | 4 | 260 |
| Grimsby | Yorkshire & Humber | 2.5 | 85 | 2.0 | 58 | 1.4 | 12 | 8 | 5 | 25 | 300000 | 1000000 | 1.5 | 1.2 | 62 | 6.5 | 73 | 88 | 88 | 14 | 1500 | 10 | 185 |
| York | Yorkshire & Humber | 3.0 | 80 | 2.8 | 68 | 0.9 | 6 | 5 | 40 | 35 | 500000 | 2500000 | 6.5 | 4.5 | 64 | 4.2 | 79 | 95 | 95 | 10 | 2800 | 12 | 260 |
| Barnsley/Dearne Valley | Yorkshire & Humber | 2.5 | 85 | 2.2 | 58 | 1.6 | 3 | 8 | 55 | 12 | 900000 | 3500000 | 3.8 | 2.8 | 63 | 6.5 | 73 | 89 | 89 | 16 | 2500 | 5 | 225 |
| Doncaster | Yorkshire & Humber | 2.5 | 85 | 2.5 | 60 | 1.7 | 3 | 5 | 50 | 5 | 600000 | 2500000 | 4.5 | 3.2 | 63 | 6.0 | 74 | 89 | 89 | 17 | 2500 | 8 | 220 |
| Kingston upon Hull | Yorkshire & Humber | 2.5 | 84 | 2.2 | 60 | 1.3 | 5 | 6 | 5 | 25 | 500000 | 1500000 | 2.5 | 2.0 | 63 | 6.8 | 73 | 88 | 88 | 14 | 2000 | 10 | 200 |
| Greater Manchester | North West | 3.0 | 81 | 3.2 | 72 | 1.2 | 2 | 5 | 50 | 5 | 3000000 | 7000000 | 9.5 | 6.5 | 65 | 5.5 | 77 | 95 | 95 | 12 | 9000 | 4 | 290 |
| Liverpool | North West | 3.0 | 79 | 2.8 | 68 | 1.2 | 2 | 8 | 5 | 10 | 2000000 | 5000000 | 4.5 | 3.5 | 64 | 6.2 | 74 | 92 | 92 | 12 | 5000 | 5 | 265 |
| Preston | North West | 2.5 | 83 | 2.5 | 64 | 1.0 | 2 | 12 | 50 | 30 | 800000 | 3500000 | 5.5 | 4.0 | 63 | 5.8 | 75 | 91 | 91 | 11 | 3000 | 4 | 240 |
| Wigan | North West | 2.5 | 83 | 2.5 | 64 | 1.2 | 2 | 8 | 35 | 25 | 1500000 | 5000000 | 4.5 | 3.2 | 63 | 5.8 | 75 | 91 | 91 | 13 | 3500 | 4 | 245 |
| Burnley | North West | 2.5 | 84 | 2.0 | 58 | 1.2 | 4 | 15 | 65 | 35 | 800000 | 3500000 | 2.5 | 1.8 | 62 | 6.5 | 73 | 89 | 89 | 13 | 1800 | 3 | 220 |
| Blackburn | North West | 2.5 | 83 | 2.2 | 60 | 1.1 | 4 | 15 | 60 | 35 | 1000000 | 4000000 | 3.5 | 2.5 | 62 | 6.5 | 73 | 89 | 89 | 12 | 2200 | 3 | 220 |
| Warrington | North West | 2.5 | 85 | 3.0 | 70 | 1.5 | 2 | 8 | 30 | 15 | 1500000 | 6000000 | 6.5 | 4.5 | 65 | 4.2 | 79 | 96 | 96 | 16 | 4500 | 4 | 270 |
| Accrington/Rossendale | North West | 2.5 | 84 | 2.0 | 58 | 1.1 | 5 | 12 | 60 | 35 | 700000 | 3500000 | 2.5 | 1.8 | 62 | 6.8 | 72 | 88 | 88 | 12 | 1500 | 3 | 200 |
| Blackpool | North West | 2.5 | 82 | 2.0 | 60 | 0.9 | 4 | 15 | 25 | 5 | 500000 | 2000000 | 2.0 | 1.5 | 61 | 7.0 | 71 | 88 | 88 | 9 | 1500 | 6 | 190 |
| Birkenhead | North West | 2.8 | 80 | 2.5 | 64 | 1.1 | 3 | 10 | 3 | 15 | 1800000 | 5000000 | 3.0 | 2.2 | 62 | 6.5 | 73 | 91 | 91 | 12 | 3000 | 5 | 245 |
| Sunderland | North East | 2.5 | 84 | 2.0 | 58 | 1.1 | 4 | 15 | 5 | 15 | 900000 | 2500000 | 3.0 | 2.2 | 62 | 7.0 | 73 | 88 | 88 | 12 | 2000 | 5 | 210 |
| Tyneside | North East | 2.8 | 82 | 2.5 | 62 | 1.0 | 3 | 8 | 10 | 8 | 1200000 | 2500000 | 4.0 | 3.0 | 63 | 6.5 | 74 | 90 | 90 | 11 | 2800 | 5 | 230 |
| Teesside | North East | 2.5 | 85 | 2.0 | 58 | 1.3 | 4 | 8 | 5 | 10 | 700000 | 2000000 | 2.5 | 1.8 | 62 | 7.5 | 72 | 88 | 88 | 14 | 2000 | 6 | 205 |
| Bristol | South West | 3.5 | 78 | 3.8 | 78 | 1.0 | 2 | 8 | 5 | 10 | 1200000 | 3000000 | 8.5 | 6.0 | 66 | 4.0 | 80 | 100 | 100 | 10 | 5500 | 8 | 300 |
| Cheltenham | South West | 3.2 | 78 | 3.0 | 72 | 0.9 | 4 | 15 | 40 | 20 | 700000 | 2000000 | 5.5 | 4.0 | 65 | 3.8 | 80 | 100 | 100 | 9 | 3000 | 4 | 270 |
| Bournemouth/Poole | South West | 3.2 | 77 | 3.0 | 72 | 0.8 | 4 | 30 | 5 | 5 | 800000 | 2000000 | 5.5 | 4.0 | 62 | 3.8 | 79 | 97 | 97 | 8 | 3500 | 5 | 280 |
| Gloucester | South West | 3.0 | 80 | 2.8 | 68 | 1.0 | 4 | 12 | 25 | 25 | 700000 | 2000000 | 5.5 | 4.0 | 64 | 4.0 | 78 | 97 | 97 | 10 | 2500 | 6 | 250 |
| Exeter | South West | 3.0 | 79 | 2.8 | 68 | 0.9 | 5 | 20 | 70 | 5 | 450000 | 900000 | 6.5 | 4.5 | 64 | 3.8 | 79 | 96 | 96 | 9 | 2500 | 5 | 250 |
| Plymouth | South West | 3.0 | 79 | 2.5 | 64 | 0.9 | 6 | 35 | 5 | 5 | 450000 | 800000 | 4.2 | 3.0 | 63 | 5.0 | 77 | 93 | 93 | 9 | 2000 | 5 | 220 |
| Swindon | South West | 2.8 | 82 | 3.2 | 70 | 1.1 | 2 | 12 | 55 | 30 | 500000 | 2500000 | 7.5 | 5.2 | 65 | 3.5 | 81 | 100 | 100 | 12 | 3500 | 3 | 280 |
| Torquay/Paignton | South West | 3.0 | 77 | 2.2 | 62 | 0.7 | 8 | 35 | 30 | 20 | 350000 | 700000 | 3.5 | 2.5 | 60 | 5.0 | 75 | 91 | 91 | 7 | 1200 | 5 | 180 |
| Cardiff | Wales | 3.0 | 80 | 2.8 | 68 | 1.0 | 3 | 8 | 5 | 20 | 800000 | 2000000 | 6.2 | 4.5 | 63 | 5.2 | 76 | 92 | 92 | 10 | 4000 | 7 | 250 |
| Newport | Wales | 2.8 | 82 | 2.5 | 64 | 1.2 | 2 | 5 | 3 | 25 | 900000 | 2000000 | 5.0 | 3.5 | 63 | 5.5 | 75 | 90 | 90 | 12 | 3000 | 7 | 230 |
| Swansea | Wales | 2.8 | 81 | 2.2 | 62 | 0.9 | 4 | 12 | 3 | 25 | 500000 | 1500000 | 3.8 | 2.8 | 62 | 5.8 | 74 | 89 | 89 | 10 | 2000 | 6 | 210 |
| Greater Glasgow | Scotland | 3.2 | 80 | 3.0 | 70 | 1.0 | 2 | 5 | 25 | 12 | 1800000 | 3500000 | 3.5 | 2.8 | 64 | 4.5 | 77 | 97 | 97 | 10 | 4500 | 4 | 280 |
| Motherwell | Scotland | 2.8 | 82 | 2.5 | 64 | 1.2 | 3 | 5 | 30 | 20 | 1500000 | 3000000 | 3.0 | 2.2 | 63 | 5.0 | 76 | 94 | 94 | 12 | 2500 | 4 | 250 |
| Edinburgh | Scotland | 3.5 | 79 | 3.2 | 74 | 0.9 | 4 | 20 | 20 | 10 | 800000 | 2000000 | 7.0 | 5.0 | 65 | 3.8 | 80 | 100 | 100 | 9 | 3500 | 4 | 300 |
| Aberdeen | Scotland | 3.0 | 80 | 2.5 | 70 | 1.1 | 6 | 15 | 3 | 10 | 400000 | 700000 | 3.5 | 2.5 | 65 | 3.5 | 80 | 103 | 103 | 11 | 1500 | 3 | 250 |
| Dundee | Scotland | 3.0 | 81 | 2.5 | 66 | 1.0 | 5 | 20 | 3 | 30 | 400000 | 1200000 | 4.5 | 3.2 | 63 | 5.5 | 76 | 94 | 94 | 10 | 1800 | 3 | 235 |
| Belfast | Northern Ireland | 3.0 | 82 | 2.5 | 62 | 1.0 | 3 | 5 | 3 | 8 | 600000 | 1200000 | 5.0 | 3.8 | 62 | 5.5 | 72 | 89 | 89 | 10 | 2500 | 4 | 230 |

*Column headers: M8=Planning time (months), M9=Approval rate (%), M15=Business growth (% CAGR), M16=SME density (per 1k pop), M18=Logistics LQ, M22=Motorway km, M23=Rail freight km, M24=Port km, M25=Airport km, M31=Pop 30min, M32=Pop 60min, M33=Pop growth 10yr (%), M34=Household growth 5yr (%), M35=Working-age share (%), M36=Unemployment (%), M37=Activity rate (%), M38=Logistics wage index, M39=Labour cost index, M40=Logistics workforce share (%), M56=New homes/yr, M58=Flood risk (%), M59=Broadband (Mbps)*
