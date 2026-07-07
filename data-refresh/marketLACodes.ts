/**
 * Mapping of each market ID to its constituent ONS GSS local authority codes.
 *
 * These codes are used to query NOMIS, VOA, and Land Registry APIs.
 * Markets that span multiple local authorities list all constituent codes;
 * values are aggregated (summed or weighted-averaged) in the fetch scripts.
 *
 * Code format:
 *   E06xxxxxx — English unitary authorities
 *   E07xxxxxx — English district councils (two-tier areas)
 *   E08xxxxxx — English metropolitan districts
 *   E09xxxxxx — London Boroughs
 *   W06xxxxxx — Welsh unitary authorities
 *   S12xxxxxx — Scottish council areas
 *   N09xxxxxx — Northern Ireland districts
 *
 * Accuracy notes:
 *   - Codes reflect 2021 Census boundaries (post-2019/2021 LA mergers).
 *   - uk-09 (High Wycombe) uses Buckinghamshire UA (E06000060), formed April 2020.
 *   - uk-32 (Northampton) uses West Northamptonshire UA (E06000061), formed April 2021.
 *   - uk-62 (Bournemouth/Poole) uses the merged BCP UA (E06000058), formed April 2019.
 *   - Scottish (uk-71–uk-75) and NI (uk-76) markets are excluded from NOMIS M28 and
 *     VOA M46/M54 calculations (separate data regimes). M7 is included via Land Registry.
 */

export interface MarketMeta {
  /** ONS GSS codes for all LAs that make up this market */
  laCodes: string[];
  /** Human-readable name for logging */
  name: string;
  /** Whether this market is covered by NOMIS (England + Wales Census 2021) */
  nomisEW: boolean;
  /** Whether this market is covered by VOA (England only) */
  voaEngland: boolean;
}

