import type { ReactNode } from "react";
import { CircleQuestionMark, X } from "lucide-react";
import { HoverCard as HoverCardPrimitive, Popover as PopoverPrimitive } from "radix-ui";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/primitives/button";
import { cn } from "@/lib/utils";

type HelpHintSize = "xs" | "md" | "lg";
type HelpHintTrigger = "hover" | "click";
type HelpHintSide = "top" | "right" | "bottom" | "left";
type HelpHintAlign = "start" | "center" | "end";

type HelpHintProps = {
  /** Button aria-label (default "More info"). */
  ariaLabel?: string;
  /** Extra classes for the trigger button. */
  className?: string;
  /** Extra classes for the floating panel. */
  contentClassName?: string;
  /** Markdown body. */
  content: string;
  align?: HelpHintAlign;
  side?: HelpHintSide;
  /** Button size; defaults to "md". */
  size?: HelpHintSize;
  /** Optional panel title. */
  title?: string;
  /** "hover" (default) shows on hover with no close; "click" opens a larger panel with an X close. */
  trigger?: HelpHintTrigger;
};

const SIZE_TO_BUTTON: Record<HelpHintSize, "icon-xs" | "icon-sm" | "icon-lg"> = {
  lg: "icon-lg",
  md: "icon-sm",
  xs: "icon-xs",
};

const PANEL_CLASS =
  "z-50 rounded-md border bg-popover p-3 text-popover-foreground shadow-md outline-none " +
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 " +
  "data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95";

// Compact markdown styling (the project has no `prose` plugin). Links open in a new tab; raw HTML
// is not rendered (react-markdown sanitizes by default).
const MARKDOWN_COMPONENTS = {
  a: ({ className, ...props }: { className?: string }) => (
    <a
      className={cn("font-medium text-primary underline underline-offset-2", className)}
      rel="noreferrer"
      target="_blank"
      {...props}
    />
  ),
  code: ({ className, ...props }: { className?: string }) => (
    <code
      className={cn("rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]", className)}
      {...props}
    />
  ),
  h1: ({ className, ...props }: { className?: string }) => (
    <h1 className={cn("mt-2 mb-1 text-sm font-semibold first:mt-0", className)} {...props} />
  ),
  h2: ({ className, ...props }: { className?: string }) => (
    <h2 className={cn("mt-2 mb-1 text-sm font-semibold first:mt-0", className)} {...props} />
  ),
  h3: ({ className, ...props }: { className?: string }) => (
    <h3 className={cn("mt-2 mb-1 text-xs font-semibold first:mt-0", className)} {...props} />
  ),
  li: ({ className, ...props }: { className?: string }) => (
    <li className={cn("my-0.5", className)} {...props} />
  ),
  ol: ({ className, ...props }: { className?: string }) => (
    <ol className={cn("my-1 list-decimal pl-4", className)} {...props} />
  ),
  p: ({ className, ...props }: { className?: string }) => (
    <p className={cn("my-1 first:mt-0 last:mb-0", className)} {...props} />
  ),
  pre: ({ className, ...props }: { className?: string }) => (
    <pre
      className={cn(
        "my-1 overflow-x-auto rounded bg-muted p-2 text-xs [&>code]:bg-transparent [&>code]:p-0",
        className
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }: { className?: string }) => (
    <ul className={cn("my-1 list-disc pl-4", className)} {...props} />
  ),
};

function HintMarkdown({ content }: { content: string }) {
  return (
    <div className="text-xs leading-relaxed break-words">
      <Markdown components={MARKDOWN_COMPONENTS} remarkPlugins={[remarkGfm]}>
        {content}
      </Markdown>
    </div>
  );
}

function HintPanel({
  closeSlot,
  content,
  title,
}: {
  closeSlot?: ReactNode;
  content: string;
  title?: string;
}) {
  const hasHeader = Boolean(title) || Boolean(closeSlot);

  return (
    <>
      {hasHeader ? (
        <div className="mb-2 flex items-start justify-between gap-3">
          {title ? <div className="text-sm leading-tight font-medium">{title}</div> : <span />}
          {closeSlot}
        </div>
      ) : null}
      <HintMarkdown content={content} />
    </>
  );
}

export function HelpHint({
  align = "center",
  ariaLabel = "More info",
  className,
  content,
  contentClassName,
  side = "top",
  size = "md",
  title,
  trigger = "hover",
}: HelpHintProps) {
  const triggerButton = (
    <Button
      aria-label={ariaLabel}
      className={cn("rounded-full text-muted-foreground", className)}
      size={SIZE_TO_BUTTON[size]}
      type="button"
      variant="ghost"
    >
      <CircleQuestionMark />
    </Button>
  );

  if (trigger === "click") {
    return (
      <PopoverPrimitive.Root>
        <PopoverPrimitive.Trigger asChild>{triggerButton}</PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align={align}
            className={cn(PANEL_CLASS, "max-w-sm", contentClassName)}
            collisionPadding={8}
            side={side}
            sideOffset={6}
          >
            <HintPanel
              closeSlot={
                <PopoverPrimitive.Close asChild>
                  <Button
                    aria-label="Close"
                    className="-mt-1 -mr-1 rounded-full text-muted-foreground"
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  >
                    <X />
                  </Button>
                </PopoverPrimitive.Close>
              }
              content={content}
              title={title}
            />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    );
  }

  return (
    <HoverCardPrimitive.Root closeDelay={120} openDelay={120}>
      <HoverCardPrimitive.Trigger asChild>{triggerButton}</HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          align={align}
          className={cn(PANEL_CLASS, "max-w-xs", contentClassName)}
          collisionPadding={8}
          side={side}
          sideOffset={6}
        >
          <HintPanel content={content} title={title} />
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}
