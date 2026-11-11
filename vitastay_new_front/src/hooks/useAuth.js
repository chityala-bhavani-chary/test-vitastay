import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login, logout, fetchProfile, clearError } from '../redux/slices/authSlice';
import { getDashboardPath, canAccessRoute, ROLES } from '../utils/constants';

const useAuth = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, token, isAuthenticated, loading, error } = useSelector((state) => state.auth);

  const handleLogin = useCallback(
    async (credentials) => {
      const result = await dispatch(login(credentials));
      if (login.fulfilled.match(result)) {
        const role = result.payload.user.role;
        if (role === ROLES.SEEKER) {
          const next = credentials.next;
          navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/account', { replace: true });
        } else {
          navigate(getDashboardPath(role), { replace: true });
        }
        return { success: true };
      }
      return { success: false, error: result.payload };
    },
    [dispatch, navigate]
  );

  const handleLogout = useCallback(async () => {
    const role = user?.role;
    await dispatch(logout());
    navigate(role === ROLES.SEEKER ? '/account/login' : '/auth/login', { replace: true });
  }, [dispatch, navigate, user?.role]);

  const refreshProfile = useCallback(() => dispatch(fetchProfile()), [dispatch]);

  const hasRole = useCallback(
    (...roles) => roles.includes(user?.role),
    [user?.role]
  );

  const canAccess = useCallback(
    (path) => (user?.role ? canAccessRoute(user.role, path) : false),
    [user?.role]
  );

  const isOwner = user?.role === ROLES.OWNER;
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const isSupervisor = user?.role === ROLES.SUPERVISOR;
  const isTenant = user?.role === ROLES.TENANT;
  const isStaff = user?.role === ROLES.STAFF;
  const isSeeker = user?.role === ROLES.SEEKER;

  return {
    user,
    token,
    isAuthenticated,
    loading,
    error,
    login: handleLogin,
    logout: handleLogout,
    refreshProfile,
    clearError: () => dispatch(clearError()),
    hasRole,
    canAccess,
    isOwner,
    isSuperAdmin,
    isSupervisor,
    isTenant,
    isStaff,
    isSeeker,
  };
};

export default useAuth;
