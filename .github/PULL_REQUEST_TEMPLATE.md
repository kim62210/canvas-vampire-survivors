<!--
Thanks for opening a pull request! Please fill out this template so reviewers
can merge quickly. Keep PRs focused — one concern per PR is much easier to review.
-->

## Summary

<!-- One or two sentences describing what this PR does and why. -->

## Type of change

- [ ] feat — new gameplay / UI feature
- [ ] fix — bug fix
- [ ] perf — performance improvement
- [ ] refactor — internal change, no behaviour change
- [ ] docs — README / comments / wiki
- [ ] chore — tooling, deps, CI
- [ ] test — test-only changes

## Related issues

<!-- e.g. Closes #123, Refs #456 -->

## How was this tested?

<!-- Browsers / OS / input devices exercised. Include framerate throttling if relevant. -->

- [ ] Manually playtested in Chrome / Firefox / Safari
- [ ] Ran at 30 fps (DevTools CPU throttle) and at native refresh rate
- [ ] Tested with keyboard, touch joystick, and/or gamepad where applicable

## Checklist

- [ ] `npm run lint` passes
- [ ] `npm run format:check` passes
- [ ] `CHANGELOG.md` updated under `[Unreleased]` (if user-visible)
- [ ] New UI strings added to `src/i18n.js` in English and 简体中文
- [ ] Gameplay code uses delta time (no raw per-frame increments)
- [ ] No new runtime dependencies introduced

## Screenshots / clips

<!-- Drag files here. Before/after clips are very welcome for gameplay tweaks. -->

## Notes for reviewers

<!-- Anything that's non-obvious: trade-offs, follow-ups, known limitations. -->
