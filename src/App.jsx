import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EngineerPortal from './pages/EngineerPortal';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';
import 'leaflet/dist/leaflet.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen app-container">
        <Routes>
          <Route path="/" element={<EngineerPortal />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
