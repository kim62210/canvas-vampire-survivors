#!/usr/bin/env node
/**
 * @file scripts/runtime-smoke.js
 * @description Real-browser runtime smoke test (Round 9 QA).
 *
 * What it does:
 *   1. Spawns the dev server (`node server.js`) on a free port.
 *   2. Launches headless Chromium via Playwright.
 *   3. Loads the game, captures the main menu PNG.
 *   4. Clicks "Start Run", lets the game run ~10 seconds, captures gameplay PNG.
 *   5. Collects every console.error / console.warn / pageerror / failed
 *      network request and prints them to stdout (and to docs/RUNTIME_QA_REPORT.md).
 *   6. Tears everything down with non-zero exit if any error/pageerror.
 *
 * Usage: `node scripts/runtime-smoke.js`
 *
 * Notes:
 *   - Playwright is a *dev*-only dep (see package.json devDependencies).
 *   - Output PNGs land at docs/screenshots/real-mainmenu.png and
 *     docs/screenshots/real-gameplay.png — these replace the SVG mockups in
 *     README. SVG fallbacks live under docs/screenshots/svg/.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const net = require('net');

const ROOT = path.resolve(__dirname, '..');
const SHOT_DIR = path.join(ROOT, 'docs', 'screenshots');
const REPORT = path.join(ROOT, 'docs', 'RUNTIME_QA_REPORT.md');

// --- Pick a free port to avoid collisions -------------------------------------
function freePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, () => {
            const { port } = srv.address();
            srv.close(() => resolve(port));
        });
    });
}

function waitForServer(url, timeoutMs = 8000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const tick = () => {
            const http = require('http');
            const req = http.get(url, (res) => {
                res.resume();
                if (res.statusCode === 200) return resolve();
                retry();
            });
            req.on('error', retry);
            req.setTimeout(1000, () => {
                req.destroy();
                retry();
            });
        };
        const retry = () => {
            if (Date.now() - start > timeoutMs) return reject(new Error('server timeout'));
            setTimeout(tick, 150);
        };
        tick();
    });
}

async function main() {
    if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

    const port = await freePort();
    const env = { ...process.env, PORT: String(port) };
    const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
        env,
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
    server.stderr.on('data', (d) => process.stderr.write(`[server!] ${d}`));

    const cleanup = (code) => {
        try {
            server.kill('SIGTERM');
        } catch (_) {
            /* ignore */
        }
        if (typeof code === 'number') process.exit(code);
    };
    process.on('SIGINT', () => cleanup(130));
    process.on('SIGTERM', () => cleanup(143));

    const url = `http://localhost:${port}/`;
    await waitForServer(url + 'index.html');

    // Lazy-require so that --help / install paths don't fail without playwright.
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
        // Real-ish user agent so any UA-sniffing branches behave normally.
        userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    const consoleErrors = [];
    const consoleWarns = [];
    const pageErrors = [];
    const failedRequests = [];

    page.on('console', (msg) => {
        const t = msg.type();
        const text = msg.text();
        if (t === 'error') consoleErrors.push(text);
        else if (t === 'warning') consoleWarns.push(text);
        // log everything for visibility
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
        if (res.status() >= 400) {
            failedRequests.push(`${res.status()} ${res.url()}`);
            process.stdout.write(`[resp ${res.status()}] ${res.url()}\n`);
        }
    });

    await page.goto(url, { waitUntil: 'load' });

    // Give the boot script a beat to wire up listeners/UI.
    await page.waitForTimeout(1500);

    // Main menu screenshot (real PNG).
    await page.screenshot({
        path: path.join(SHOT_DIR, 'real-mainmenu.png'),
        fullPage: false
    });
    process.stdout.write('[shot] real-mainmenu.png\n');

    // Click Start Run (button id="btnStart").
    const startBtn = await page.$('#btnStart');
    if (!startBtn) {
        pageErrors.push('Could not find #btnStart button on main menu.');
    } else {
        await startBtn.click();
        process.stdout.write('[click] #btnStart\n');
    }

    // Focus the canvas so keyboard input is delivered to the game.
    await page.evaluate(() => document.getElementById('gameCanvas')?.focus());

    // Move player around (D held briefly, then S held) so enemies actually
    // collide with the whip arc and we get a screenshot with combat in it.
    await page.keyboard.down('d');
    await page.waitForTimeout(2500);
    await page.keyboard.up('d');
    await page.keyboard.down('s');
    await page.waitForTimeout(2500);
    await page.keyboard.up('s');

    // Idle the rest of the 10 s window so wave/spawn logic ticks.
    await page.waitForTimeout(5000);

    // Try to surface live state for the report.
    let liveState = null;
    try {
        liveState = await page.evaluate(() => {
            const g = window.__vsGame;
            if (!g) return null;
            return {
                state: g.state,
                gameTime: g.gameTime,
                kills: g.kills,
                playerHp: g.player ? g.player.hp : null,
                playerLevel: g.player ? g.player.level : null,
                playerXY: g.player
                    ? { x: Math.round(g.player.x), y: Math.round(g.player.y) }
                    : null,
                enemies: g.enemies?.length ?? 0,
                projectiles: g.projectiles?.length ?? 0,
                particles: g.particles?.length ?? 0,
                fps: g.fpsMeter?.fps ?? null,
                weaponLevels: g.player?.weapons?.map((w) => `${w.id}@${w.level}`) ?? []
            };
        });
    } catch (err) {
        pageErrors.push(`evaluate(state) failed: ${err.message}`);
    }
    process.stdout.write(`[state] ${JSON.stringify(liveState)}\n`);

    await page.screenshot({
        path: path.join(SHOT_DIR, 'real-gameplay.png'),
        fullPage: false
    });
    process.stdout.write('[shot] real-gameplay.png\n');

    // --- Pause / resume sanity ---
    await page.keyboard.press('p');
    await page.waitForTimeout(300);
    const pauseVisible = await page.evaluate(() => {
        const m = document.getElementById('pauseMenu');
        return m && m.style.display !== 'none';
    });
    if (!pauseVisible) pageErrors.push('Pause menu did not appear after pressing P.');
    await page.keyboard.press('p');
    await page.waitForTimeout(300);
    const resumed = await page.evaluate(() => window.__vsGame?.state === 'playing');
    if (!resumed) pageErrors.push('Game did not resume after second P press.');

    await browser.close();
    server.kill('SIGTERM');

    // --- Write report ---
    const lines = [];
    lines.push('# Runtime QA Report (Round 9)');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Page: ${url}`);
    lines.push('');
    lines.push('## Live game state after ~10 s');
    lines.push('```json');
    lines.push(JSON.stringify(liveState, null, 2));
    lines.push('```');
    lines.push('');
    lines.push(`## Console errors (${consoleErrors.length})`);
    if (consoleErrors.length) {
        consoleErrors.forEach((e, i) => lines.push(`${i + 1}. \`${e}\``));
    } else {
        lines.push('_None_ ✅');
    }
    lines.push('');
    lines.push(`## Console warnings (${consoleWarns.length})`);
    if (consoleWarns.length) {
        consoleWarns.forEach((e, i) => lines.push(`${i + 1}. \`${e}\``));
    } else {
        lines.push('_None_ ✅');
    }
    lines.push('');
    lines.push(`## Page errors / uncaught exceptions (${pageErrors.length})`);
    if (pageErrors.length) {
        pageErrors.forEach((e, i) => lines.push(`### ${i + 1}\n\n\`\`\`\n${e}\n\`\`\``));
    } else {
        lines.push('_None_ ✅');
    }
    lines.push('');
    lines.push(`## Failed requests / 4xx-5xx responses (${failedRequests.length})`);
    if (failedRequests.length) {
        failedRequests.forEach((e, i) => lines.push(`${i + 1}. \`${e}\``));
    } else {
        lines.push('_None_ ✅');
    }
    lines.push('');
    lines.push('## Screenshots');
    lines.push('- `docs/screenshots/real-mainmenu.png`');
    lines.push('- `docs/screenshots/real-gameplay.png`');

    fs.writeFileSync(REPORT, lines.join('\n') + '\n', 'utf8');
    process.stdout.write(`\n[report] ${REPORT}\n`);

    const totalErrors = consoleErrors.length + pageErrors.length;
    process.stdout.write(
        `\nSummary: ${consoleErrors.length} console.error, ${consoleWarns.length} console.warn, ${pageErrors.length} pageerror, ${failedRequests.length} failed-request.\n`
    );
    process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error('[runtime-smoke] fatal', err);
    process.exit(2);
});
