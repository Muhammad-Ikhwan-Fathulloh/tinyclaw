import type { ConfigureProviderResponse } from "@tinyclaw/core/contract";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppContext } from "@/context/app-context";
import { useModelsQuery } from "@/hooks/use-app-queries";
import { formatError } from "@/lib/client";
import {
  defaultModelForProvider,
  filterModelsByProvider,
  formatProviderLabel,
  getModelDisplayName,
  inferProviderFromApiKey,
  type InferredProvider,
  resolveModelForProvider,
  validateApiKeyForProvider,
  validateCustomOpenRouterModel,
} from "@/lib/models";

interface UseProviderSetupFormOptions {
  onSuccess?: (result: ConfigureProviderResponse) => void;
}

export function useProviderSetupForm(options: UseProviderSetupFormOptions = {}) {
  const { configureProvider } = useAppContext();
  const { data: catalogResponse, error: catalogQueryError } = useModelsQuery();
  const catalog = catalogResponse?.models ?? [];

  const [selectedProvider, setSelectedProvider] = useState<InferredProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyTouched, setApiKeyTouched] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [customModelError, setCustomModelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (catalogQueryError) {
      setFormError(formatError(catalogQueryError));
    }
  }, [catalogQueryError]);

  const inferredProvider = useMemo(() => {
    const trimmed = apiKey.trim();
    return trimmed ? inferProviderFromApiKey(trimmed) : null;
  }, [apiKey]);

  useEffect(() => {
    if (inferredProvider && inferredProvider !== selectedProvider) {
      setSelectedProvider(inferredProvider);
    }
  }, [inferredProvider, selectedProvider]);

  const filteredModels = useMemo(
    () => filterModelsByProvider(catalog, selectedProvider),
    [catalog, selectedProvider],
  );

  useEffect(() => {
    if (filteredModels.length === 0) {
      return;
    }

    setSelectedModel((current) => {
      if (current && filteredModels.some((model) => model.id === current)) {
        return current;
      }

      return defaultModelForProvider(catalog, selectedProvider);
    });
  }, [selectedProvider, filteredModels, catalog]);

  const handleApiKeyBlur = useCallback(() => {
    setApiKeyTouched(true);

    if (!apiKey.trim()) {
      setApiKeyError(null);
      return;
    }

    setApiKeyError(validateApiKeyForProvider(apiKey, selectedProvider));
  }, [apiKey, selectedProvider]);

  const handleApiKeyChange = useCallback(
    (value: string) => {
      setApiKey(value);

      if (formError) {
        setFormError(null);
      }

      if (apiKeyTouched && value.trim()) {
        setApiKeyError(validateApiKeyForProvider(value, selectedProvider));
      } else if (apiKeyError) {
        setApiKeyError(null);
      }
    },
    [apiKeyTouched, apiKeyError, formError, selectedProvider],
  );

  const handleProviderSelect = useCallback(
    (provider: InferredProvider) => {
      setSelectedProvider(provider);

      if (provider !== "openrouter") {
        setCustomModel("");
        setCustomModelError(null);
      }

      if (apiKeyTouched && apiKey.trim()) {
        setApiKeyError(validateApiKeyForProvider(apiKey, provider));
      }
    },
    [apiKey, apiKeyTouched],
  );

  const handleCustomModelChange = useCallback((value: string) => {
    setCustomModel(value);
    setCustomModelError(validateCustomOpenRouterModel(value));
  }, []);

  const { onSuccess } = options;

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      const trimmedKey = apiKey.trim();
      const nextApiKeyError = validateApiKeyForProvider(trimmedKey, selectedProvider);
      const nextCustomModelError =
        selectedProvider === "openrouter"
          ? validateCustomOpenRouterModel(customModel)
          : null;

      setApiKeyTouched(true);
      setApiKeyError(nextApiKeyError);
      setCustomModelError(nextCustomModelError);

      if (nextApiKeyError) {
        document.getElementById("api-key")?.focus();
        return;
      }

      if (nextCustomModelError) {
        document.getElementById("custom-model")?.focus();
        return;
      }

      const modelToSave = resolveModelForProvider(
        selectedProvider,
        selectedModel,
        customModel,
      );

      setBusy(true);
      setFormError(null);

      try {
        const result = await configureProvider(
          trimmedKey,
          modelToSave || undefined,
          selectedProvider,
        );
        setApiKey("");
        setApiKeyTouched(false);
        setShowApiKey(false);
        setCustomModel("");
        onSuccess?.(result);
      } catch (err) {
        setFormError(formatError(err));
        document.getElementById("api-key")?.focus();
      } finally {
        setBusy(false);
      }
    },
    [
      apiKey,
      customModel,
      selectedModel,
      selectedProvider,
      configureProvider,
      onSuccess,
    ],
  );

  return {
    catalog,
    selectedProvider,
    apiKey,
    showApiKey,
    apiKeyError,
    selectedModel,
    customModel,
    customModelError,
    busy,
    formError,
    filteredModels,
    setSelectedModel,
    setShowApiKey,
    handleApiKeyBlur,
    handleApiKeyChange,
    handleProviderSelect,
    handleCustomModelChange,
    handleSubmit,
    formatSuccessMessage: (result: ConfigureProviderResponse) =>
      `${formatProviderLabel(result.provider)} connected with ${getModelDisplayName(catalog, result.currentModel)}.`,
  };
}
