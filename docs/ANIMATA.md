# Animata integration policy

Reference: https://github.com/codse/animata (MIT License, Copyright (c) Animata)

Animata is a copy-and-paste collection of React UI animations, **not** a renderer or a package to install as a whole. Paramyra will adopt individual effects only after checking their dependencies, keyboard/focus behavior, reduced-motion fallback, bundle impact and Tailwind v4 compatibility.

Allowed surfaces: hero, scene cards, navigation, inspector microinteractions.

Not allowed: Canvas math loop, physics stepping, core scenes, required navigation interactions.

The foundation currently contains no copied Animata components. When adapted code is brought in, retain its source attribution and the required MIT license notice.
