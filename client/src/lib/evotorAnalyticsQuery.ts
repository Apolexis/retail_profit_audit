/**
 * Read-only aggregate data are locally immutable between scheduled sync cycles.
 * Keep a completed result visible when the same analytics view regains focus,
 * then refresh it in the background on the same one-minute status cadence.
 */
export const evotorAnalyticsQueryOptions = {
  retry: false,
  staleTime: 45_000,
  refetchInterval: 60_000,
  refetchOnWindowFocus: false,
} as const;
