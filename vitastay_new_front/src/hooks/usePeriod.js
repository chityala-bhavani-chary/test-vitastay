import { useMemo, useState } from 'react';
import {
  defaultPeriod,
  periodBounds,
  periodMonthKeys,
} from '../utils/periodRange';

const usePeriod = (initial) => {
  const [period, setPeriod] = useState(initial || defaultPeriod());
  const bounds = useMemo(() => periodBounds(period), [period]);
  const monthKeys = useMemo(() => periodMonthKeys(period), [period]);
  return { period, setPeriod, bounds, monthKeys };
};

export default usePeriod;
