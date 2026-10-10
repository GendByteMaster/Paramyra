# Animata integration policy

Reference: https://github.com/codse/animata (MIT License, Copyright (c) Animata)

Animata is a copy-and-paste collection of React UI animations, **not** a renderer or a package to install as a whole. Paramyra adopts individual effects only after checking their dependencies, keyboard/focus behavior, reduced-motion fallback, bundle impact and Tailwind v4 compatibility.

Implemented in foundation:
- AnimatedArrowLink, adapted from Animata's arrow-button interaction for a Next.js Link. See [third-party notices](../THIRD_PARTY_NOTICES.md).

Allowed surfaces: hero, scene cards, navigation, inspector microinteractions.

Not allowed: Canvas math loop, physics stepping, core scenes, required navigation interactions.

The mathematical engine does not import Animata.
