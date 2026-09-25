---
name: brew-buddy-design
description: Use this skill to generate well-branded interfaces and assets for Brew Buddy, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the readme.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Kurz für Brew Buddy:
- Alles auf Deutsch, Du-Form, deutsche Zahlen („1:2,0"), keine Emoji.
- Farben nur über `var(--color-*)` aus `styles.css`; drei Darstellungen: `:root` Milchkaffee, `html.dark` Espresso, `html.organic` Organic. Keine neuen Farben, keine Verläufe.
- Überschriften mit Klasse `.titel`, Zahlen mit `.tnum`, Trefferflächen 44 px, Zielbreite 375 px.
- Icons: eigene Strichzeichnungen (24er Raster, Strich 1,8, keine Füllung) aus `assets/icons/`.
- Nie mehr als eine Empfehlung pro Bildschirm.
