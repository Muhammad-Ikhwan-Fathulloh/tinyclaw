import type { ConfigureProviderResponse } from "@tinyclaw/core/contract";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  useConfigureProviderMutation,
  useHealthQuery,
  useModelsQuery,
  useRefreshAppData,
  useSetModelMutation,
} from "@/hooks/use-app-queries";
import { formatError } from "@/lib/client";

interface AppContextValue {
  health: ReturnType<typeof useHealthQuery>["data"] | null;
  models: ReturnType<typeof useModelsQuery>["data"] | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setModel: (modelId: string) => Promise<void>;
  configureProvider: (apiKey: string, model?: string) => Promise<ConfigureProviderResponse>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const healthQuery = useHealthQuery();
  const providerConfigured = healthQuery.data?.providerConfigured === true;
  const modelsQuery = useModelsQuery({ enabled: providerConfigured });
  const refreshAppData = useRefreshAppData();
  const configureProviderMutation = useConfigureProviderMutation();
  const setModelMutation = useSetModelMutation();

  const refresh = useCallback(async () => {
    await refreshAppData();
  }, [refreshAppData]);

  const setModel = useCallback(
    async (modelId: string) => {
      await setModelMutation.mutateAsync(modelId);
    },
    [setModelMutation],
  );

  const configureProvider = useCallback(
    async (apiKey: string, model?: string) => {
      return configureProviderMutation.mutateAsync({ apiKey, model });
    },
    [configureProviderMutation],
  );

  const error = useMemo(() => {
    if (healthQuery.error) {
      return formatError(healthQuery.error);
    }

    if (modelsQuery.error) {
      return formatError(modelsQuery.error);
    }

    return null;
  }, [healthQuery.error, modelsQuery.error]);

  const loading =
    healthQuery.isLoading || (providerConfigured && modelsQuery.isLoading);

  const value = useMemo(
    () => ({
      health: healthQuery.data ?? null,
      models: modelsQuery.data ?? null,
      loading,
      error,
      refresh,
      setModel,
      configureProvider,
    }),
    [
      healthQuery.data,
      modelsQuery.data,
      loading,
      error,
      refresh,
      setModel,
      configureProvider,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const value = useContext(AppContext);

  if (!value) {
    throw new Error("useAppContext must be used within AppProvider");
  }

  return value;
}
