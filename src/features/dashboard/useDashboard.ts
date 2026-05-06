import { useState, useEffect } from 'react';
import { fetchDashboardData, DashboardData } from './dashboard.service';

interface UseDashboardResult {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDashboard(): UseDashboardResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchDashboardData()
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.error?.message ?? err?.message ?? 'Erreur lors du chargement du tableau de bord.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [tick]);

  return {
    data,
    isLoading,
    error,
    refetch: () => setTick((t) => t + 1),
  };
}
