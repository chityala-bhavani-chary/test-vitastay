/**
 * BIC-023 — select up to 3 published listing ids for /compare?ids=
 */
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'vs_compare_ids';
const MAX = 3;

const readIds = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(Number).filter((id) => Number.isFinite(id) && id > 0).slice(0, MAX);
  } catch {
    return [];
  }
};

const writeIds = (ids) => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX)));
};

const useCompareSelection = () => {
  const [ids, setIds] = useState(() => (typeof window === 'undefined' ? [] : readIds()));

  useEffect(() => {
    writeIds(ids);
  }, [ids]);

  const isSelected = useCallback((hostelId) => ids.includes(Number(hostelId)), [ids]);

  const toggle = useCallback((hostelId) => {
    const id = Number(hostelId);
    if (!Number.isFinite(id) || id <= 0) return { ok: false };

    let nextIds = ids;
    let result = { ok: true };
    if (ids.includes(id)) {
      nextIds = ids.filter((row) => row !== id);
      result = { ok: true, selected: false };
    } else if (ids.length >= MAX) {
      result = { ok: false, full: true };
      nextIds = ids;
    } else {
      nextIds = [...ids, id];
      result = { ok: true, selected: true };
    }
    setIds(nextIds);
    writeIds(nextIds);
    return result;
  }, [ids]);

  const clear = useCallback(() => {
    setIds([]);
    writeIds([]);
  }, []);

  const compareHref = ids.length >= 2
    ? `/compare?ids=${ids.join(',')}`
    : null;

  return {
    ids,
    count: ids.length,
    max: MAX,
    isSelected,
    toggle,
    clear,
    compareHref,
    canCompare: ids.length >= 2,
  };
};

export default useCompareSelection;
