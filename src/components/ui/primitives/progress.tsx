import { cn } from "@/lib/utils";

type ProgressProps = {
  className?: string;
  /** 0..1 progress. When omitted, renders an indeterminate sweep. */
  value?: number;
};

export function Progress({ className, value }: ProgressProps) {
  const indeterminate = value === undefined;
  const clamped = indeterminate ? 0 : Math.min(1, Math.max(0, value));

  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={indeterminate ? undefined : Math.round(clamped * 100)}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-primary/20", className)}
      role="progressbar"
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-[width] duration-200 ease-out",
          indeterminate && "w-1/3 animate-pulse"
        )}
        style={indeterminate ? undefined : { width: `${clamped * 100}%` }}
      />
    </div>
  );
}
