#!/usr/bin/env node
/**
 * @file docs/generate-screenshots.js
 * @description Emits 6 SVG mockups under `docs/screenshots/` that approximate
 * how the game looks at key moments. We chose SVG over a real headless
 * renderer because:
 *
 *   1. The game is canvas-2D and depends on `requestAnimationFrame`,
 *      `localStorage`, the Web Audio API and gamepad polling. Driving that
 *      from `node-canvas` would require shimming half a browser, whereas a
 *      hand-built SVG composition captures the same "what does this scene
 *      look like" intent in ~50 lines per scene.
 *   2. SVG renders crisply at any zoom in GitHub's README and ships under
 *      10 KB per image — friendlier than 500 KB PNGs.
 *   3. No runtime dependencies. Run with plain `node`.
 *
 * Real screenshots, when contributors capture them, take precedence: drop
 * `mainmenu.png` next to `mainmenu.svg` and re-point the README links.
 *
 * Usage: `node docs/generate-screenshots.js` (idempotent, overwrites).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const W = 1200;
const H = 800;
const OUT = path.join(__dirname, 'screenshots');

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// Reusable atoms
// ---------------------------------------------------------------------------
function svgOpen(extra = '') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" ${extra}>`;
}

function bgGradient(id, c1, c2) {
    return `<defs><radialGradient id="${id}" cx="50%" cy="50%" r="65%">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
    </radialGradient></defs>`;
}

function gridOverlay(step = 50, color = '#1b2235', opacity = 0.4) {
    let lines = '';
    for (let x = 0; x <= W; x += step) {
        lines += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${color}" stroke-width="1" opacity="${opacity}"/>`;
    }
    for (let y = 0; y <= H; y += step) {
        lines += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${color}" stroke-width="1" opacity="${opacity}"/>`;
    }
    return lines;
}

function hero(x, y) {
    return `
        <circle cx="${x}" cy="${y}" r="46" fill="#44aaff" opacity="0.18"/>
        <circle cx="${x}" cy="${y}" r="20" fill="#44aaff"/>
        <circle cx="${x}" cy="${y}" r="11" fill="#cfeaff"/>`;
}

function enemy(x, y, r = 12, color = '#ff4444') {
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>
            <circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.4}" fill="rgba(255,255,255,0.25)"/>`;
}

function boss(x, y) {
    return `
        <circle cx="${x}" cy="${y}" r="80" fill="#220000" opacity="0.5"/>
        <circle cx="${x}" cy="${y}" r="60" fill="#aa0033"/>
        <circle cx="${x}" cy="${y}" r="32" fill="#ff5577"/>
        <circle cx="${x}" cy="${y}" r="14" fill="#fff"/>`;
}

function expOrb(x, y) {
    return `<circle cx="${x}" cy="${y}" r="4" fill="#7df4d3"/>`;
}

function projectile(x, y) {
    return `<circle cx="${x}" cy="${y}" r="5" fill="#ffe066"/>`;
}

function hudBar() {
    return `
        <rect x="0" y="0" width="${W}" height="56" fill="rgba(0,0,0,0.55)"/>
        <text x="24" y="36" font-family="monospace" font-size="20" fill="#cfeaff">LV 7</text>
        <text x="120" y="36" font-family="monospace" font-size="20" fill="#cfeaff">TIME 03:42</text>
        <text x="320" y="36" font-family="monospace" font-size="20" fill="#cfeaff">KILLS 412</text>
        <rect x="520" y="20" width="200" height="14" fill="rgba(255,255,255,0.15)"/>
        <rect x="520" y="20" width="118" height="14" fill="#ff4477"/>
        <text x="730" y="32" font-family="monospace" font-size="14" fill="#cfeaff">HP 59/100</text>
        <rect x="520" y="38" width="200" height="6" fill="rgba(255,255,255,0.15)"/>
        <rect x="520" y="38" width="142" height="6" fill="#7df4d3"/>`;
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------
function mainmenu() {
    return [
        svgOpen(),
        bgGradient('bg', '#16213e', '#0a0e27'),
        `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
        gridOverlay(),
        `<text x="${W / 2}" y="220" text-anchor="middle" font-family="Impact, sans-serif" font-size="120" fill="#cfeaff" letter-spacing="6">SURVIVOR</text>`,
        `<text x="${W / 2}" y="270" text-anchor="middle" font-family="monospace" font-size="20" fill="#7d9aff" letter-spacing="2">vampire-survivors style roguelite · zero deps</text>`,
        // Buttons
        ...['Start Run', 'Speedrun', 'Leaderboard', 'Achievements', 'Settings'].map((label, i) => {
            const y = 360 + i * 70;
            return `
                <rect x="${W / 2 - 180}" y="${y}" width="360" height="54" rx="10" fill="#1d2a4a" stroke="#3a5dbb"/>
                <text x="${W / 2}" y="${y + 35}" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#cfeaff">${label}</text>`;
        }),
        `<text x="${W / 2}" y="${H - 24}" text-anchor="middle" font-family="monospace" font-size="14" fill="#506080">v2.5.0 · MIT · github.com/Ricardo-M-L/canvas-vampire-survivors</text>`,
        '</svg>'
    ].join('\n');
}

function gameplayEarly() {
    const enemies = [];
    // small wave from the right
    for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 0.6 - Math.PI * 0.3;
        const r = 320 + (i % 5) * 18;
        enemies.push(enemy(W / 2 + Math.cos(angle) * r, H / 2 + Math.sin(angle) * r));
    }
    return [
        svgOpen(),
        bgGradient('bg', '#1a1a3a', '#05050f'),
        `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
        gridOverlay(),
        ...enemies,
        // Whip arc
        `<path d="M ${W / 2 + 30} ${H / 2 - 10} q 80 -40 160 0" stroke="#ffe066" stroke-width="6" fill="none" opacity="0.85"/>`,
        // Exp orbs trail
        expOrb(W / 2 - 80, H / 2 + 60),
        expOrb(W / 2 + 90, H / 2 - 50),
        expOrb(W / 2 - 30, H / 2 + 40),
        hero(W / 2, H / 2),
        hudBar(),
        `<text x="${W / 2}" y="${H - 32}" text-anchor="middle" font-family="monospace" font-size="14" fill="rgba(255,255,255,0.5)">Wave 2: Bats</text>`,
        '</svg>'
    ].join('\n');
}

function bossFight() {
    const enemies = [];
    for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 200 + Math.random() * 280;
        enemies.push(enemy(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r, 10, '#aa3344'));
    }
    const projectiles = [];
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        projectiles.push(projectile(W / 2 + 200 + Math.cos(a) * 60, H / 2 - 40 + Math.sin(a) * 60));
    }
    return [
        svgOpen(),
        bgGradient('bg', '#3a0e1c', '#0a0510'),
        `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
        gridOverlay(50, '#2a0e18', 0.4),
        // Boss banner
        `<rect x="0" y="120" width="${W}" height="60" fill="rgba(170,0,40,0.55)"/>`,
        `<text x="${W / 2}" y="160" text-anchor="middle" font-family="Impact, sans-serif" font-size="34" fill="#ffe6ec" letter-spacing="4">A BOSS APPROACHES — VOID LORD</text>`,
        ...enemies,
        boss(W / 2 + 240, H / 2 - 40),
        ...projectiles,
        // Player + orbit shards
        hero(W / 2 - 80, H / 2 + 60),
        ...[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            return `<circle cx="${W / 2 - 80 + Math.cos(a) * 60}" cy="${H / 2 + 60 + Math.sin(a) * 60}" r="6" fill="#88ddff"/>`;
        }),
        hudBar(),
        '</svg>'
    ].join('\n');
}

function levelup() {
    return [
        svgOpen(),
        bgGradient('bg', '#16213e', '#0a0e27'),
        `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
        gridOverlay(),
        // Dim layer
        `<rect width="${W}" height="${H}" fill="rgba(0,0,0,0.55)"/>`,
        `<text x="${W / 2}" y="200" text-anchor="middle" font-family="Impact, sans-serif" font-size="56" fill="#ffe066">LEVEL UP!</text>`,
        `<text x="${W / 2}" y="240" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#cfeaff">Choose an upgrade</text>`,
        // 3 cards
        ...[
            { name: 'Whip', desc: 'Damage +25%', tier: 'Lv 3' },
            { name: 'Frost Nova', desc: 'New weapon', tier: 'Lv 1' },
            { name: 'Magnet', desc: 'Pickup range +30%', tier: 'Lv 2' }
        ].map((c, i) => {
            const x = 180 + i * 290;
            return `
                <rect x="${x}" y="320" width="260" height="280" rx="12" fill="#1d2a4a" stroke="#ffe066" stroke-width="2"/>
                <circle cx="${x + 130}" cy="400" r="40" fill="#3a5dbb"/>
                <text x="${x + 130}" y="410" text-anchor="middle" font-family="sans-serif" font-size="32" fill="#cfeaff">★</text>
                <text x="${x + 130}" y="490" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#ffe066">${c.name}</text>
                <text x="${x + 130}" y="520" text-anchor="middle" font-family="monospace" font-size="14" fill="#7d9aff">${c.tier}</text>
                <text x="${x + 130}" y="558" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#cfeaff">${c.desc}</text>`;
        }),
        '</svg>'
    ].join('\n');
}

function gameover() {
    return [
        svgOpen(),
        bgGradient('bg', '#3a0e1c', '#0a0510'),
        `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
        gridOverlay(50, '#2a0e18', 0.3),
        `<rect width="${W}" height="${H}" fill="rgba(0,0,0,0.5)"/>`,
        `<text x="${W / 2}" y="200" text-anchor="middle" font-family="Impact, sans-serif" font-size="100" fill="#ff4444" letter-spacing="6">YOU DIED</text>`,
        // Stats card
        `<rect x="${W / 2 - 220}" y="260" width="440" height="280" rx="12" fill="#1d2a4a" stroke="#3a5dbb"/>`,
        ...[
            ['Survived', '08:42'],
            ['Kills', '1,284'],
            ['Level', '23'],
            ['Best build', 'Whip · Orbit · Frost Nova']
        ].map((row, i) => {
            const y = 310 + i * 56;
            return `
                <text x="${W / 2 - 200}" y="${y}" font-family="sans-serif" font-size="20" fill="#7d9aff">${row[0]}</text>
                <text x="${W / 2 + 200}" y="${y}" text-anchor="end" font-family="monospace" font-size="22" fill="#cfeaff">${row[1]}</text>`;
        }),
        `<text x="${W / 2}" y="540" text-anchor="middle" font-family="monospace" font-size="14" fill="#7df4d3">★ NO-HIT RUN — Achievement unlocked</text>`,
        // buttons
        `<rect x="${W / 2 - 180}" y="600" width="160" height="50" rx="10" fill="#3a5dbb"/>`,
        `<text x="${W / 2 - 100}" y="632" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#cfeaff">Retry</text>`,
        `<rect x="${W / 2 + 20}" y="600" width="160" height="50" rx="10" fill="#1d2a4a" stroke="#3a5dbb"/>`,
        `<text x="${W / 2 + 100}" y="632" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#cfeaff">Main Menu</text>`,
        '</svg>'
    ].join('\n');
}

function achievements() {
    const items = [
        { i: '🩸', n: 'First Blood', got: true },
        { i: '⚔', n: 'Centurion', got: true },
        { i: '👑', n: 'Boss Slayer', got: true },
        { i: '🌪', n: 'Storm Survivor', got: true },
        { i: '⏱', n: '5 Minutes', got: true },
        { i: '⏱', n: '10 Minutes', got: false },
        { i: '🛡', n: 'No-Hit Boss', got: false },
        { i: '🔮', n: 'Max All', got: false },
        { i: '⚡', n: 'Speed Demon', got: true },
        { i: '🧪', n: 'Triple Build', got: false },
        { i: '🔱', n: 'Early Evolve', got: true },
        { i: '🧘', n: 'Zen 5min', got: false }
    ];
    return [
        svgOpen(),
        bgGradient('bg', '#16213e', '#0a0e27'),
        `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
        gridOverlay(),
        `<rect width="${W}" height="${H}" fill="rgba(0,0,0,0.55)"/>`,
        `<text x="${W / 2}" y="120" text-anchor="middle" font-family="Impact, sans-serif" font-size="46" fill="#ffe066">ACHIEVEMENTS · 7 / 12</text>`,
        ...items.map((a, i) => {
            const col = i % 4;
            const row = Math.floor(i / 4);
            const x = 130 + col * 250;
            const y = 200 + row * 170;
            return `
                <rect x="${x}" y="${y}" width="220" height="140" rx="12" fill="${a.got ? '#1d2a4a' : '#13182a'}" stroke="${a.got ? '#ffe066' : '#2a3450'}" stroke-width="2"/>
                <text x="${x + 110}" y="${y + 55}" text-anchor="middle" font-family="sans-serif" font-size="36" fill="${a.got ? '#ffe066' : '#3a4560'}">${a.got ? a.i : '🔒'}</text>
                <text x="${x + 110}" y="${y + 95}" text-anchor="middle" font-family="sans-serif" font-size="18" fill="${a.got ? '#cfeaff' : '#5a6a85'}">${a.got ? a.n : '???'}</text>
                <text x="${x + 110}" y="${y + 120}" text-anchor="middle" font-family="monospace" font-size="11" fill="${a.got ? '#7df4d3' : '#3a4560'}">${a.got ? 'UNLOCKED' : 'LOCKED'}</text>`;
        }),
        '</svg>'
    ].join('\n');
}

// ---------------------------------------------------------------------------
// Drive
// ---------------------------------------------------------------------------
const SCENES = {
    'mainmenu.svg': mainmenu(),
    'gameplay-early.svg': gameplayEarly(),
    'boss-fight.svg': bossFight(),
    'levelup.svg': levelup(),
    'gameover.svg': gameover(),
    'achievements.svg': achievements()
};

let written = 0;
for (const [name, body] of Object.entries(SCENES)) {
    const out = path.join(OUT, name);
    fs.writeFileSync(out, body, 'utf8');
    written++;
    console.log(
        `wrote ${path.relative(process.cwd(), out)} (${(body.length / 1024).toFixed(1)} KB)`
    );
}
console.log(`\n${written} screenshot mockups generated in ${path.relative(process.cwd(), OUT)}`);
