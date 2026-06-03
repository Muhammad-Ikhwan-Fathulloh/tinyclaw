import type { CustomModelEntry } from "@tinyclaw/core/contract";
import { useState } from "react";
import { ModelListEditor, normalizeModelListRows, type ModelListRow } from "@/components/ModelListEditor";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { client, formatError } from "@/lib/client";

interface CustomCompatibleProviderFieldsProps {
  displayName: string;
  baseUrl: string;
  apiKey: string;
  customModels: ModelListRow[];
  disabled?: boolean;
  density?: "default" | "compact";
  displayNameError?: string | null;
  baseUrlError?: string | null;
  modelsError?: string | null;
  onDisplayNameChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onCustomModelsChange: (models: ModelListRow[]) => void;
}

export function CustomCompatibleProviderFields({
  displayName,
  baseUrl,
  apiKey,
  customModels,
  disabled,
  density = "default",
  displayNameError,
  baseUrlError,
  modelsError,
  onDisplayNameChange,
  onBaseUrlChange,
  onCustomModelsChange,
}: CustomCompatibleProviderFieldsProps) {
  const [fetchBusy, setFetchBusy] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleFetchModels = async () => {
    setFetchBusy(true);
    setFetchError(null);

    try {
      const response = await client.discoverModels({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim() || undefined,
      });
      const remote = response.models.map(
        (model): ModelListRow => ({
          id: model.id,
          name: model.name,
        }),
      );

      if (remote.length === 0) {
        setFetchError("No models returned from the server.");
        return;
      }

      onCustomModelsChange(remote);
    } catch (error) {
      setFetchError(formatError(error));
    } finally {
      setFetchBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <FormField
        id="provider-display-name"
        label="Provider name"
        density={density}
        footer={
          displayNameError ? (
            <p className="text-sm text-destructive" role="alert">
              {displayNameError}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              How this endpoint appears in Settings and Status.
            </p>
          )
        }
      >
        <InputGroup>
          <InputGroupInput
            id="provider-display-name"
            value={displayName}
            disabled={disabled}
            placeholder="Ollama"
            aria-invalid={displayNameError != null}
            onChange={(event) => onDisplayNameChange(event.target.value)}
          />
        </InputGroup>
      </FormField>

      <FormField
        id="provider-base-url"
        label="Base URL"
        density={density}
        footer={
          baseUrlError ? (
            <p className="text-sm text-destructive" role="alert">
              {baseUrlError}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              OpenAI-compatible root, e.g. http://localhost:11434/v1
            </p>
          )
        }
      >
        <InputGroup>
          <InputGroupInput
            id="provider-base-url"
            value={baseUrl}
            disabled={disabled}
            placeholder="http://localhost:11434/v1"
            aria-invalid={baseUrlError != null}
            onChange={(event) => onBaseUrlChange(event.target.value)}
          />
        </InputGroup>
      </FormField>

      <FormField
        id="provider-models"
        label="Models"
        density={density}
        footer={
          modelsError || fetchError ? (
            <p className="text-sm text-destructive" role="alert">
              {modelsError ?? fetchError}
            </p>
          ) : null
        }
      >
        <ModelListEditor
          models={customModels}
          disabled={disabled}
          onChange={onCustomModelsChange}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2"
          disabled={disabled || fetchBusy || !baseUrl.trim()}
          onClick={() => void handleFetchModels()}
        >
          {fetchBusy ? (
            <>
              <Spinner className="mr-2" />
              Fetching…
            </>
          ) : (
            "Fetch from server"
          )}
        </Button>
      </FormField>
    </div>
  );
}

export function toCustomModelEntries(rows: ModelListRow[]): CustomModelEntry[] {
  return normalizeModelListRows(rows);
}
