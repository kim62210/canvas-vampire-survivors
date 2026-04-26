# Customization Guide

The default build draws everything with primitive Canvas calls (`ctx.arc`, `fillRect`, …) so the project ships with **zero image assets**. The downside is that there's nothing to "swap"; the upside is that you can layer in PNG/SVG/WEBP one entity at a time without forking `entities.js`.

This guide covers the two most common customisations:

1. Adding or replacing a UI language
2. Replacing the procedural visuals with sprite art

---

## 1. Adding a language (i18n)

All translatable strings live in [`src/i18n.js`](../src/i18n.js) under the `STRINGS` object. The lookup order is:

```
selected locale → English → raw key (so a typo never crashes)
```

Three locales ship today: `en`, `zh` (简体中文), and `ko` (한국어). To add another:

1. Open `src/i18n.js`.
2. Copy the `en` block, paste it as a new top-level key (`STRINGS.<code>`).
3. Translate every value. Keys must stay identical to the English block.
4. Add an entry in `HTML_LANG` so the `<html lang="…">` attribute and `:lang(…)` selectors stay correct. The value follows BCP-47 (e.g. `'ja'`, `'fr'`, `'pt-BR'`).
5. The Settings panel reads `availableLocales()` so the new option appears automatically — no UI edit needed.

`detectLocale()` matches the visitor's `navigator.languages` against the shipped locales and returns the best fit (falling back to English). Wire it into the boot sequence with `setLocale(saved.locale ?? detectLocale())`.

---

## 2. Replacing visuals with sprite assets

The renderer is centralised in [`src/assets.js`](../src/assets.js). Each entity's `render()` method tries `drawSprite(ctx, key, …)` first; when no sprite is registered, the call returns `false` and the original procedural shape is drawn. This means partial swaps work — register only the player sprite, everything else keeps its geometric look.

### 2.1 Sprite key conventions

| Key               | Drawn for             | Honours `rotate` |
| ----------------- | --------------------- | ---------------- |
| `player`          | Hero body             | no               |
| `enemy:<id>`      | Each enemy by data id | no               |
| `projectile:<id>` | Player weapon shot    | yes              |
| `enemyProjectile` | Enemy bullet          | no               |
| `orbitShard`      | Orbiter weapon shard  | no               |
| `mine`            | Dropped mine core     | no               |
| `expOrb`          | Experience pickup     | no               |

Enemy ids come straight from `data.js` (`bat`, `skeleton`, `zombie`, …). Projectile ids match the weapon ids (`knife`, `magic_wand`, `axe`, `cross`, `fire_wand`, …).

### 2.2 Quick start

Drop a `<script type="module">` tag into `index.html` **before** the `src/main.js` import:

```html
<script type="module">
    import { registerSprites } from './src/assets.js';

    registerSprites({
        player: { src: 'assets/player.png', size: 18 },
        'enemy:bat': { src: 'assets/bat.png', size: 14 },
        'enemy:skeleton': { src: 'assets/skeleton.png', size: 16 },
        'projectile:knife': { src: 'assets/knife.png', size: 12, rotate: true },
        expOrb: 'assets/exp.png' // shorthand: `<key>: <src>` uses defaults
    });
</script>
```

Reload — the registered keys now use bitmaps, everything else still draws as a shape.

### 2.3 API reference

```js
registerSprite(key, src, opts);
registerSprites(map);     // bulk; values are string | { src, ...opts }
hasSprite(key) → boolean;
drawSprite(ctx, key, x, y, overrides) → boolean;
clearSprites();
listSprites() → string[];
```

Options accepted at registration time:

| Option      | Default       | Notes                                                |
| ----------- | ------------- | ---------------------------------------------------- |
| `size`      | half of image | Target half-size in world px (radius).               |
| `rotate`    | `false`       | Apply the entity's `angle` in radians (projectiles). |
| `scale`     | `1`           | Uniform multiplier.                                  |
| `offset`    | `[0, 0]`      | Pixel offset before drawing.                         |
| `smoothing` | `true`        | Set to `false` for crisp pixel art.                  |

Per-call `overrides` accepted by `drawSprite(...)`:

| Override | Notes                                                                              |
| -------- | ---------------------------------------------------------------------------------- |
| `size`   | Overrides registration size.                                                       |
| `angle`  | Radians; only honoured when registered with `rotate: true`.                        |
| `alpha`  | Multiplied with the current `globalAlpha`.                                         |
| `tint`   | CSS colour applied as `source-atop` overlay (used for hit flashes / freeze tints). |

### 2.4 Recommended dimensions

The default geometric sizes (in world pixels):

| Entity       | Size (radius)                        |
| ------------ | ------------------------------------ |
| Player       | `CONFIG.PLAYER_SIZE` (18 by default) |
| Common enemy | 12–16                                |
| Boss         | 64                                   |
| Projectile   | 4–10                                 |
| Exp orb      | 4 + log(value)                       |

Match those if you want sprites to feel like a 1:1 swap. Pixel-art assets typically look best at 2× scale with `smoothing: false`.

### 2.5 Performance notes

- `_renderEnemies()` in `main.js` keeps a fast-path bitmap cache for non-boss, non-flashing enemies. Registered sprites bypass that cache and call `drawSprite()` directly — that's still one `drawImage` per enemy, so no measurable cost up to ~600 simultaneous enemies on a mid-tier laptop.
- Bosses and flashing/shielded enemies always go through the full per-frame path so HP bars, shield rings and crowns stay in sync.
- Sprite art is loaded asynchronously. Before an image finishes decoding, `hasSprite()` returns `false` and the procedural shape is drawn — so the first paint is never blank.

### 2.6 Asset licensing

The defaults are zero-asset, so you start with no licensing obligations. When you bring in art, watch for:

- Pixel-art packs from Kenney (CC0), 0x72 (CC-BY) or OpenGameArt (mixed).
- AI-generated art: check the model's licence — some require attribution.
- Sounds are procedurally generated by `src/audio.js` (Web Audio API), so no audio assets are needed unless you want to override `audio.js` itself.

A safe, immediate option: drop in a Kenney CC0 pack and register matching keys. The procedural fallback covers anything you forget to register.

---

## 3. Replacing the audio engine

`src/audio.js` synthesises every SFX procedurally (Web Audio oscillators / noise buffers). To use sample-based audio, replace the methods on `AudioEngine` (e.g. `pickup()`, `explosion()`) with `Audio` instances backed by your own files. The file is small (~250 lines) and self-contained.

---

## 4. Re-skinning the UI

CSS lives in [`styles.css`](../styles.css). The colour palette is centralised at the top of the file — change the gradient stops and accent colours there to retheme without touching markup.
