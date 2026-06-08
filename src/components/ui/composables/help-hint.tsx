import { type MouseEvent, useMemo, useRef, useState } from "react";
import { CircleQuestionMark } from "lucide-react";

import { MarkdownContent } from "@/components/ui/composables/markdown-content";
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
          <MarkdownContent content={body} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