export const MARKET_META: Record<string, MarketMeta> = {
  // ── LONDON ──────────────────────────────────────────────────────────────────
  'uk-01': {
    name: 'Greater London',
    nomisEW: true, voaEngland: true,
    laCodes: [
      'E09000001','E09000002','E09000003','E09000004','E09000005',
      'E09000006','E09000007','E09000008','E09000009','E09000010',
      'E09000011','E09000012','E09000013','E09000014','E09000015',
      'E09000016','E09000017','E09000018','E09000019','E09000020',
      'E09000021','E09000022','E09000023','E09000024','E09000025',
      'E09000026','E09000027','E09000028','E09000029','E09000030',
      'E09000031','E09000032','E09000033',
    ],
  },

  // ── SOUTH EAST ──────────────────────────────────────────────────────────────
  'uk-02': { name: 'Crawley',               nomisEW: true, voaEngland: true, laCodes: ['E07000061'] },
  'uk-03': { name: 'Reading',               nomisEW: true, voaEngland: true, laCodes: ['E06000038'] },
  'uk-04': { name: 'Maidstone',             nomisEW: true, voaEngland: true, laCodes: ['E07000110'] },
  'uk-05': {
    name: 'South Hampshire',
    nomisEW: true, voaEngland: true,
    laCodes: ['E06000044','E06000045','E07000086','E07000087','E07000088','E07000090'],
    // Portsmouth, Southampton, Eastleigh, Fareham, Gosport, Havant
  },
  'uk-06': { name: 'Milton Keynes',         nomisEW: true, voaEngland: true, laCodes: ['E06000042'] },
  'uk-07': { name: 'Slough',                nomisEW: true, voaEngland: true, laCodes: ['E06000039'] },
  'uk-08': { name: 'Hastings',              nomisEW: true, voaEngland: true, laCodes: ['E07000064'] },
  'uk-09': { name: 'High Wycombe',          nomisEW: true, voaEngland: true, laCodes: ['E06000060'] }, // Buckinghamshire UA (2020)
  'uk-10': { name: 'Basingstoke',           nomisEW: true, voaEngland: true, laCodes: ['E07000084'] },
  'uk-11': { name: 'Brighton & Hove',       nomisEW: true, voaEngland: true, laCodes: ['E06000043'] },
  'uk-12': { name: 'Medway Towns',          nomisEW: true, voaEngland: true, laCodes: ['E06000035'] },
  'uk-13': { name: 'Eastbourne',            nomisEW: true, voaEngland: true, laCodes: ['E07000062'] },
  'uk-14': { name: 'Farnborough/Aldershot', nomisEW: true, voaEngland: true, laCodes: ['E07000092'] }, // Rushmoor
  'uk-15': { name: 'Oxford',                nomisEW: true, voaEngland: true, laCodes: ['E07000178'] },
  'uk-16': { name: 'Thanet',                nomisEW: true, voaEngland: true, laCodes: ['E07000114'] },

  // ── EAST OF ENGLAND ─────────────────────────────────────────────────────────
  'uk-17': { name: 'Norwich',               nomisEW: true, voaEngland: true, laCodes: ['E07000148'] },
  'uk-18': { name: 'Chelmsford',            nomisEW: true, voaEngland: true, laCodes: ['E07000070'] },
  'uk-19': { name: 'Peterborough',          nomisEW: true, voaEngland: true, laCodes: ['E06000031'] },
  'uk-20': { name: 'Ipswich',               nomisEW: true, voaEngland: true, laCodes: ['E07000202'] },
  'uk-21': { name: 'Cambridge',             nomisEW: true, voaEngland: true, laCodes: ['E07000008'] },
  'uk-22': { name: 'Colchester',            nomisEW: true, voaEngland: true, laCodes: ['E07000071'] },
  'uk-23': { name: 'Bedford',               nomisEW: true, voaEngland: true, laCodes: ['E06000055'] },
  'uk-24': { name: 'Luton',                 nomisEW: true, voaEngland: true, laCodes: ['E06000032'] },
  'uk-25': { name: 'Basildon',              nomisEW: true, voaEngland: true, laCodes: ['E07000066'] },
  'uk-26': { name: 'Southend-on-Sea',       nomisEW: true, voaEngland: true, laCodes: ['E06000033'] },

  // ── WEST MIDLANDS ───────────────────────────────────────────────────────────
  'uk-27': { name: 'Birmingham/Solihull',   nomisEW: true, voaEngland: true, laCodes: ['E08000025','E08000029'] },
  'uk-28': {
    name: 'Black Country',
    nomisEW: true, voaEngland: true,
    laCodes: ['E08000027','E08000028','E08000030','E08000031'],
    // Dudley, Sandwell, Walsall, Wolverhampton
  },
  'uk-29': { name: 'Coventry',              nomisEW: true, voaEngland: true, laCodes: ['E08000026'] },
  'uk-30': { name: 'Telford',               nomisEW: true, voaEngland: true, laCodes: ['E06000020'] },

  // ── EAST MIDLANDS ───────────────────────────────────────────────────────────
  'uk-31': { name: 'Leicester',             nomisEW: true, voaEngland: true, laCodes: ['E06000016'] },
  'uk-32': { name: 'Northampton',           nomisEW: true, voaEngland: true, laCodes: ['E06000061'] }, // West Northamptonshire UA (2021)
  'uk-33': { name: 'Derby',                 nomisEW: true, voaEngland: true, laCodes: ['E06000015'] },
  'uk-34': { name: 'Nottingham',            nomisEW: true, voaEngland: true, laCodes: ['E06000018'] },
  'uk-35': { name: 'Stoke-on-Trent',        nomisEW: true, voaEngland: true, laCodes: ['E06000021'] },
  'uk-36': { name: 'Chesterfield',          nomisEW: true, voaEngland: true, laCodes: ['E07000034'] },
  'uk-37': { name: 'Mansfield',             nomisEW: true, voaEngland: true, laCodes: ['E07000174'] },
  'uk-38': { name: 'Lincoln',               nomisEW: true, voaEngland: true, laCodes: ['E07000138'] },
  'uk-39': { name: 'Burton-upon-Trent',     nomisEW: true, voaEngland: true, laCodes: ['E07000032'] }, // East Staffordshire

  // ── YORKSHIRE & HUMBER ──────────────────────────────────────────────────────
  'uk-40': {
    name: 'West Yorkshire (Leeds)',
    nomisEW: true, voaEngland: true,
    laCodes: ['E08000032','E08000033','E08000034','E08000035','E08000036'],
    // Bradford, Calderdale, Kirklees, Leeds, Wakefield
  },
  'uk-41': { name: 'Sheffield',             nomisEW: true, voaEngland: true, laCodes: ['E08000019','E08000018'] }, // Sheffield + Rotherham
  'uk-42': { name: 'Grimsby',               nomisEW: true, voaEngland: true, laCodes: ['E06000012'] }, // North East Lincolnshire
  'uk-43': { name: 'York',                  nomisEW: true, voaEngland: true, laCodes: ['E06000014'] },
  'uk-44': { name: 'Barnsley/Dearne Valley',nomisEW: true, voaEngland: true, laCodes: ['E08000016'] },
  'uk-45': { name: 'Doncaster',             nomisEW: true, voaEngland: true, laCodes: ['E08000017'] },
  'uk-46': { name: 'Kingston upon Hull',    nomisEW: true, voaEngland: true, laCodes: ['E06000010'] },

  // ── NORTH WEST ──────────────────────────────────────────────────────────────
  'uk-47': {
    name: 'Greater Manchester',
    nomisEW: true, voaEngland: true,
    laCodes: [
      'E08000001','E08000002','E08000003','E08000004','E08000005',
      'E08000006','E08000007','E08000008','E08000009','E08000010',
    ],
    // Bolton, Bury, Manchester, Oldham, Rochdale, Salford, Stockport, Tameside, Trafford, Wigan
  },
  'uk-48': {
    name: 'Liverpool',
    nomisEW: true, voaEngland: true,
    laCodes: ['E08000011','E08000012','E08000014'],
    // Knowsley, Liverpool, Sefton
  },
  'uk-49': { name: 'Preston',               nomisEW: true, voaEngland: true, laCodes: ['E07000123','E07000126'] }, // Preston + South Ribble
  'uk-50': { name: 'Wigan',                 nomisEW: true, voaEngland: true, laCodes: ['E08000010'] },
  'uk-51': { name: 'Burnley',               nomisEW: true, voaEngland: true, laCodes: ['E07000117'] },
  'uk-52': { name: 'Blackburn',             nomisEW: true, voaEngland: true, laCodes: ['E06000008'] }, // Blackburn with Darwen UA
  'uk-53': { name: 'Warrington',            nomisEW: true, voaEngland: true, laCodes: ['E06000007'] },
  'uk-54': { name: 'Accrington/Rossendale', nomisEW: true, voaEngland: true, laCodes: ['E07000116','E07000125'] }, // Hyndburn + Rossendale
  'uk-55': { name: 'Blackpool',             nomisEW: true, voaEngland: true, laCodes: ['E06000009'] },
  'uk-56': { name: 'Birkenhead',            nomisEW: true, voaEngland: true, laCodes: ['E08000015'] }, // Wirral

  // ── NORTH EAST ──────────────────────────────────────────────────────────────
  'uk-57': { name: 'Sunderland',            nomisEW: true, voaEngland: true, laCodes: ['E08000024'] },
  'uk-58': {
    name: 'Tyneside',
    nomisEW: true, voaEngland: true,
    laCodes: ['E08000021','E08000022','E08000023','E08000037'],
    // Newcastle, North Tyneside, South Tyneside, Gateshead
  },
  'uk-59': {
    name: 'Teesside',
    nomisEW: true, voaEngland: true,
    laCodes: ['E06000002','E06000003','E06000004'],
    // Middlesbrough, Redcar and Cleveland, Stockton-on-Tees
  },

  // ── SOUTH WEST ──────────────────────────────────────────────────────────────
  'uk-60': { name: 'Bristol',               nomisEW: true, voaEngland: true, laCodes: ['E06000023'] },
  'uk-61': { name: 'Cheltenham',            nomisEW: true, voaEngland: true, laCodes: ['E07000078'] },
  'uk-62': { name: 'Bournemouth/Poole',     nomisEW: true, voaEngland: true, laCodes: ['E06000058'] }, // BCP UA (2019)
  'uk-63': { name: 'Gloucester',            nomisEW: true, voaEngland: true, laCodes: ['E07000081'] },
  'uk-64': { name: 'Exeter',               nomisEW: true, voaEngland: true, laCodes: ['E07000041'] },
  'uk-65': { name: 'Plymouth',              nomisEW: true, voaEngland: true, laCodes: ['E06000026'] },
  'uk-66': { name: 'Swindon',               nomisEW: true, voaEngland: true, laCodes: ['E06000030'] },
  'uk-67': { name: 'Torquay/Paignton',      nomisEW: true, voaEngland: true, laCodes: ['E06000027'] }, // Torbay UA

  // ── WALES ───────────────────────────────────────────────────────────────────
  'uk-68': { name: 'Cardiff',               nomisEW: true,  voaEngland: false, laCodes: ['W06000015'] },
  'uk-69': { name: 'Newport',               nomisEW: true,  voaEngland: false, laCodes: ['W06000022'] },
  'uk-70': { name: 'Swansea',               nomisEW: true,  voaEngland: false, laCodes: ['W06000011'] },

  // ── SCOTLAND ────────────────────────────────────────────────────────────────
  'uk-71': {
    name: 'Greater Glasgow',
    nomisEW: false, voaEngland: false,
    laCodes: ['S12000049','S12000038','S12000039','S12000044','S12000045'],
    // Glasgow City, Renfrewshire, West Dunbartonshire, North Lanarkshire, East Dunbartonshire
  },
  'uk-72': { name: 'Motherwell',            nomisEW: false, voaEngland: false, laCodes: ['S12000044','S12000029'] }, // N + S Lanarkshire
  'uk-73': { name: 'Edinburgh',             nomisEW: false, voaEngland: false, laCodes: ['S12000036'] },
  'uk-74': { name: 'Aberdeen',              nomisEW: false, voaEngland: false, laCodes: ['S12000033','S12000034'] }, // Aberdeen City + Aberdeenshire
  'uk-75': { name: 'Dundee',               nomisEW: false, voaEngland: false, laCodes: ['S12000042'] },

  // ── NORTHERN IRELAND ────────────────────────────────────────────────────────
  'uk-76': { name: 'Belfast',               nomisEW: false, voaEngland: false, laCodes: ['N09000003'] },
};
