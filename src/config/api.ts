// Single source of truth for the deal-pipeline API base URL.
//
// Injected at build time by webpack DefinePlugin (see webpack.config.js):
//   - dev build  -> 'http://localhost:8787' (extractor runs on a separate port)
//   - prod build -> ''  (same-origin: FastAPI serves the built frontend)
// Override explicitly with the API_BASE env var when building.
//
// Because the value is same-origin ('') in production, all call sites can do
// `${API_BASE}/deals` and get a correct relative URL either way.
export const API_BASE: string = process.env.API_BASE || '';
