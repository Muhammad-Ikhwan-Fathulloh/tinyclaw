import { QueryClient, type QueryCacheNotifyEvent } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function onGlobalQueryError(event: QueryCacheNotifyEvent) {
  const error = event.query?.state?.error;
  if (error instanceof Error && error.message?.includes("401")) {
    localStorage.removeItem("tinyclaw_auth_token");
    window.location.href = "/login";
  }
}
