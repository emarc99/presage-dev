import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { SessionProvider } from './context/SessionContext';
import { OverviewPage } from './pages/OverviewPage';
import { CalibratePage } from './pages/CalibratePage';
import { ExperiencePage } from './pages/ExperiencePage';
import { ContactSheetPage } from './pages/ContactSheetPage';

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/calibrate" element={<CalibratePage />} />
          <Route path="/experience" element={<ExperiencePage />} />
          <Route path="/contact-sheet" element={<ContactSheetPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}

export default App;
