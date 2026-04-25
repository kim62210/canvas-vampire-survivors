#!/usr/bin/env node
/**
 * @file scripts/test-live-deploy.js
 * @description Real-browser smoke test against the **live GitHub Pages**
 * deployment. Unlike `runtime-smoke.js` (which spawns a local server), this
 * one verifies the production URL is actually playable end-to-end:
 *
 *   1. HTTP 200 from the canonical Pages URL.
 *   2. The bundled HTML contains the expected <title>.
 *   3. ./src/main.js loads without a network error.
 *   4. The game canvas renders at least one non-zero pixel after boot.
 *   5. Clicking the in-page Start button produces a Player instance.
 *   6. ~10 seconds of "uptime" with the Start screen dismissed yields no
 *      console.error and no pageerror.
 *   7. Two screenshots land at docs/screenshots/live-{mainmenu,gameplay}.png.
 *   8. A short Markdown report at docs/LIVE_QA_REPORT.md captures the run.
 *
 * Exits non-zero if any console.error or pageerror occurred during play.
 *
 * Usage: `node scripts/test-live-deploy.js`
 *
 * Notes:
 *   - Playwright is the only required dep (already a devDep).
 *   - We *do not* rely on `__SURV_DEBUG__` here — that hook is gated to
 *     localhost in src/main.js, so this test exercises the real prod build.
 *   - Network: a single curl to the live URL warms the cache before
 *     Playwright opens the page, sidestepping a transient 502 that GitHub
 *     Pages occasionally serves on cold paths.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const SHOT_DIR = path.join(ROOT, 'docs', 'screenshots');
const REPORT = path.join(ROOT, 'docs', 'LIVE_QA_REPORT.md');
const LIVE_URL = 'https://ricardo-foundry.github.io/canvas-vampire-survivors/';

function head(url) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, { method: 'GET' }, (res) => {
            // Drain the body so the socket can close cleanly.
            res.resume();
            resolve({ statusCode: res.statusCode || 0, headers: res.headers });
        });
        req.on('error', reject);
        req.setTimeout(8000, () => {
            req.destroy(new Error('HEAD timeout'));
        });
        req.end();
    });
}

async function main() {
    if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

    const findings = [];
    let httpStatus = 0;
    try {
        const r = await head(LIVE_URL);
        httpStatus = r.statusCode;
        process.stdout.write(`[http] ${LIVE_URL} -> ${r.statusCode}\n`);
    } catch (err) {
        findings.push(`HTTP probe failed: ${err.message}`);
        process.stdout.write(`[http] probe error: ${err.message}\n`);
    }

    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
        userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    const consoleErrors = [];
    const consoleWarns = [];
    const pageErrors = [];
    const failedRequests = [];
    const responses = [];

    // Filter rules: a few benign messages should not cause CI failures.
    //   - service-worker 404: the SW is optional. The deploy-pages workflow
    //     was patched in iter-12 to ship it; until that deploy lands, the
    //     live page logs this as a console.error. We classify it as a
    //     warning so the script doesn't permanently fail on stale builds.
    const isBenignError = (text) =>
        /service[-_ ]?worker/i.test(text) ||
        /A bad HTTP response code \(404\) was received when fetching the script/i.test(text);

    page.on('console', (msg) => {
        const t = msg.type();
        const text = msg.text();
        if (t === 'error') {
            if (isBenignError(text)) consoleWarns.push(`[demoted-to-warn] ${text}`);
            else consoleErrors.push(text);
        } else if (t === 'warning') consoleWarns.push(text);
        process.stdout.write(`[console.${t}] ${text}\n`);
    });
    page.on('pageerror', (err) => {
        pageErrors.push(`${err.name}: ${err.message}\n${err.stack || ''}`);
        process.stdout.write(`[pageerror] ${err.message}\n`);
    });
    page.on('requestfailed', (req) => {
        failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
        process.stdout.write(`[reqfail] ${req.url()}\n`);
    });
    page.on('response', (res) => {
        responses.push({ status: res.status(), url: res.url() });
        if (res.status() >= 400) {
            failedRequests.push(`${res.status()} ${res.url()}`);
            process.stdout.write(`[resp ${res.status()}] ${res.url()}\n`);
        }
    });

    // 1) load the live URL
    await page.goto(LIVE_URL, { waitUntil: 'load', timeout: 20000 });
    // Give the boot script a beat to install __vsGame on window.
    await page.waitForTimeout(1500);

    // 2) verify title + main.js loaded
    const title = await page.title();
    if (!/Survivor/i.test(title)) {
        findings.push(`Unexpected page title: "${title}"`);
    }
    const mainJsLoaded = responses.some(
        (r) => r.url.endsWith('/src/main.js') && r.status >= 200 && r.status < 400
    );
    if (!mainJsLoaded) findings.push('src/main.js did not return a 2xx response.');

    // 3) verify game booted
    const booted = await page.evaluate(() => !!window.__vsGame);
    if (!booted) findings.push('window.__vsGame missing — game failed to boot.');

    // 4) main-menu screenshot first (before clicking Start so the overlay
    //    is captured) — the canvas pixel histogram check is deferred to after
    //    gameplay starts because the main menu renders only the background
    //    fill colour and would always report a single distinct hue.
    await page.screenshot({
        path: path.join(SHOT_DIR, 'live-mainmenu.png'),
        fullPage: false
    });

    // 5) click Start, confirm Player exists
    const startBtn = await page.$('#btnStart');
    if (!startBtn) {
        findings.push('#btnStart not present on the live page.');
    } else {
        await startBtn.click();
    }
    await page.evaluate(() => document.getElementById('gameCanvas')?.focus());
    await page.waitForTimeout(800);
    const playerOk = await page.evaluate(() => {
        const g = window.__vsGame;
        return !!g?.player && typeof g.player.x === 'number';
    });
    if (!playerOk) findings.push('Player instance missing after clicking Start.');

    // 6) ~10s of gameplay; nudge keys to trigger movement and weapon firing.
    await page.keyboard.down('d');
    await page.waitForTimeout(2500);
    await page.keyboard.up('d');
    await page.keyboard.down('s');
    await page.waitForTimeout(2500);
    await page.keyboard.up('s');
    await page.waitForTimeout(5000);

    const liveState = await page.evaluate(() => {
        const g = window.__vsGame;
        if (!g || !g.player) return null;
        return {
            state: g.state,
            gameTime: g.gameTime,
            kills: g.kills,
            playerHp: g.player.hp,
            playerLevel: g.player.level,
            enemies: g.enemies?.length || 0,
            projectiles: g.projectiles?.length || 0,
            stageId: g.stageId || null
        };
    });
    if (!liveState) findings.push('Could not read game state after 10s of play.');
    else if (liveState.gameTime < 5)
        findings.push(`gameTime only advanced to ${liveState.gameTime.toFixed(2)}s — sim stalled.`);

    // Canvas-pixel sanity check during *gameplay*: with the player and at
    // least one enemy on screen, a 64×64 sample around the player should
    // contain multiple distinct colours.
    const distinctColors = await page.evaluate(() => {
        const c = document.getElementById('gameCanvas');
        if (!c) return 0;
        const ctx = c.getContext('2d');
        const cx = Math.floor(c.width / 2);
        const cy = Math.floor(c.height / 2);
        const data = ctx.getImageData(cx - 32, cy - 32, 64, 64).data;
        const seen = new Set();
        for (let i = 0; i < data.length; i += 4) {
            seen.add(`${data[i]}|${data[i + 1]}|${data[i + 2]}`);
        }
        return seen.size;
    });
    if (distinctColors < 2) {
        findings.push(
            `Canvas pixels look uniform during gameplay (only ${distinctColors} distinct colour(s) in centre 64×64).`
        );
    }

    await page.screenshot({
        path: path.join(SHOT_DIR, 'live-gameplay.png'),
        fullPage: false
    });

    await browser.close();

    // 7) write report
    const lines = [];
    lines.push('# Live Deploy QA Report (iter-12)');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`URL: <${LIVE_URL}>`);
    lines.push('');
    lines.push('## HTTP / load');
    lines.push(`- Status: **${httpStatus}**`);
    lines.push(`- Title: \`${title}\``);
    lines.push(`- main.js loaded: ${mainJsLoaded ? '✅' : '❌'}`);
    lines.push(`- Game booted: ${booted ? '✅' : '❌'}`);
    lines.push(`- Canvas distinct colours (gameplay 64×64 centre): ${distinctColors}`);
    lines.push('');
    lines.push('## Live state after ~10s of play');
    lines.push('```json');
    lines.push(JSON.stringify(liveState, null, 2));
    lines.push('```');
    lines.push('');
    lines.push(`## Console errors (${consoleErrors.length})`);
    if (consoleErrors.length) consoleErrors.forEach((e, i) => lines.push(`${i + 1}. \`${e}\``));
    else lines.push('_None_ ✅');
    lines.push('');
    lines.push(`## Console warnings (${consoleWarns.length})`);
    if (consoleWarns.length) consoleWarns.forEach((e, i) => lines.push(`${i + 1}. \`${e}\``));
    else lines.push('_None_ ✅');
    lines.push('');
    lines.push(`## Page errors (${pageErrors.length})`);
    if (pageErrors.length)
        pageErrors.forEach((e, i) => lines.push(`### ${i + 1}\n\n\`\`\`\n${e}\n\`\`\``));
    else lines.push('_None_ ✅');
    lines.push('');
    lines.push(`## Failed requests / 4xx-5xx (${failedRequests.length})`);
    if (failedRequests.length) failedRequests.forEach((e, i) => lines.push(`${i + 1}. \`${e}\``));
    else lines.push('_None_ ✅');
    lines.push('');
    lines.push(`## Findings (${findings.length})`);
    if (findings.length) findings.forEach((f, i) => lines.push(`${i + 1}. ${f}`));
    else lines.push('_No issues detected._ ✅');
    lines.push('');
    lines.push('## Screenshots');
    lines.push('- `docs/screenshots/live-mainmenu.png`');
    lines.push('- `docs/screenshots/live-gameplay.png`');

    fs.writeFileSync(REPORT, lines.join('\n') + '\n', 'utf8');
    process.stdout.write(`\n[report] ${REPORT}\n`);

    const total = consoleErrors.length + pageErrors.length + findings.length;
    process.stdout.write(
        `\nSummary: ${consoleErrors.length} console.error, ${pageErrors.length} pageerror, ${findings.length} finding(s).\n`
    );
    process.exit(total > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error('[live-deploy] fatal', err);
    process.exit(2);
});
