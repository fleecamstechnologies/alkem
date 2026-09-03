import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ImportsPage } from './pages/ImportsPage';
import { UsersPage } from './pages/UsersPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { EmployeeDetailPage } from './pages/EmployeeDetailPage';
import { AttendancePage } from './pages/AttendancePage';
import { LeavePage } from './pages/LeavePage';
import { PayrollPage } from './pages/PayrollPage';
import { DoctorsPage } from './pages/DoctorsPage';
import { ReportsPage } from './pages/ReportsPage';
import { PortalPage } from './pages/PortalPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { FieldPage } from './pages/FieldPage';
import { MyFieldPage } from './pages/MyFieldPage';
import { PatientsPage } from './pages/PatientsPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { PharmacyPage } from './pages/PharmacyPage';
import { OfficesPage } from './pages/OfficesPage';

const theme = createTheme({
  palette: {
    primary: { main: '#0d47a1' },
    secondary: { main: '#00695c' },
    background: { default: '#f4f6f8' },
  },
  shape: { borderRadius: 8 },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const withLayout = (element: ReactNode) => (
  <ProtectedRoute>
    <AppLayout>{element}</AppLayout>
  </ProtectedRoute>
);

/** Some roles have no CRM dashboard — send them to their home screen. */
function Home() {
  const { user } = useAuth();
  if (user?.role === 'EMPLOYEE') return <Navigate to="/portal" replace />;
  if (user?.role === 'RECEPTION' || user?.role === 'CLINICIAN') {
    return <Navigate to="/patients" replace />;
  }
  if (user?.role === 'PHARMACIST') return <Navigate to="/pharmacy" replace />;
  return <DashboardPage />;
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={withLayout(<Home />)} />
              <Route path="/customers" element={withLayout(<CustomersPage />)} />
              <Route
                path="/customers/:id"
                element={withLayout(<CustomerDetailPage />)}
              />
              <Route path="/payments" element={withLayout(<PaymentsPage />)} />
              <Route path="/doctors" element={withLayout(<DoctorsPage />)} />
              <Route path="/employees" element={withLayout(<EmployeesPage />)} />
              <Route
                path="/employees/:id"
                element={withLayout(<EmployeeDetailPage />)}
              />
              <Route path="/attendance" element={withLayout(<AttendancePage />)} />
              <Route path="/offices" element={withLayout(<OfficesPage />)} />
              <Route path="/leave" element={withLayout(<LeavePage />)} />
              <Route path="/payroll" element={withLayout(<PayrollPage />)} />
              <Route path="/reports" element={withLayout(<ReportsPage />)} />
              <Route path="/field" element={withLayout(<FieldPage />)} />
              <Route path="/patients" element={withLayout(<PatientsPage />)} />
              <Route
                path="/patients/:id"
                element={withLayout(<PatientDetailPage />)}
              />
              <Route
                path="/appointments"
                element={withLayout(<AppointmentsPage />)}
              />
              <Route path="/pharmacy" element={withLayout(<PharmacyPage />)} />
              <Route path="/portal" element={withLayout(<PortalPage />)} />
              <Route
                path="/portal/field"
                element={withLayout(<MyFieldPage />)}
              />
              <Route
                path="/portal/approvals"
                element={withLayout(<ApprovalsPage />)}
              />
              <Route path="/imports" element={withLayout(<ImportsPage />)} />
              <Route path="/users" element={withLayout(<UsersPage />)} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
