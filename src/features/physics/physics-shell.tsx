"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ArrowUpRight, Beaker, BookOpen, Files, Orbit } from "lucide-react";
import type { ReactNode } from "react";

const routes = [
  { href: "/physics", label: "Overview", icon: Orbit },
  { href: "/physics/gallery", label: "Gallery", icon: BookOpen },
  { href: "/physics/playground", label: "Playground", icon: Beaker },
  { href: "/physics/studio", label: "Studio", icon: Activity },
  { href: "/physics/projects", label: "Projects", icon: Files },
] as const;

export function PhysicsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className="px-platform">
    <header className="px-topbar">
      <Link className="px-brand" href="/physics" aria-label="Paramyra Physics home">
        <span className="px-brand-mark" aria-hidden="true"><Orbit size={18} /></span>
        <span>Paramyra<span className="px-brand-dot">.</span></span>
        <span className="px-product-tag">PHYSICS</span>
      </Link>
      <nav className="px-nav" aria-label="Physics navigation">
        {routes.map(({ href, label, icon: Icon }) => {
          const active = href === "/physics" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? "is-active" : ""}>
            <Icon size={15} aria-hidden="true" /><span>{label}</span>
          </Link>;
        })}
      </nav>
      <Link className="px-discipline-link" href="/" aria-label="Switch to Paramyra Mathematics">
        <span>Mathematics</span><ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </header>
    <section className="px-main" id="physics-main-content" aria-label="Physics workspace">{children}</section>
    <footer className="px-footer">
      <span>PARAMYRA PHYSICS</span>
      <span>SI units · Deterministic simulation · Built for inquiry</span>
    </footer>
  </div>;
}
