# Workspace Instructions

- Use Playwright for UI verification when a real browser check is necessary, but do not treat it as required after every UI-affecting change.
- Follow the in-game palette for UI work: use only the current 4 CGA colors already present in the game screens, and do not introduce additional colors.
- Do not simulate disabled, inactive, layered, or modal states with opacity, alpha blending, translucent backdrops, softened shades, or any other extra-tone effect. Stay within the existing 4 CGA colors and differentiate states with layout, borders, dashes, inversion, copy, or motion instead.
- When changing source code, add or update high-quality English comments in the same patch so the comments stay aligned with the implementation. Prefer comments that explain module responsibilities, data flow, invariants, and non-obvious logic well enough that a new engineer can reconstruct how the app works from the source.
