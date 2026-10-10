import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Paramyra — Mathematics Comes Alive", template: "%s | Paramyra" },
  description: "Explore mathematical visualizations, experiment with live parameters, and create your own scenes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <nav className="shell nav" aria-label="Main navigation">
            <Link href="/" className="brand"><span className="brand-icon" aria-hidden="true" />Paramyra</Link>
            <div className="navlinks">
              <Link href="/explore">Explore</Link>
              <Link href="/playground">Playground</Link>
              <Link href="/studio">Studio</Link>
            </div>
          </nav>
        </header>
        <main>{children}</main>
        <footer><div className="shell">Paramyra · Explore. Simulate. Create. · Open-source mathematics.</div></footer>
      </body>
    </html>
  );
}
