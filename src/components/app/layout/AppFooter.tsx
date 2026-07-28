import { GithubMark } from "@/components/app/GithubMark";
import { APP_NAME, REPO_LABEL, REPO_URL } from "@/lib/constants";

// Persistent bottom status bar: project name + app/runtime versions on the left, GitHub link on the right.
export function AppFooter() {
  return (
    <footer
      aria-label="Status bar"
      className="flex h-6 w-full flex-none items-center justify-between border-t bg-background px-2 text-[11px] text-muted-foreground"
    >
      <div className="inline-flex min-w-0 items-center gap-1.5">
        <span className="text-foreground">{APP_NAME}</span>
        <span className="opacity-60">v{__APP_VERSION__}</span>
        <span className="opacity-40">·</span>
        <span className="opacity-60">runtime v{__RUNTIME_VERSION__}</span>
        <span className="opacity-40">·</span>
        <span className="opacity-60" title="Build commit">
          {__COMMIT_HASH__}
        </span>
      </div>
      <a
        className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
      >
        <GithubMark />
        {REPO_LABEL}
      </a>
    </footer>
  );
}
