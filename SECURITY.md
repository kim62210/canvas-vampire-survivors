# Security Policy

We take security seriously, even for a browser game. This document describes
how to report a vulnerability and what you can expect from us in return.

## Supported versions

Only the latest minor release line receives security fixes.

| Version | Supported |
| ------- | --------- |
| 2.x     | Yes       |
| 1.x     | No        |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Preferred channel: use GitHub's private vulnerability reporting form for this
repository:

- <https://github.com/ricardo-foundry/canvas-vampire-survivors/security/advisories/new>

If that is not available to you, contact the maintainer listed in
`package.json` by email, with `[SECURITY]` in the subject.

When reporting, please include:

- A clear description of the issue and its impact.
- Steps to reproduce, including the affected commit hash or release tag.
- Any proof-of-concept code, payloads, or screenshots.
- Your name or handle for credit in the advisory (optional).

## What to expect

- **Acknowledgement** within 72 hours.
- **Initial assessment** within 7 days, including a severity estimate.
- **Fix or mitigation** for high-severity issues within 30 days, subject to
  complexity.
- A coordinated disclosure once a patch is available. We are happy to credit
  reporters by name or handle in the release notes.

## Scope

The following classes of issues are in scope:

- XSS or script injection via savefile / `localStorage` import.
- Prototype pollution or sandbox escape in the runtime bundle.
- Dependency vulnerabilities in our declared `devDependencies`.
- Supply-chain issues affecting the build or release workflow.

Out of scope:

- Cheating, save-editing, or modifying game balance on your own machine.
- Missing security headers on third-party hosting that you control.
- Vulnerabilities in browsers or operating systems themselves.

## Safe harbour

We will not pursue legal action against researchers acting in good faith who:

- Make a reasonable effort to avoid privacy violations, data destruction, or
  service interruption.
- Only interact with accounts they own or have explicit permission to access.
- Give us reasonable time to address the issue before public disclosure.

Thank you for helping keep the project and its players safe.
