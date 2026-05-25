import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { queryKeys } from "@/lib/query-keys";

const REFRESH_INTERVAL_MS = 10_000;

export const systemStatusQueryOptions = queryOptions({
  queryKey: queryKeys.systemStatus,
  queryFn: () => client.getSystemStatus(),
  refetchInterval: REFRESH_INTERVAL_MS,
  refetchIntervalInBackground: true,
});

export function useSystemStatusQuery() {
  return useQuery(systemStatusQueryOptions);
}

export function useRefreshSystemStatus() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: queryKeys.systemStatus });
}
