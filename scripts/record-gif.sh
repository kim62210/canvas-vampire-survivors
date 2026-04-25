#!/usr/bin/env bash
# scripts/record-gif.sh
#
# Record a short GIF of the running game by driving headless Chromium with the
# `--screenshot` flag on a loop, then stitch the frames into an animated GIF
# with ffmpeg. Contributors can drop the produced file into docs/screenshots/
# and link it from the README.
#
# Requirements (not installed by this script):
#   - ffmpeg           (brew install ffmpeg / apt-get install ffmpeg)
#   - Google Chrome or Chromium with headless support
#
# Usage:
#   ./scripts/record-gif.sh [duration_seconds] [fps] [width]
#   # defaults: duration=8 fps=15 width=720
#
# The script assumes `npm start` is already serving the game at
# http://localhost:3000 (start it in another terminal). It does NOT start
# Chrome for you automatically on CI because a) it'd pull in chromium and
# b) a real-browser capture is only interesting on a dev machine.

set -euo pipefail

DURATION="${1:-8}"
FPS="${2:-15}"
WIDTH="${3:-720}"
URL="${URL:-http://localhost:3000/}"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/docs/screenshots"
TMP_DIR="$(mktemp -d -t vs-gif-XXXXXX)"
OUTPUT="${OUT_DIR}/demo.gif"
PALETTE="${TMP_DIR}/palette.png"
FRAMES="${TMP_DIR}/frame_%04d.png"

# Resolve a Chrome binary.
CHROME_BIN=""
for candidate in \
    "${CHROME:-}" \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "$(command -v google-chrome 2>/dev/null || true)" \
    "$(command -v chromium 2>/dev/null || true)" \
    "$(command -v chromium-browser 2>/dev/null || true)"; do
    if [[ -n "$candidate" && -x "$candidate" ]]; then
        CHROME_BIN="$candidate"
        break
    fi
done

if [[ -z "$CHROME_BIN" ]]; then
    echo "error: could not find a headless Chrome binary." >&2
    echo "       set CHROME=/path/to/chrome and retry." >&2
    exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "error: ffmpeg not on PATH (brew install ffmpeg / apt-get install ffmpeg)" >&2
    exit 1
fi

# Sanity-check the dev server is up.
if ! curl -sIf "$URL" >/dev/null; then
    echo "error: $URL is not responding — run \`npm start\` first." >&2
    exit 1
fi

echo "==> capturing ${DURATION}s @ ${FPS} fps to ${TMP_DIR}"
TOTAL_FRAMES=$((DURATION * FPS))
INTERVAL_MS=$((1000 / FPS))

# Strategy: launch Chromium once in --remote-debugging-port mode would be
# cleaner, but that requires a helper JS client. To stay dependency-free we
# fire one --screenshot invocation per frame. This is slower than a real
# recorder but robust and works on any Chrome build.
for i in $(seq -f "%04g" 1 "$TOTAL_FRAMES"); do
    "$CHROME_BIN" \
        --headless=new \
        --disable-gpu \
        --hide-scrollbars \
        --window-size=1200,800 \
        --virtual-time-budget=$((i * INTERVAL_MS)) \
        --screenshot="${TMP_DIR}/frame_${i}.png" \
        "$URL" \
        >/dev/null 2>&1
done

echo "==> generating palette"
ffmpeg -y -framerate "$FPS" -i "$FRAMES" \
    -vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,palettegen=stats_mode=diff" \
    "$PALETTE" >/dev/null 2>&1

echo "==> encoding GIF -> $OUTPUT"
mkdir -p "$OUT_DIR"
ffmpeg -y -framerate "$FPS" -i "$FRAMES" -i "$PALETTE" \
    -filter_complex "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
    "$OUTPUT" >/dev/null 2>&1

SIZE_BYTES=$(wc -c <"$OUTPUT" | tr -d ' ')
SIZE_KB=$((SIZE_BYTES / 1024))
echo "==> wrote $OUTPUT (${SIZE_KB} KB, ${TOTAL_FRAMES} frames)"

rm -rf "$TMP_DIR"

if (( SIZE_KB > 5120 )); then
    echo "warning: gif is larger than 5 MB, consider lowering --fps or --width" >&2
fi
