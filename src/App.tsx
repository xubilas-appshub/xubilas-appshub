import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { AppDetailPage } from './pages/AppDetailPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { DeveloperDashboard } from './pages/DeveloperDashboard';
import { LoginPage } from './pages/LoginPage';
import { InstallPWA } from './components/InstallPWA';
import { PortalButton } from './components/PortalButton';

export default function App() {
  return (
    <Router>
      <div className="relative min-h-screen">
        <PortalButton />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/app/:id" element={<AppDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/developer" element={<DeveloperDashboard />} />
        </Routes>
        <InstallPWA />
      </div>
    </Router>
  );
}
