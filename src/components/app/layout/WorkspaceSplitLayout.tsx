import type { ReactNode } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/primitives/resizable";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

type WorkspaceSplitLayoutProps = {
  children: ReactNode;
};

export function WorkspaceSplitLayout({ children }: WorkspaceSplitLayoutProps) {
  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0">
      <ResizablePanel
        className="h-full min-w-0 overflow-hidden"
        defaultSize="80%"
        id="workspace-content"
        minSize="40%"
      >
        {children}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel
        className="h-full overflow-hidden"
        defaultSize="20%"
        id="workspace-sidebar"
        maxSize="35%"
        minSize="15%"
      >
        <WorkspaceSidebar />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
