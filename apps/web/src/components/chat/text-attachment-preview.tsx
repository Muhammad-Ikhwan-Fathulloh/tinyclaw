import { XIcon } from "lucide-react";
import { wordCountFromPastedFilename } from "@/lib/pasted-text";
import { cn } from "@/lib/utils";

interface TextAttachmentPreviewProps {
  filename: string;
  wordCount?: number;
  onRemove?: () => void;
  className?: string;
}

export function TextAttachmentPreview({
  filename,
  wordCount,
  onRemove,
  className,
}: TextAttachmentPreviewProps) {
  const resolvedWordCount = wordCount ?? wordCountFromPastedFilename(filename) ?? undefined;

  return (
    <div
      className={cn(
        "relative inline-flex max-w-full shrink-0 items-center rounded-lg border border-border bg-muted px-3 py-2",
        onRemove ? "pr-8" : undefined,
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">Pasted text</p>
        {resolvedWordCount != null ? (
          <p className="text-[10px] text-muted-foreground">{resolvedWordCount} words</p>
        ) : null}
      </div>
      {onRemove ? (
        <button
          type="button"
          className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-transparent text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`Remove ${filename}`}
          onClick={onRemove}
        >
          <XIcon className="size-3" />
        </button>
      ) : null}
    </div>
  );
}
