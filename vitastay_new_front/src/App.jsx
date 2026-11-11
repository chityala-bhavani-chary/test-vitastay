import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import useAuth from './hooks/useAuth';
import { canAccessRoute, getDashboardPath } from './utils/constants';
import { EntitlementsProvider, useEntitlements } from './hooks/useEntitlements';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import AppThemeProvider from './providers/AppThemeProvider';
import ScrollToTop from './components/layout/ScrollToTop';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const OwnerDashboard = lazy(() => import('./pages/dashboard/OwnerDashboard'));
const SuperAdminDashboard = lazy(() => import('./pages/dashboard/SuperAdminDashboard'));
const SupervisorDashboard = lazy(() => import('./pages/dashboard/SupervisorDashboard'));
const TenantDashboard = lazy(() => import('./pages/dashboard/TenantDashboard'));
const StaffDashboard = lazy(() => import('./pages/dashboard/StaffDashboard'));
const HostelListPage = lazy(() => import('./pages/hostels/HostelListPage'));
const HostelViewPage = lazy(() => import('./pages/hostels/HostelViewPage'));
const HostelFormPage = lazy(() => import('./pages/hostels/HostelFormPage'));
const HostelMediaPage = lazy(() => import('./pages/hostels/HostelMediaPage'));
const HostelListingPreviewPage = lazy(() => import('./pages/hostels/HostelListingPreviewPage'));
const HostelVitaEyePage = lazy(() => import('./pages/hostels/HostelVitaEyePage'));
const PublicListingLayout = lazy(() => import('./layouts/PublicListingLayout'));
const ListingPage = lazy(() => import('./pages/public/ListingPage'));
const SearchPage = lazy(() => import('./pages/public/SearchPage'));
const SeekerRegisterPage = lazy(() => import('./pages/public/SeekerRegisterPage'));
const SeekerLoginPage = lazy(() => import('./pages/public/SeekerLoginPage'));
const SeekerAccountPage = lazy(() => import('./pages/public/SeekerAccountPage'));
const BookingInboxPage = lazy(() => import('./pages/bookings/BookingInboxPage'));
const BookingPage = lazy(() => import('./pages/public/BookingPage'));
const VitaEyePrivacyPage = lazy(() => import('./pages/public/VitaEyePrivacyPage'));
const DownloadsPage = lazy(() => import('./pages/public/DownloadsPage'));
const SavedListingsPage = lazy(() => import('./pages/public/SavedListingsPage'));
const ComparePage = lazy(() => import('./pages/public/ComparePage'));
const CityLandingPage = lazy(() => import('./pages/public/CityLandingPage'));
const RegisterHostelPage = lazy(() => import('./pages/super-admin/RegisterHostelPage'));
const SuperAdminUsersPage = lazy(() => import('./pages/super-admin/UsersPage'));
const SuperAdminPlansPage = lazy(() => import('./pages/super-admin/PlansPage'));
const SuperAdminVitaEyePage = lazy(() => import('./pages/super-admin/VitaEyeQueuePage'));
const RoomListPage = lazy(() => import('./pages/rooms/RoomListPage'));
const RoomFormPage = lazy(() => import('./pages/rooms/RoomFormPage'));
const RoomViewPage = lazy(() => import('./pages/rooms/RoomViewPage'));
const TenantListPage = lazy(() => import('./pages/tenants/TenantListPage'));
const TenantFormPage = lazy(() => import('./pages/tenants/TenantFormPage'));
const RentListPage = lazy(() => import('./pages/rent/RentListPage'));
const CollectRentPage = lazy(() => import('./pages/rent/CollectRentPage'));
const RevenuePage = lazy(() => import('./pages/revenue/RevenuePage'));
const ExpenseListPage = lazy(() => import('./pages/expenses/ExpenseListPage'));
const VisitorListPage = lazy(() => import('./pages/visitors/VisitorListPage'));
const ComplaintListPage = lazy(() => import('./pages/complaints/ComplaintListPage'));
const MaintenanceListPage = lazy(() => import('./pages/maintenance/MaintenanceListPage'));
const NoticeListPage = lazy(() => import('./pages/notices/NoticeListPage'));
const StaffListPage = lazy(() => import('./pages/staff/StaffListPage'));
const AttendancePage = lazy(() => import('./pages/attendance/AttendancePage'));
const InventoryListPage = lazy(() => import('./pages/inventory/InventoryListPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const ListingAnalyticsPage = lazy(() => import('./pages/reports/ListingAnalyticsPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'));

const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
    <CircularProgress />
  </Box>
);

const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, user } = useAuth();
  const { ready, flags } = useEntitlements();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (user?.role === 'seeker') {
    return <Navigate to="/account" replace />;
  }

  if (roles && !roles.includes(user?.role)) {
    return <Navigate to={getDashboardPath(user?.role)} replace />;
  }

  if (!canAccessRoute(user?.role, location.pathname, ready ? flags : null)) {
    return <Navigate to={getDashboardPath(user?.role)} replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated) {
    return <Navigate to={getDashboardPath(user?.role)} replace />;
  }
  return children;
};

