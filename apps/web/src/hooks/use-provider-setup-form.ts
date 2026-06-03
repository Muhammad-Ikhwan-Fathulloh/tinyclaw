import type { ConfigureProviderResponse } from "@tinyclaw/core/contract";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ModelListRow } from "@/components/ModelListEditor";
import { toCustomModelEntries } from "@/components/CustomCompatibleProviderFields";
import { useAppContext } from "@/context/app-context";
import { useModelsQuery } from "@/hooks/use-app-queries";
import { formatError } from "@/lib/client";
import {
  buildConfigureProviderRequest,
  defaultModelForProvider,
  filterModelsByProvider,
  formatProviderLabel,
  getModelDisplayName,
  modelsFromCustomRows,
  type SelectedProvider,
  resolveModelForProvider,
  validateApiKeyForProvider,
  validateBaseUrlInput,
  validateCustomModelsInput,
  validateCustomOpenRouterModel,
  validateDisplayNameInput,
} from "@/lib/models";

interface UseProviderSetupFormOptions {
  onSuccess?: (result: ConfigureProviderResponse) => void;
}

export function useProviderSetupForm(options: UseProviderSetupFormOptions = {}) {
  const { configureProvider } = useAppContext();
  const { data: catalogResponse, error: catalogQueryError } = useModelsQuery();
  const catalog = catalogResponse?.models ?? [];

  const [selectedProvider, setSelectedProvider] = useState<SelectedProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyTouched, setApiKeyTouched] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [customModelError, setCustomModelError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [customModels, setCustomModels] = useState<ModelListRow[]>([{ id: "", name: "" }]);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [baseUrlError, setBaseUrlError] = useState<string | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (catalogQueryError) {
      setFormError(formatError(catalogQueryError));
    }
  }, [catalogQueryError]);

  const filteredModels = useMemo(() => {
    if (selectedProvider === "openai_compatible") {
      return modelsFromCustomRows(customModels);
    }

    return filterModelsByProvider(catalog, selectedProvider);
  }, [catalog, selectedProvider, customModels]);

  useEffect(() => {
    if (filteredModels.length === 0) {
      return;
    }

    setSelectedModel((current) => {
      if (current && filteredModels.some((model) => model.id === current)) {
        return current;
      }

      return defaultModelForProvider(filteredModels, selectedProvider);
    });
  }, [selectedProvider, filteredModels]);

  const handleApiKeyBlur = useCallback(() => {
    setApiKeyTouched(true);
    setApiKeyError(validateApiKeyForProvider(apiKey, selectedProvider));
  }, [apiKey, selectedProvider]);

  const handleApiKeyChange = useCallback(
    (value: string) => {
      setApiKey(value);

      if (formError) {
        setFormError(null);
      }

      if (apiKeyTouched) {
        setApiKeyError(validateApiKeyForProvider(value, selectedProvider));
      } else if (apiKeyError) {
        setApiKeyError(null);
      }
    },
    [apiKeyTouched, apiKeyError, formError, selectedProvider],
  );

  const handleProviderSelect = useCallback((provider: SelectedProvider) => {
    setSelectedProvider(provider);

    if (provider !== "openrouter") {
      setCustomModel("");
      setCustomModelError(null);
    }

    if (provider !== "openai_compatible") {
      setDisplayNameError(null);
      setBaseUrlError(null);
      setModelsError(null);
    }
  }, []);

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
      const nextDisplayNameError =
        selectedProvider === "openai_compatible"
          ? validateDisplayNameInput(displayName)
          : null;
      const nextBaseUrlError =
        selectedProvider === "openai_compatible" ? validateBaseUrlInput(baseUrl) : null;
      const nextModelsError =
        selectedProvider === "openai_compatible"
          ? validateCustomModelsInput(customModels)
          : null;

      setApiKeyTouched(true);
      setApiKeyError(nextApiKeyError);
      setCustomModelError(nextCustomModelError);
      setDisplayNameError(nextDisplayNameError);
      setBaseUrlError(nextBaseUrlError);
      setModelsError(nextModelsError);

      if (nextApiKeyError) {
        document.getElementById("api-key")?.focus();
        return;
      }

      if (nextCustomModelError) {
        document.getElementById("custom-model")?.focus();
        return;
      }

      if (nextDisplayNameError) {
        document.getElementById("provider-display-name")?.focus();
        return;
      }

      if (nextBaseUrlError) {
        document.getElementById("provider-base-url")?.focus();
        return;
      }

      if (nextModelsError) {
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
          buildConfigureProviderRequest({
            apiKey: trimmedKey,
            provider: selectedProvider,
            model: modelToSave || undefined,
            displayName,
            baseUrl,
            customModels:
              selectedProvider === "openai_compatible"
                ? toCustomModelEntries(customModels)
                : undefined,
          }),
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
      baseUrl,
      customModel,
      customModels,
      displayName,
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
    displayName,
    baseUrl,
    customModels,
    displayNameError,
    baseUrlError,
    modelsError,
    busy,
    formError,
    filteredModels,
    setSelectedModel,
    setShowApiKey,
    setDisplayName,
    setBaseUrl,
    setCustomModels,
    handleApiKeyBlur,
    handleApiKeyChange,
    handleProviderSelect,
    handleCustomModelChange,
    handleSubmit,
    formatSuccessMessage: (result: ConfigureProviderResponse) =>
      `${formatProviderLabel(result.provider, result.displayName)} connected with ${getModelDisplayName(catalog, result.currentModel)}.`,
  };
}
