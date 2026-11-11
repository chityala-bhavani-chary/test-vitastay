/**
 * BIC-022 — one wishlist fetch for the public shell (search + listing + account).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import useAuth from './useAuth';
import { ROLES } from '../utils/constants';
import api, { extractData, getErrorMessage } from '../services/api';

const WishlistContext = createContext(null);

export const WishlistProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const isSeeker = isAuthenticated && user?.role === ROLES.SEEKER;
  const [ids, setIds] = useState(() => new Set());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSeeker) {
      setIds(new Set());
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/wishlists');
      const pack = extractData(data) || {};
      setItems(pack.items || []);
      setIds(new Set((pack.hostel_ids || []).map(Number)));
    } catch {
      setIds(new Set());
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isSeeker]);

  useEffect(() => { refresh(); }, [refresh]);

  const isSaved = useCallback((hostelId) => ids.has(Number(hostelId)), [ids]);

  const toggle = useCallback(async (hostelIdOrCode, { currentlySaved } = {}) => {
    if (!isSeeker) return { ok: false, needLogin: true };
    const key = hostelIdOrCode;
    const saved = currentlySaved != null
      ? currentlySaved
      : (/^\d+$/.test(String(key)) ? ids.has(Number(key)) : false);
    try {
      if (saved) {
        const { data } = await api.delete(`/wishlists/${encodeURIComponent(key)}`);
        const pack = extractData(data);
        const hid = Number(pack?.hostel_id);
        setIds((prev) => {
          const next = new Set(prev);
          if (hid) next.delete(hid);
          return next;
        });
        setItems((prev) => prev.filter((row) => Number(row.id) !== hid));
        enqueueSnackbar('Removed from saved', { variant: 'info' });
        return { ok: true, saved: false };
      }
      const body = /^\d+$/.test(String(key))
        ? { hostel_id: Number(key) }
        : { code: String(key) };
      const { data } = await api.post('/wishlists', body);
      const pack = extractData(data);
      const hid = Number(pack?.hostel_id);
      if (hid) setIds((prev) => new Set(prev).add(hid));
      enqueueSnackbar('Saved', { variant: 'success' });
      await refresh();
      return { ok: true, saved: true };
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
      return { ok: false, error: getErrorMessage(err) };
    }
  }, [enqueueSnackbar, ids, isSeeker, refresh]);

  const value = useMemo(() => ({
    isSeeker,
    loading,
    items,
    ids,
    isSaved,
    toggle,
    refresh,
  }), [ids, isSaved, isSeeker, items, loading, refresh, toggle]);

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};

const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    return {
      isSeeker: false,
      loading: false,
      items: [],
      ids: new Set(),
      isSaved: () => false,
      toggle: async () => ({ ok: false, needLogin: true }),
      refresh: async () => {},
    };
  }
  return ctx;
};

export default useWishlist;