const DashboardRedirect = () => {
  const { user } = useAuth();
  return <Navigate to={getDashboardPath(user?.role)} replace />;
};

const App = () => (
  <AppThemeProvider>
    <ScrollToTop />
    <Suspense fallback={<PageLoader />}>
      <Routes>
          <Route path="/auth" element={<AuthLayout />}>
            <Route path="login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
            <Route path="reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
          </Route>

          <Route path="/auth/register" element={<Navigate to="/account/register" replace />} />

          <Route element={<PublicListingLayout />}>
            <Route path="/search" element={<SearchPage />} />
            <Route path="/listings" element={<SearchPage />} />
            <Route path="/listings/:idOrSlug" element={<ListingPage />} />
            <Route path="/pg/:citySlug/:areaSlug" element={<CityLandingPage />} />
            <Route path="/pg/:citySlug" element={<CityLandingPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/account/register" element={<PublicRoute><SeekerRegisterPage /></PublicRoute>} />
            <Route path="/account/login" element={<PublicRoute><SeekerLoginPage /></PublicRoute>} />
            <Route path="/account" element={<SeekerAccountPage />} />
            <Route path="/account/saved" element={<SavedListingsPage />} />
            <Route path="/bookings/:id" element={<BookingPage />} />
            <Route path="/legal/vita-eye" element={<VitaEyePrivacyPage />} />
            <Route path="/download" element={<DownloadsPage />} />
            <Route path="/downloads" element={<Navigate to="/download" replace />} />
          </Route>

          <Route
            element={
              <ProtectedRoute>
                <EntitlementsProvider>
                  <DashboardLayout />
                </EntitlementsProvider>
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardRedirect />} />
            <Route path="/dashboard/super-admin" element={<ProtectedRoute roles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/owner" element={<ProtectedRoute roles={['owner']}><OwnerDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/supervisor" element={<ProtectedRoute roles={['owner', 'supervisor']}><SupervisorDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/tenant" element={<ProtectedRoute roles={['tenant']}><TenantDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/staff" element={<ProtectedRoute roles={['staff']}><StaffDashboard /></ProtectedRoute>} />

            <Route path="/booking-requests" element={<ProtectedRoute roles={['super_admin', 'owner', 'supervisor']}><BookingInboxPage /></ProtectedRoute>} />
            <Route path="/hostels" element={<ProtectedRoute roles={['super_admin', 'owner', 'supervisor']}><HostelListPage /></ProtectedRoute>} />
            <Route path="/hostels/new" element={<ProtectedRoute roles={['owner']}><HostelFormPage /></ProtectedRoute>} />
            <Route path="/hostels/:id" element={<ProtectedRoute roles={['super_admin', 'owner', 'supervisor']}><HostelViewPage /></ProtectedRoute>} />
            <Route path="/hostels/:id/media" element={<ProtectedRoute roles={['super_admin', 'owner', 'supervisor']}><HostelMediaPage /></ProtectedRoute>} />
            <Route path="/hostels/:id/listing" element={<ProtectedRoute roles={['super_admin', 'owner', 'supervisor']}><HostelListingPreviewPage /></ProtectedRoute>} />
            <Route path="/hostels/:id/vita-eye" element={<ProtectedRoute roles={['super_admin', 'owner', 'supervisor', 'staff']}><HostelVitaEyePage /></ProtectedRoute>} />
            <Route path="/hostels/:id/edit" element={<ProtectedRoute roles={['super_admin', 'owner', 'supervisor']}><HostelFormPage /></ProtectedRoute>} />

            <Route path="/super-admin/register-hostel" element={<ProtectedRoute roles={['super_admin']}><RegisterHostelPage /></ProtectedRoute>} />
            <Route path="/super-admin/users" element={<ProtectedRoute roles={['super_admin']}><SuperAdminUsersPage /></ProtectedRoute>} />
            <Route path="/super-admin/plans" element={<ProtectedRoute roles={['super_admin']}><SuperAdminPlansPage /></ProtectedRoute>} />
            <Route path="/super-admin/vita-eye" element={<ProtectedRoute roles={['super_admin']}><SuperAdminVitaEyePage /></ProtectedRoute>} />

            <Route path="/rooms" element={<ProtectedRoute roles={['owner', 'supervisor']}><RoomListPage /></ProtectedRoute>} />
            <Route path="/rooms/new" element={<ProtectedRoute roles={['owner', 'supervisor']}><RoomFormPage /></ProtectedRoute>} />
            <Route path="/rooms/:id/edit" element={<ProtectedRoute roles={['owner', 'supervisor']}><RoomFormPage /></ProtectedRoute>} />
            <Route path="/rooms/:id" element={<ProtectedRoute roles={['owner', 'supervisor']}><RoomViewPage /></ProtectedRoute>} />

            <Route path="/tenants" element={<ProtectedRoute roles={['owner', 'supervisor']}><TenantListPage /></ProtectedRoute>} />
            <Route path="/tenants/new" element={<ProtectedRoute roles={['owner', 'supervisor']}><TenantFormPage /></ProtectedRoute>} />
            <Route path="/tenants/:id/edit" element={<ProtectedRoute roles={['owner', 'supervisor']}><TenantFormPage /></ProtectedRoute>} />

            <Route path="/rent" element={<ProtectedRoute roles={['owner', 'supervisor', 'tenant']}><RentListPage /></ProtectedRoute>} />
            <Route path="/rent/collect/:id?" element={<ProtectedRoute roles={['owner', 'supervisor']}><CollectRentPage /></ProtectedRoute>} />
            <Route path="/revenue" element={<ProtectedRoute roles={['owner', 'supervisor']}><RevenuePage /></ProtectedRoute>} />

            <Route path="/expenses" element={<ProtectedRoute roles={['owner', 'supervisor']}><ExpenseListPage /></ProtectedRoute>} />
            <Route path="/visitors" element={<ProtectedRoute roles={['owner', 'supervisor', 'tenant']}><VisitorListPage /></ProtectedRoute>} />
            <Route path="/complaints" element={<ProtectedRoute roles={['owner', 'supervisor', 'tenant', 'staff']}><ComplaintListPage /></ProtectedRoute>} />
            <Route path="/maintenance" element={<ProtectedRoute roles={['owner', 'supervisor', 'staff']}><MaintenanceListPage /></ProtectedRoute>} />
            <Route path="/notices" element={<ProtectedRoute roles={['owner', 'supervisor', 'tenant', 'staff']}><NoticeListPage /></ProtectedRoute>} />
            <Route path="/staff" element={<ProtectedRoute roles={['owner', 'supervisor']}><StaffListPage /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute roles={['owner', 'supervisor']}><AttendancePage /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute roles={['owner', 'supervisor']}><InventoryListPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute roles={['owner', 'supervisor']}><ReportsPage /></ProtectedRoute>} />
            <Route path="/listing-analytics" element={<ProtectedRoute roles={['super_admin', 'owner']}><ListingAnalyticsPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute roles={['owner']}><SettingsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    </Suspense>
  </AppThemeProvider>
);

export default App;
