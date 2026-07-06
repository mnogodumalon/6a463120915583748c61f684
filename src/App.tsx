import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import BewerbungenPage from '@/pages/BewerbungenPage';
import BewerbungenDetailPage from '@/pages/BewerbungenDetailPage';
import StellenPage from '@/pages/StellenPage';
import StellenDetailPage from '@/pages/StellenDetailPage';
import PublicFormBewerbungen from '@/pages/public/PublicForm_Bewerbungen';
import PublicFormStellen from '@/pages/public/PublicForm_Stellen';
// <public:imports>
// </public:imports>
// <custom:imports>
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a46310b1bb742915f83d735" element={<PublicFormBewerbungen />} />
              <Route path="public/6a463108ce8058178b7c0823" element={<PublicFormStellen />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="bewerbungen" element={<BewerbungenPage />} />
                <Route path="bewerbungen/:id" element={<BewerbungenDetailPage />} />
                <Route path="stellen" element={<StellenPage />} />
                <Route path="stellen/:id" element={<StellenDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
