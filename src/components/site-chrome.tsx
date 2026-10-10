"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Public navigation belongs to the website, not the editor.
 * Keep Graph Workspace chrome-independent without hiding its own tools.
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const graphWorkspace =
    pathname === "/studio/graph" || pathname.startsWith("/studio/graph/");

  if (graphWorkspace) return null;
  return <>{children}</>;
}
