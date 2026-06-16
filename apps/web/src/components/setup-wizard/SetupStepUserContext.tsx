import { useEffect, useState } from "react";
import { UserContextSettings } from "@/components/UserContextCard";
import { TimezoneSelect } from "@/components/TimezoneSelect";
import { Button } from "@/components/ui/button";
import { useSaveUserTimezone, useUserTimezone } from "@/hooks/use-timezones";
import { getBrowserTimezone } from "@/lib/timezones";

interface SetupStepUserContextProps {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export function SetupStepUserContext({ onNext, onSkip, onBack }: SetupStepUserContextProps) {
  const [timezone, setTimezone] = useState(() => getBrowserTimezone());
  const { data: savedTimezone } = useUserTimezone();
  const saveTimezoneMutation = useSaveUserTimezone();

  useEffect(() => {
    if (savedTimezone) {
      setTimezone(savedTimezone);
    }
  }, [savedTimezone]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-card">
        <UserContextSettings autoInit={true} />
      </div>

      <div className="rounded-md border border-border bg-card px-4 py-3">
        <div className="space-y-2">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">Timezone</p>
            <p className="text-xs text-muted-foreground">For scheduled automations and local time awareness</p>
          </div>
          <TimezoneSelect
            id="setup-timezone"
            value={timezone}
            disabled={saveTimezoneMutation.isPending}
            emptyLabel="Select timezone"
            onValueChange={(nextTimezone) => {
              if (nextTimezone) {
                setTimezone(nextTimezone);
                saveTimezoneMutation.mutate(nextTimezone);
              }
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
        >
          Back
        </Button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            onClick={onSkip}
          >
            Set up later
          </button>

          <Button
            type="button"
            size="sm"
            onClick={onNext}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}