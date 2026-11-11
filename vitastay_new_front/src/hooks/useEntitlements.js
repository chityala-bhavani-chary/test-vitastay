import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import api, { extractData } from '../services/api';
import useAuth from './useAuth';
import { PLATFORM_ENTITLEMENTS, unionEntitlements } from '../utils/entitlements';

const EntitlementsContext = createContext({
  ready: false,
  flags: {},
  hostels: [],
});

export const EntitlementsProvider = ({ children }) => {
  const { user, isSuperAdmin } = useAuth();
  const [hostels, setHostels] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const role = user?.role;
    if (!role || role === 'seeker' || role === 'tenant' || role === 'staff') {
      setHostels([]);
      setReady(true);
      return undefined;
    }
    let cancelled = false;
    setReady(false);
    api.get('/hostels', { params: { limit: 100 } })
      .then(({ data }) => {
        if (!cancelled) setHostels(extractData(data) || []);
      })
      .catch(() => {
        if (!cancelled) setHostels([]);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => { cancelled = true; };
  }, [user]);

  const flags = useMemo(
    () => (isSuperAdmin ? PLATFORM_ENTITLEMENTS : unionEntitlements(hostels)),
    [isSuperAdmin, hostels],
  );

  const value = useMemo(() => ({ ready, flags, hostels }), [ready, flags, hostels]);
  return createElement(EntitlementsContext.Provider, { value }, children);
};

export const useEntitlements = () => useContext(EntitlementsContext);

export default useEntitlements;
