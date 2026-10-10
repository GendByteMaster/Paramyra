import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

// Interaction adapted from https://github.com/codse/animata/blob/main/animata/button/arrow-button.tsx
// MIT-licensed (Copyright (c) Animata). See THIRD_PARTY_NOTICES.md.
export function AnimatedArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="btn primary animata-arrow-link">
    <span>{children}</span>
    <ArrowRight className="animata-arrow-icon" size={17} aria-hidden="true" />
  </Link>;
}
