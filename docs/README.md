# docs/

This folder holds media and supplementary documentation that the main README
references but that does not need to live at the project root.

## Expected files

| File               | Purpose                                                |
| ------------------ | ------------------------------------------------------ |
| `screenshot.png`   | Primary gameplay screenshot shown in the root README.  |
| `screenshot-*.png` | Additional screenshots (e.g. boss, upgrade menu, HUD). |
| `demo.gif`         | Short looping capture, ideally under 5 MB.             |
| `architecture.svg` | Rendered version of the Mermaid diagram in the README. |

## Contributing a screenshot

1. Run the game at a 16:9 viewport (e.g. 1280x720 or 1920x1080).
2. Capture a frame that shows gameplay with several enemies and the HUD visible.
3. Export as PNG, keep it under ~500 KB where possible (use `pngquant` or similar).
4. Save it as `docs/screenshot.png` and open a PR.

If you are contributing a GIF, keep it short (<6 seconds, <5 MB). Larger
captures should be linked to an external host rather than committed.

## Licensing

Media committed here falls under the same MIT licence as the rest of the
repository unless explicitly noted otherwise in the file's neighbouring
`*.LICENSE` file.
