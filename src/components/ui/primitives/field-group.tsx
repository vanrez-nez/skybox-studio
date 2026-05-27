import {
  type ComponentPropsWithoutRef,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/primitives/button";
import { cn } from "@/lib/utils";

type FieldGroupProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  children: ReactNode;
  collapsed?: boolean;
  collapsible?: boolean;
  contentClassName?: string;
  defaultCollapsed?: boolean;
  indent?: boolean;
  label: ReactNode;
  onCollapsedChange?: (collapsed: boolean) => void;
};

const FIELD_GROUP_CONTENT_TRANSITION_MS = 200;

export function FieldGroup({
  children,
  className,
  collapsed,
  collapsible = false,
  contentClassName,
  defaultCollapsed = false,
  indent = false,
  label,
  onCollapsedChange,
  ...props
}: FieldGroupProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isCollapsed = collapsible ? collapsed ?? internalCollapsed : false;
  const [shouldRenderContent, setShouldRenderContent] = useState(!isCollapsed);
  const [isContentOpaque, setIsContentOpaque] = useState(!isCollapsed);
  const previousCollapsedRef = useRef(isCollapsed);

  const setCollapsed = (nextCollapsed: boolean) => {
    if (collapsed === undefined) {
      setInternalCollapsed(nextCollapsed);
    }

    onCollapsedChange?.(nextCollapsed);
  };

  useEffect(() => {
    const previousCollapsed = previousCollapsedRef.current;
    previousCollapsedRef.current = isCollapsed;

    if (previousCollapsed === isCollapsed) {
      return;
    }

    if (!isCollapsed) {
      setShouldRenderContent(true);
      setIsContentOpaque(false);

      const revealContent = window.setTimeout(() => {
        setIsContentOpaque(true);
      }, FIELD_GROUP_CONTENT_TRANSITION_MS);

      return () => {
        window.clearTimeout(revealContent);
      };
    }

    setIsContentOpaque(false);

    const unmountContent = window.setTimeout(() => {
      setShouldRenderContent(false);
    }, FIELD_GROUP_CONTENT_TRANSITION_MS);

    return () => {
      window.clearTimeout(unmountContent);
    };
  }, [isCollapsed]);

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)} {...props}>
      {collapsible ? (
        <button
          aria-expanded={!isCollapsed}
          className="flex min-w-0 items-center gap-2 rounded-md text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onClick={() => setCollapsed(!isCollapsed)}
          type="button"
        >
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md">
            {isCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
          </span>
          <span className="min-w-0 truncate text-xs font-medium">{label}</span>
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-xs font-medium">{label}</span>
        </div>
      )}
      <div
        aria-hidden={isCollapsed}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {shouldRenderContent ? (
            <div
              className={cn(
                "transition-opacity ease-out",
                indent && collapsible && "pl-8",
                isContentOpaque
                  ? "opacity-100 duration-150"
                  : "pointer-events-none opacity-0 duration-100",
                contentClassName
              )}
            >
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
