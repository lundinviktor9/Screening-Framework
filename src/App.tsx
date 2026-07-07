import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import RankingsPage from './pages/RankingsPage';
import AddMarketPage from './pages/AddMarketPage';
import DashboardPage from './pages/DashboardPage';
import MapPage from './pages/MapPage';
import SensitivityPage from './pages/SensitivityPage';
import DataEntryPage from './pages/DataEntryPage';
import DataSourcesPage from './pages/DataSourcesPage';
import ComparePage from './pages/ComparePage';
import PipelinePage from './pages/PipelinePage';
import UnderwritePage from './pages/UnderwritePage';
import DealProfilePage from './pages/DealProfilePage';
import MarketPrintPage from './pages/MarketPrintPage';
import LandingPage from './pages/LandingPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Standalone print route — no sidebar */}
        <Route path="/market/:id/print" element={<MarketPrintPage />} />
        <Route element={<AppLayout />}>
          <Route path="/"              element={<LandingPage />} />
          <Route path="/rankings"      element={<RankingsPage />} />
          <Route path="/add"           element={<AddMarketPage />} />
          <Route path="/edit/:id"      element={<AddMarketPage />} />
          <Route path="/dashboard"     element={<DashboardPage />} />
          <Route path="/map"           element={<MapPage />} />
          <Route path="/sensitivity"   element={<SensitivityPage />} />
          <Route path="/data-entry"    element={<DataEntryPage />} />
          <Route path="/sources"       element={<DataSourcesPage />} />
          <Route path="/compare"       element={<ComparePage />} />
          <Route path="/pipeline"      element={<PipelinePage />} />
          <Route path="/pipeline/:dealId"  element={<DealProfilePage />} />
          <Route path="/underwrite"    element={<UnderwritePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
