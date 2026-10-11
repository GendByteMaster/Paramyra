import Link from "next/link";
import { GitBranch, Layers3 } from "lucide-react";
import type { ReactNode } from "react";

/** One semantic panel heading used by both Studio and React Flow workspaces. */
export function EditorPanelHeader({
  className = "",
  eyebrow,
  title,
  description,
  icon,
}: {
  className?: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <header className={`${className} pm-editor-panel-heading`}>
      <span className="pm-editor-panel-icon" aria-hidden="true">{icon}</span>
      <div className="pm-editor-panel-heading-content">
        <span className="pm-editor-panel-kicker">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
  );
}

/** The same mode switch and navigation semantics in both editing modes. */
export function EditorModeSwitch({
  active,
  liveGraph = false,
}: {
  active: "studio" | "graph";
  liveGraph?: boolean;
}) {
  return (
    <nav className="pm-editor-mode-switch" aria-label="Workspace modes">
      <Link href="/studio" aria-current={active === "studio" ? "page" : undefined}>
        <Layers3 size={15} aria-hidden="true" />
        Studio
      </Link>
      <Link
        href="/studio/graph"
        aria-current={active === "graph" ? "page" : undefined}
        aria-label={active === "studio" ? "Open Node Graph Workspace" : undefined}
      >
        <GitBranch size={15} aria-hidden="true" />
        Node Graph{liveGraph ? " · LIVE" : ""}
      </Link>
    </nav>
  );
}
