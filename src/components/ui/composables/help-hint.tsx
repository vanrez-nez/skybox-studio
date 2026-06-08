import { type MouseEvent, useMemo, useRef, useState } from "react";
import { CircleQuestionMark } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/primitives/dialog";
import { cn } from "@/lib/utils";
import {
  Widget,
  type WidgetOwnerRect,
  type WidgetPosition,
} from "@/components/sidebar/panels/Widget";

type HelpHintSize = "xs" | "md" | "lg";
type HelpHintTrigger = "hover" | "click" | "both";

type HelpHintProps = {
  /** Raw markdown doc (frontmatter `title` + `description`, then the full body). Import via `?raw`. */
  doc: string;
  /** Interaction: hover shows the description, click opens the dialog. Default "both". */
  trigger?: HelpHintTrigger;
  /** Button size; defaults to "md". */
  size?: HelpHintSize;
  ariaLabel?: string;
  className?: string;
  /** Extra classes for the dialog content. */
  contentClassName?: string;
};

const SIZE_TO_BUTTON: Record<HelpHintSize, "icon-xs" | "icon-sm" | "icon-lg"> = {
  lg: "icon-lg",
  md: "icon-sm",
  xs: "icon-xs",
};

// A touch larger than each button size's default glyph, so the "?" reads clearly.
const SIZE_TO_ICON: Record<HelpHintSize, string> = {
  lg: "size-6",
  md: "size-5",
  xs: "size-4",
};

// Fixed hover-panel width so the text never re-wraps, and a matching viewport pad so we can
// pre-clamp the open position (the Widget would otherwise re-clamp after measuring → a visible jump
// when the button sits near the right edge).
const HOVER_PANEL_WIDTH = 288;
const VIEWPORT_PADDING = 12;

// Compact markdown styling (no `prose` plugin). Links open in a new tab; raw HTML is sanitized.
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
    <h1 className={cn("mt-3 mb-1 text-sm font-semibold first:mt-0", className)} {...props} />
  ),
  h2: ({ className, ...props }: { className?: string }) => (
    <h2 className={cn("mt-3 mb-1 text-sm font-semibold first:mt-0", className)} {...props} />
  ),
  h3: ({ className, ...props }: { className?: string }) => (
    <h3 className={cn("mt-2 mb-1 text-sm font-semibold first:mt-0", className)} {...props} />
  ),
  li: ({ className, ...props }: { className?: string }) => (
    <li className={cn("my-0.5", className)} {...props} />
  ),
  ol: ({ className, ...props }: { className?: string }) => (
    <ol className={cn("my-1 list-decimal pl-4", className)} {...props} />
  ),
  p: ({ className, ...props }: { className?: string }) => (
    <p className={cn("my-1.5 first:mt-0 last:mb-0", className)} {...props} />
  ),
  pre: ({ className, ...props }: { className?: string }) => (
    <pre
      className={cn(
        "my-1.5 overflow-x-auto rounded bg-muted p-2 text-xs [&>code]:bg-transparent [&>code]:p-0",
        className
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }: { className?: string }) => (
    <ul className={cn("my-1 list-disc pl-4", className)} {...props} />
  ),
};

type ParsedHelpDoc = { body: string; description: string; title: string };

// Minimal frontmatter parser for our controlled help docs: a leading `---` block of `key: value`
// lines (we read `title` + `description`); everything after is the markdown body.
function parseHelpDoc(raw: string): ParsedHelpDoc {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(raw);

  if (!match) {
    return { body: raw.trim(), description: "", title: "" };
  }

  let title = "";
  let description = "";

  for (const line of match[1].split("\n")) {
    const field = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());

    if (!field) {
      continue;
    }

    const value = field[2].trim().replace(/^["']|["']$/g, "");

    if (field[1] === "title") {
      title = value;
    } else if (field[1] === "description") {
      description = value;
    }
  }

  return { body: raw.slice(match[0].length).trim(), description, title };
}

function rectToOwnerRect(rect: DOMRect): WidgetOwnerRect {
  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  };
}

function HintMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed break-words">
      <Markdown components={MARKDOWN_COMPONENTS} remarkPlugins={[remarkGfm]}>
        {content}
      </Markdown>
    </div>
  );
}

export function HelpHint({
  ariaLabel = "More info",
  className,
  contentClassName,
  doc,
  size = "md",
  trigger = "both",
}: HelpHintProps) {
  const { body, description, title } = useMemo(() => parseHelpDoc(doc), [doc]);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [position, setPosition] = useState<WidgetPosition>({ x: 12, y: 12 });
  const [ownerRect, setOwnerRect] = useState<WidgetOwnerRect | null>(null);
  const leaveTimerRef = useRef<number>(0);

  const showHover = (trigger === "hover" || trigger === "both") && Boolean(description);
  const showDialog = trigger === "click" || trigger === "both";

  // Open the hover description below the button, anchoring the (bordered) callout to it — reuses the
  // same floating Widget the FloatingColorPicker uses, so the callout style/logic is identical.
  const openHover = (event: MouseEvent<HTMLButtonElement>) => {
    window.clearTimeout(leaveTimerRef.current);
    const rect = event.currentTarget.getBoundingClientRect();
    const maxX = Math.max(VIEWPORT_PADDING, window.innerWidth - HOVER_PANEL_WIDTH - VIEWPORT_PADDING);

    // Pre-clamp so the panel opens at its final x (no post-measure jump near the right edge).
    setPosition({ x: Math.min(Math.max(rect.left, VIEWPORT_PADDING), maxX), y: rect.bottom + 6 });
    setOwnerRect(rectToOwnerRect(rect));
    setHoverOpen(true);
  };

  const closeHover = () => {
    window.clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = window.setTimeout(() => setHoverOpen(false), 80);
  };

  const button = (
    <Button
      aria-label={ariaLabel}
      className={cn("rounded-full text-muted-foreground", className)}
      onClick={showHover ? () => setHoverOpen(false) : undefined}
      onMouseEnter={showHover ? openHover : undefined}
      onMouseLeave={showHover ? closeHover : undefined}
      size={SIZE_TO_BUTTON[size]}
      type="button"
      variant="ghost"
    >
      <CircleQuestionMark className={SIZE_TO_ICON[size]} />
    </Button>
  );

  const hoverPanel =
    showHover && hoverOpen ? (
      <Widget
        contentClassName="min-h-0 p-3"
        floatingOwnerRect={ownerRect ?? undefined}
        floatingPosition={position}
        showFloatingOwnerCallout
        style={{ width: HOVER_PANEL_WIDTH }}
        variant="floating"
      >
        <p className="leading-relaxed">{description}</p>
      </Widget>
    ) : null;

  if (!showDialog) {
    return (
      <>
        {button}
        {hoverPanel}
      </>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{button}</DialogTrigger>
      {hoverPanel}
      <DialogContent className={cn("max-w-lg", contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title || "Help"}</DialogTitle>
          {description ? (
            <DialogDescription className="sr-only">{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <HintMarkdown content={body} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
