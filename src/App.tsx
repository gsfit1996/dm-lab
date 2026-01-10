import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DMLabProvider } from './context/DMLabContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DailyLogPage from './pages/DailyLog';
import Experiments from './pages/Experiments';
import Leads from './pages/Leads';
import Offers from './pages/Offers';
import Archive from './pages/Archive';
import Settings from './pages/Settings';

function App() {
    return (
        <DMLabProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="log" element={<DailyLogPage />} />
                        <Route path="experiments" element={<Experiments />} />
                        <Route path="leads" element={<Leads />} />
                        <Route path="offers" element={<Offers />} />
                        <Route path="archive" element={<Archive />} />
                        <Route path="settings" element={<Settings />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </DMLabProvider>
    );
}

export default App;
