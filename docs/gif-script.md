# Recording a GIF / video demo

The README's hero area is most arresting when it shows the game in motion.
This page collects the recipes we use; pick whichever fits your toolchain.

## What "good" looks like

- **6–10 seconds** of footage. Loop seamlessly.
- **At most 5 MB** so it loads on slow connections and inside a README preview.
- Frame the player in the centre, with at least one weapon firing and a swarm
  of enemies on screen.
- Capture the **canvas region only** (1200 × 800 native; downscale to 800 × 533
  or 600 × 400 for the README).

## Recipe A — `ffmpeg` (best quality, smallest file)

Record the canvas region with whatever screen recorder your OS provides
(QuickTime on macOS, Game Bar on Windows, OBS anywhere). Save as `raw.mp4`,
then convert:

```bash
# 1. Generate a palette tuned to the actual colours in the clip.
ffmpeg -y -i raw.mp4 -vf "fps=18,scale=720:-1:flags=lanczos,palettegen=stats_mode=diff" palette.png

# 2. Use the palette to produce a tight, dithered GIF.
ffmpeg -y -i raw.mp4 -i palette.png \
       -filter_complex "fps=18,scale=720:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
       docs/screenshots/demo.gif
```

Tips:

- Drop fps to `15` if the file is still too big.
- `scale=540:-1` gives a noticeably smaller file with little perceived loss.
- For a clip that loops, slice with `-ss 0 -t 8` to keep only the chosen
  window, and ensure the first and last frame match.

## Recipe B — `gifski` (Mac / Cargo, very high visual quality)

```bash
# Extract frames first.
ffmpeg -i raw.mp4 -vf "fps=20,scale=720:-1:flags=lanczos" frame_%04d.png
gifski --fps 20 --quality 80 -o docs/screenshots/demo.gif frame_*.png
rm frame_*.png
```

## Recipe C — Browser-only (no install)

Open the game, then paste this in the DevTools console to capture the
**canvas itself** at a fixed framerate to a `WebM` blob. Convert to GIF later
with one of the recipes above.

```javascript
const c = document.getElementById('gameCanvas');
const stream = c.captureStream(30);
const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
const chunks = [];
rec.ondataavailable = (e) => chunks.push(e.data);
rec.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'demo.webm';
    a.click();
};
rec.start();
setTimeout(() => rec.stop(), 8000); // 8 seconds
```

The WebM is roughly 5× smaller than a GIF of the same content, so consider
keeping the WebM and linking to it directly from the README via an
`<video>` tag if your hosting allows it.

## Recipe D — `asciinema` (terminal-only logs, not gameplay)

Not used for the game itself, but handy for build/CI output. Install via
`brew install asciinema` or your package manager.

```bash
asciinema rec build.cast
# (run npm start, etc.)
asciinema upload build.cast    # or render to gif via agg
```

## Where to commit

- Final GIF or WebM goes into `docs/screenshots/` with the name `demo.gif`
  (or `demo.webm`) so the root README link works.
- Anything > 5 MB should be linked from an external host (e.g. an asset
  release on the GitHub repo) rather than committed.
