import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Orbit } from "lucide-react";
import "./globals.css";
import "./studio-workspace.css";
import "./studio-shell.css";
import "./studio-density.css";

export const metadata: Metadata = {
  title: { default: "Paramyra — Mathematics Comes Alive", template: "%s | Paramyra" },
  description: "Explore mathematical visualizations, experiment with live parameters, and create your own scenes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <div className="site-atmosphere" aria-hidden="true" />
        <header className="topbar">
          <nav className="shell nav" aria-label="Main navigation">
            <Link href="/" className="brand" aria-label="Paramyra home">
              <span className="brand-icon" aria-hidden="true"><Orbit size={19}/></span>
              <span>Paramyra<span className="brand-period">.</span></span>
              <span className="brand-tag">MATH STUDIO</span>
            </Link>
            <div className="navlinks">
              <Link href="/explore">Explore</Link>
              <Link href="/playground">Playground</Link>
              <Link href="/studio">Studio</Link>
            </div>
            <Link href="/studio" className="nav-cta">Launch Studio <ArrowUpRight size={14} aria-hidden="true"/></Link>
          </nav>
        </header>
        <main id="main-content">{children}</main>
        <footer><div className="shell footer-content"><span className="brand-small">◇ PARAMYRA</span><span>Mathematics, in motion. Made to explore.</span><span>Explore · Simulate · Create</span></div></footer>
      </body>
    </html>
  );
}
