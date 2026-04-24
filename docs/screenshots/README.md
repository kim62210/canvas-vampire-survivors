# Screenshots

This folder stores PNG screenshots referenced by the root `README.md`. Files
listed below are the canonical names — if you contribute a capture, please name
it accordingly so the README link does not break.

| File               | What it shows                                    |
| ------------------ | ------------------------------------------------ |
| `gameplay-1.png`   | Early-game: hero with whip, a few zombies/bats.  |
| `gameplay-2.png`   | Mid-game: 3-4 weapons firing, HUD chips visible. |
| `gameplay-3.png`   | Late-game: dense swarm, evolved orbit halo.      |
| `boss-fight.png`   | Boss banner up, Reaper or Void Lord on screen.   |
| `level-up.png`     | Level-up overlay with three upgrade choices.     |
| `achievements.png` | Achievement gallery screen.                      |

Target resolution: **1200 × 800** (the game's native canvas size). Larger
captures will be scaled down by the README; smaller ones look mushy.

## How to grab a screenshot

The game renders to a single `<canvas id="gameCanvas">`, so you can capture a
clean frame directly from the canvas — no OS screenshot tool, no HUD chrome,
no scaling artefacts.

### One-shot bookmarklet

Copy the single-line snippet below verbatim, create a new bookmark in your
browser, paste it into the **URL** field (not the title), and save. Click the
bookmark while the game is running and the PNG downloads with the canonical
filename — edit `download` first if you need a different name.

```text
javascript:(()=>{const c=document.getElementById('gameCanvas');if(!c)return alert('No canvas');c.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='gameplay-1.png';a.click();},'image/png');})();
```

Pretty-printed for review (do **not** drag this into a bookmark — bookmarklets
must be a single line):

```javascript
javascript: (() => {
    const c = document.getElementById('gameCanvas');
    if (!c) return alert('No canvas found');
    c.toBlob((b) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = 'gameplay-1.png';
        a.click();
    }, 'image/png');
})();
```

### From DevTools

```javascript
document.getElementById('gameCanvas').toBlob((b) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'boss-fight.png';
    a.click();
}, 'image/png');
```

### Tips for a good capture

- Pause the game (`Esc`) just before clicking the bookmarklet — but the pause
  overlay is a DOM element and **will not** appear on the canvas, so timing is
  the only thing you control.
- Press `,` (settings) → enable "Show FPS" off, "Reduced motion" off, "High
  contrast" off, so the capture matches what most players see.
- For the boss-fight shot, wait until the boss banner is up (5:00 / 10:00).
- For the level-up shot, take a desktop screenshot instead — the level-up menu
  is a DOM overlay rather than a canvas frame.

### Compression

Run captures through `pngquant --quality=70-90 file.png --ext .png --force`
before committing. Aim for **< 500 KB per image** so the README stays light.

## Licence

Captures committed here fall under the project's MIT licence unless a
neighbouring `<filename>.LICENSE` file says otherwise.
