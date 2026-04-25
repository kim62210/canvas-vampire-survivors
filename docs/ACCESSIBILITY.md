# Accessibility

Survivor is designed to be playable by as many people as possible. This page
lists every concrete a11y feature the game ships with today, plus the gaps we
are deliberately aware of but have not fixed yet.

If you hit a blocker that isn't listed below, please
[open an issue](https://github.com/ricardo-foundry/canvas-vampire-survivors/issues/new)
— accessibility regressions are treated as bugs, not feature requests.

## Supported features

### Keyboard

- **Full menu navigation** via `Tab` / `Shift+Tab`. Every button and
  level-up card is keyboard reachable.
- **Activation** with `Enter` or `Space` on any focused control.
- **Arrow-key navigation** inside the level-up menu: `↑`/`↓` (or `←`/`→`)
  moves focus between upgrade options, wrapping at the ends.
- **Pause** is bound to both `Esc` and `P`.
- **Movement** accepts both WASD and the arrow keys.
- **Language toggle** via `L`.

### Focus handling

- Visible focus ring on every interactive element via `:focus-visible` —
  pointer users see the usual clean UI, keyboard users get a thick amber
  outline with a soft glow.
- Focus is automatically placed on the first upgrade card when the level-up
  menu opens, so the flow doesn't break for keyboard-only players.
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on the start,
  pause, level-up and game-over overlays so assistive tech announces them
  as modals and exposes the title.

### Screen reader support

- A visually hidden live region (see `#a11yLiveRegion` in `index.html`) with
  `role="status"` and `aria-live="polite"` mirrors gameplay events so screen
  readers announce them without cluttering the visual HUD. Events announced:
    - Boss incoming — e.g. `"Boss incoming: Reaper"`
    - Boss defeated — e.g. `"reaper defeated"`
    - Level up — e.g. `"Level 7! Choose an upgrade."`
    - Achievement unlocked — e.g. `"Achievement unlocked: Centurion. Defeat 100 foes in a single run."`
- Every menu title has an `id` referenced by `aria-labelledby`.
- Upgrade cards carry an `aria-label` with the full name + description +
  evolution target, so the SR user hears the whole offer in one announce.
- Boss banner keeps its existing `aria-live="polite"` for visual-UI parity.

### Motion sensitivity

- `prefers-reduced-motion: reduce` turns off:
    - all CSS transitions and hover transforms,
    - floating damage numbers,
    - screen shake (even if "screen shake" is enabled in the settings),
    - heavy particle bursts (capped to ≤2 particles per event).
- A user-level `Reduced motion` toggle in the Settings panel opts into the
  same behaviour regardless of the OS preference.

### Visual contrast

- `prefers-contrast: more` widens the palette, thickens borders on menus
  and weapon chips, and solidifies overlay backdrops for legibility.
- `forced-colors: active` (Windows High Contrast) maps interactive elements
  onto the system's `ButtonBorder`/`Highlight` tokens with
  `forced-color-adjust: none` on the buttons so their intent is preserved.
- A bespoke **Colorblind mode** toggle remains available in the Settings
  panel for players whose contrast preference isn't expressed at the OS
  level. It widens the hue distance between HP, XP and accent colours.

### Text scaling

- HUD elements shrink gracefully on narrow viewports (see the
  `@media (max-width: 768px)` block in `styles.css`).
- Overlay cards have a `max-height: 92vh` with `overflow-y: auto` so they
  always scroll rather than clip.

### Touch / mobile

- Virtual joystick appears automatically on `hover: none, pointer: coarse`
  devices.
- `touch-action: none` and `overscroll-behavior: none` on the body prevent
  accidental pinch-zoom and pull-to-refresh during play.
- `viewport-fit=cover` plus `svh`/`dvh` units on the container fix the iOS
  Safari 100vh overflow issue around the dynamic address bar.

### Localisation

- English and 简体中文 ship in the box. All visible strings flow through
  `src/i18n.js`, so adding a new locale is a single PR.
- The HTML `lang` attribute is `en`; language changes at runtime don't
  currently update it (see "Known gaps" below).

## Known gaps (honest list)

- **Gameplay is a real-time action game.** Some SR users will not be able
  to react fast enough to dodge projectiles; there is currently no "slow
  mode" or "auto-dodge" option. Contributors with ideas welcome.
- The live region only fires for high-signal events. Ambient enemy deaths
  and damage numbers are intentionally NOT announced — the chatter would
  be overwhelming. A "verbose narrator" toggle would be a nice follow-up.
- The canvas itself has `aria-label="Game canvas"` but does not expose a
  textual snapshot. Blind users must rely on the live region + audio
  cues. A WebAudio-only mode (drop the canvas entirely) is a long-term
  idea.
- When the player changes language at runtime, the `<html lang>` attribute
  is NOT updated. The `data-i18n` text itself flips correctly.
- The upgrade menu closes when a selection is made, so `Esc` cancel is
  not wired up. Cancelling a forced level-up is a design decision: we
  don't want players skipping upgrades, only choosing between them.

## Tested with

- macOS VoiceOver + Safari 17.
- NVDA 2024.1 + Firefox 123 on Windows 11.
- Keyboard-only navigation (no mouse) in every shipped overlay.
- Chrome DevTools forced-colors emulation.
- macOS "Reduce motion" system preference.

## Reporting issues

Label your issue `a11y` and include:

- Screen reader + browser versions, or the exact assistive tech setup.
- Whether OS-level `prefers-reduced-motion` / `prefers-contrast` are on.
- A short repro (keystrokes, or the exact menu path you got stuck on).
