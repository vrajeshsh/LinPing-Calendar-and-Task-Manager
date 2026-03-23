'use client';

import { useEffect } from 'react';
import { useScheduleStore } from '@/store/useScheduleStore';

export function StoreInitializer() {
  const fetchInitialData = useScheduleStore(s => s.fetchInitialData);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  return null;
}
