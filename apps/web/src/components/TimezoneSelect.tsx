import { ChevronDownIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useTimezoneCatalog } from "@/hooks/use-timezones";
import {
  getBrowserTimezone,
  getFilteredTimezoneGroups,
  getTimezoneDisplay,
} from "@/lib/timezones";
import { cn } from "@/lib/utils";

interface TimezoneSelectProps {
  id?: string;
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyLabel?: string;
  allowAccountDefault?: boolean;
  showBrowserQuickPick?: boolean;
  className?: string;
}

export function TimezoneSelect({
  id,
  value,
  onValueChange,
  disabled = false,
  placeholder = "Search timezones…",
  emptyLabel = "Select timezone",
  allowAccountDefault = false,
  showBrowserQuickPick = true,
  className,
}: TimezoneSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: catalog, isLoading, isError } = useTimezoneCatalog();
  const browserTimezone = useMemo(() => getBrowserTimezone(), []);

  const filteredGroups = useMemo(
    () => getFilteredTimezoneGroups(query, catalog),
    [catalog, query],
  );

  const selectedLabel = allowAccountDefault && !value?.trim()
    ? "Account default"
    : getTimezoneDisplay(value, emptyLabel, catalog);

  const showSuggested = allowAccountDefault || showBrowserQuickPick;
  const loading = isLoading;
  const unavailable = isError || (!loading && !catalog);

  return (
    <div className="w-full">
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);

          if (!nextOpen) {
            setQuery("");
          }
        }}
      >
        <PopoverTrigger
          id={id}
          disabled={disabled || loading}
          aria-label="Select timezone"
          className={cn(
            "flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
            !value?.trim() && allowAccountDefault && "text-muted-foreground",
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {loading
              ? "Loading timezones…"
              : unavailable
                ? "Timezone list unavailable"
                : selectedLabel}
          </span>
          {loading ? (
            <Spinner className="size-4 shrink-0" />
          ) : (
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
        </PopoverTrigger>

        <PopoverContent align="start" sideOffset={4} className="overflow-hidden p-0">
          <Command shouldFilter={false} className="rounded-lg bg-transparent p-0">
            <div className="border-b border-border/60 p-2 [&_[data-slot=command-input-wrapper]]:p-0">
              <CommandInput
                placeholder={placeholder}
                value={query}
                disabled={loading || unavailable}
                onValueChange={setQuery}
              />
            </div>
            <CommandList className="max-h-72 p-1">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Spinner />
                  Loading…
                </div>
              ) : unavailable ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Could not load timezones.
                </div>
              ) : (
                <>
                  <CommandEmpty className="py-6">No timezone found.</CommandEmpty>

                  {showSuggested && !query.trim() ? (
                    <CommandGroup heading="Suggested" className="p-1">
                      {allowAccountDefault ? (
                        <CommandItem
                          value="__account_default__"
                          onSelect={() => {
                            onValueChange(undefined);
                            setOpen(false);
                            setQuery("");
                          }}
                        >
                          Account default
                        </CommandItem>
                      ) : null}
                      {showBrowserQuickPick ? (
                        <CommandItem
                          value={browserTimezone}
                          onSelect={() => {
                            onValueChange(browserTimezone);
                            setOpen(false);
                            setQuery("");
                          }}
                        >
                          Browser · {getTimezoneDisplay(browserTimezone, browserTimezone, catalog)}
                        </CommandItem>
                      ) : null}
                    </CommandGroup>
                  ) : null}

                  {filteredGroups.map((group) => (
                    <CommandGroup key={group.countryCode} heading={group.countryName} className="p-1">
                      {group.timezones.map((option) => (
                        <CommandItem
                          key={option.id}
                          value={option.id}
                          onSelect={() => {
                            onValueChange(option.id);
                            setOpen(false);
                            setQuery("");
                          }}
                        >
                          <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                            <span className="min-w-0 truncate">{option.label}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {option.abbreviation}
                            </span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
