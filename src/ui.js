/**
 * @module ui
 * @description All DOM-side glue — HUD, menus, settings panel, achievement
 * gallery, level-up overlay. Intentionally decoupled from the render loop so
 * UI state mutations always funnel through these helpers (easier to audit,
 * easier to swap renderers later).
 *
 * Dependencies: `./data.js`, `./config.js`, `./i18n.js`.
 *
 * Exports:
 *   - class UI               cached element references + render helpers
 *   - totalAchievements()    convenience for tests / badges
 */

import { ACHIEVEMENTS, PASSIVES, WEAPONS } from './data.js';
import { CONFIG } from './config.js';
import { t, setLocale, availableLocales } from './i18n.js';

export class UI {
    constructor(game) {
        this.game = game;
        this.els = {};
        this._cache();
    }

    _cache() {
        const ids = [
            'hp',
            'maxHp',
            'hpBar',
            'level',
            'expBar',
            'time',
            'kills',
            'weaponIcons',
            'startScreen',
            'gameOver',
            'finalTime',
            'finalKills',
            'finalLevel',
            'levelUpMenu',
            'upgradeOptions',
            'pauseMenu',
            'settingsMenu',
            'fpsCounter',
            'bossBanner',
            'highScore',
            'passiveIcons',
            'achievementToasts',
            'highScoreList',
            'waveLabel',
            'achievementsScreen',
            'leaderboardScreen'
        ];
        for (const id of ids) this.els[id] = document.getElementById(id);
    }

    /**
     * Full-screen leaderboard dialog. Renders both regular + speedrun runs in
     * separate scrollable sections, with export/import for sharing. This is
     * the main-menu entry point; the game-over summary still shows a compact
     * top-10 list inside the run recap.
     */
    showLeaderboard(normalScores, speedrunScores, onClose) {
        const m = this.els.leaderboardScreen;
        if (!m) return;
        const renderRow = (r, i) => {
            const mm = Math.floor((r.timeSurvived ?? 0) / 60)
                .toString()
                .padStart(2, '0');
            const ss = Math.floor((r.timeSurvived ?? 0) % 60)
                .toString()
                .padStart(2, '0');
            const d = new Date(r.date || 0);
            const dstr = isNaN(d.getTime())
                ? '—'
                : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
                      d.getDate()
                  ).padStart(2, '0')}`;
            const ws = Array.isArray(r.weapons) && r.weapons.length ? r.weapons.join(' + ') : '—';
            const nh = r.noHit ? `<span class="no-hit">${t('noHit')}</span>` : '';
            return `<div class="hs-row wide"><span>${i + 1}</span><span>${mm}:${ss}</span><span>Lv.${r.level ?? 1}</span><span>${r.kills ?? 0}</span><span class="weapons">${ws}</span><span>${dstr}</span><span>${nh}</span></div>`;
        };
        const renderSpeedRow = (r, i) => {
            const ms = r.timeMs || 0;
            const mm = Math.floor(ms / 60000)
                .toString()
                .padStart(2, '0');
            const ss = Math.floor((ms % 60000) / 1000)
                .toString()
                .padStart(2, '0');
            const ml = Math.floor(ms % 1000)
                .toString()
                .padStart(3, '0');
            const d = new Date(r.date || 0);
            const dstr = isNaN(d.getTime())
                ? '—'
                : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
                      d.getDate()
                  ).padStart(2, '0')}`;
            const ws = Array.isArray(r.weapons) && r.weapons.length ? r.weapons.join(' + ') : '—';
            return `<div class="hs-row wide"><span>${i + 1}</span><span>${mm}:${ss}.${ml}</span><span>Lv.${r.level ?? 1}</span><span>${r.kills ?? 0}</span><span class="weapons">${ws}</span><span>${dstr}</span></div>`;
        };
        m.innerHTML = `
            <div class="overlay-card leaderboard-card">
                <h2>${t('leaderboard')}</h2>
                <section class="lb-section">
                    <h3>${t('highScores')} (${normalScores.length})</h3>
                    <div class="hs-list scroll">
                        ${
                            normalScores.length
                                ? `<div class="hs-head wide"><span>#</span><span>${t('time')}</span><span>${t('level')}</span><span>${t('kills')}</span><span>${t('weapons')}</span><span>${t('date')}</span><span>${t('noHit')}</span></div>` +
                                  normalScores.map(renderRow).join('')
                                : `<div class="hs-empty">${t('noHighScores')}</div>`
                        }
                    </div>
                </section>
                <section class="lb-section">
                    <h3>${t('speedrun')} (${speedrunScores.length})</h3>
                    <div class="hs-list scroll">
                        ${
                            speedrunScores.length
                                ? `<div class="hs-head wide"><span>#</span><span>${t('time')}</span><span>${t('level')}</span><span>${t('kills')}</span><span>${t('weapons')}</span><span>${t('date')}</span></div>` +
                                  speedrunScores.map(renderSpeedRow).join('')
                                : `<div class="hs-empty">${t('noHighScores')}</div>`
                        }
                    </div>
                </section>
                <textarea id="lbJson" class="lb-json" rows="4" aria-label="${t('paste')}" placeholder='${t('paste')}'></textarea>
                <div class="btn-row">
                    <button id="lbExport" class="btn ghost">${t('export')}</button>
                    <button id="lbImport" class="btn ghost">${t('import')}</button>
                    <button id="lbClose" class="btn primary">${t('close')}</button>
                </div>
            </div>`;
        m.style.display = 'flex';
        const close = () => {
            m.style.display = 'none';
            onClose && onClose();
        };
        m.querySelector('#lbClose')?.addEventListener('click', close);
        const ta = m.querySelector('#lbJson');
        m.querySelector('#lbExport')?.addEventListener('click', () => {
            if (ta) ta.value = JSON.stringify({ normal: normalScores, speedrun: speedrunScores });
        });
        m.querySelector('#lbImport')?.addEventListener('click', () => {
            if (!ta?.value?.trim()) return;
            try {
                const parsed = JSON.parse(ta.value);
                // Caller wires the merge into storage; here we just fire an event.
                const ev = new CustomEvent('vs-leaderboard-import', { detail: parsed });
                window.dispatchEvent(ev);
            } catch (err) {
                console.warn('[ui] Import JSON parse failed', err);
                ta.value = 'Invalid JSON: ' + err.message;
            }
        });
    }

    hideLeaderboard() {
        if (this.els.leaderboardScreen) this.els.leaderboardScreen.style.display = 'none';
    }

    /**
     * Render the achievements gallery as a grid of locked/unlocked cards.
     * @param {Record<string, number>} unlocked - id → unlock timestamp
     * @param {() => void} onClose
     */
    showAchievements(unlocked, onClose) {
        const m = this.els.achievementsScreen;
        if (!m) return;
        const total = ACHIEVEMENTS.length;
        const earned = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
        m.innerHTML = `
            <div class="overlay-card achievements-card">
                <h2>${t('achievements')} <span class="ach-count">${earned} / ${total}</span></h2>
                <div class="ach-grid">
                    ${ACHIEVEMENTS.map((a) => {
                        const got = !!unlocked[a.id];
                        return `
                            <div class="ach-card ${got ? 'earned' : 'locked'}">
                                <div class="ach-card-icon">${got ? a.icon : '🔒'}</div>
                                <div class="ach-card-name">${got ? a.name : '???'}</div>
                                <div class="ach-card-desc">${a.description}</div>
                            </div>`;
                    }).join('')}
                </div>
                <div class="btn-row">
                    <button id="achClose" class="btn primary">${t('close')}</button>
                </div>
            </div>`;
        m.style.display = 'flex';
        const close = () => {
            m.style.display = 'none';
            onClose && onClose();
        };
        m.querySelector('#achClose')?.addEventListener('click', close);
    }

    hideAchievements() {
        if (this.els.achievementsScreen) this.els.achievementsScreen.style.display = 'none';
    }

    updateHud(game) {
        const p = game.player;
        this.els.hp.textContent = Math.ceil(p.hp);
        this.els.maxHp.textContent = Math.ceil(p.maxHp);
        this.els.hpBar.style.width = Math.max(0, (p.hp / p.maxHp) * 100) + '%';
        this.els.level.textContent = p.level;
        this.els.expBar.style.width = Math.min(100, (p.exp / p.expToNext) * 100) + '%';

        const m = Math.floor(game.gameTime / 60)
            .toString()
            .padStart(2, '0');
        const s = Math.floor(game.gameTime % 60)
            .toString()
            .padStart(2, '0');
        this.els.time.textContent = `${m}:${s}`;
        this.els.kills.textContent = game.kills;

        if (this.els.highScore) {
            const hs = game.save.highScore;
            const hm = Math.floor(hs.timeSurvived / 60)
                .toString()
                .padStart(2, '0');
            const hsec = Math.floor(hs.timeSurvived % 60)
                .toString()
                .padStart(2, '0');
            this.els.highScore.textContent = `${t('highScore')}: ${hm}:${hsec} · ${hs.kills}K`;
        }

        if (this.els.waveLabel && game.currentWave) {
            this.els.waveLabel.textContent = `${t('wave')}: ${game.currentWave.label}`;
        }

        // Weapon icons
        this._renderChips(
            this.els.weaponIcons,
            p.weapons.map((w) => ({
                icon: w.icon,
                level: w.level,
                max: CONFIG.WEAPON_MAX_LEVEL,
                evolved: !!w.isEvolved?.()
            }))
        );
        // Passive icons
        const passives = [];
        for (const id in p.passives) {
            const p2 = p.passives[id];
            passives.push({ icon: p2.def.icon, level: p2.count, max: CONFIG.PASSIVE_MAX_STACK });
        }
        this._renderChips(this.els.passiveIcons, passives);
    }

    _renderChips(container, items) {
        if (!container) return;
        container.innerHTML = '';
        for (const it of items) {
            const div = document.createElement('div');
            div.className = 'chip active' + (it.level >= it.max ? ' maxed' : '');
            if (it.evolved) div.classList.add('evolved');
            div.textContent = it.icon;
            const lvl = document.createElement('span');
            lvl.className = 'chip-lvl';
            lvl.textContent = it.level;
            div.appendChild(lvl);
            container.appendChild(div);
        }
    }

    setFps(fps, show) {
        if (!this.els.fpsCounter) return;
        this.els.fpsCounter.style.display = show ? 'block' : 'none';
        this.els.fpsCounter.textContent = `${Math.round(fps)} fps`;
    }

    showLevelUp(player, onPick) {
        const options = this.els.upgradeOptions;
        options.innerHTML = '';
        const pool = buildUpgradePool(player);
        // pool is [...live, ...maxed]. We pick from `live` first, fall back to
        // maxed only when there is nothing else to surface.
        const liveCount = pool.filter((p) => isUpgradeLive(player, p)).length;
        const livePool = pool.slice(0, liveCount);
        const maxedPool = pool.slice(liveCount);
        const picks = pickN(livePool, 3);
        while (picks.length < 3 && maxedPool.length) {
            const i = Math.floor(Math.random() * maxedPool.length);
            picks.push(maxedPool.splice(i, 1)[0]);
        }

        for (const up of picks) {
            const div = document.createElement('div');
            div.className = 'upgrade-option';
            div.setAttribute('role', 'menuitem');
            const existing =
                up.type === 'weapon'
                    ? player.weapons.find((w) => w.id === up.data.id)
                    : player.passives[up.data.id];
            const lvl = up.type === 'weapon' ? (existing?.level ?? 0) : (existing?.count ?? 0);
            const isMaxed =
                up.type === 'weapon'
                    ? lvl >= CONFIG.WEAPON_MAX_LEVEL
                    : lvl >= CONFIG.PASSIVE_MAX_STACK;
            const label = isMaxed
                ? ' (MAXED)'
                : lvl > 0
                  ? ` (${up.type === 'weapon' ? 'Lv.' : 'x'}${lvl + 1})`
                  : ' (New!)';
            const willEvolve =
                up.type === 'weapon' &&
                !isMaxed &&
                lvl + 1 === up.data.evolveLevel &&
                up.data.evolveName;
            const evoHtml = willEvolve
                ? `<div class="evolve-tag">→ ${up.data.evolveName}</div>`
                : '';
            if (isMaxed) div.classList.add('maxed');
            div.setAttribute(
                'aria-label',
                `${up.data.name}${label}. ${up.data.description}${willEvolve ? '. Evolves into ' + up.data.evolveName : ''}`
            );
            div.innerHTML = `
                <div class="name">${up.data.icon} ${up.data.name}${label}</div>
                <div class="desc">${up.data.description}</div>
                ${evoHtml}
            `;
            // MAXED options heal a sliver instead of vanishing — they pay out something.
            div.addEventListener('click', () => onPick(isMaxed ? null : up));
            div.setAttribute('tabindex', '0');
            div.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPick(isMaxed ? null : up);
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    (div.nextElementSibling || options.firstElementChild)?.focus();
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    (div.previousElementSibling || options.lastElementChild)?.focus();
                }
            });
            options.appendChild(div);
        }
        if (picks.length === 0) {
            // Nothing to upgrade (everything maxed): heal to full instead.
            player.hp = player.maxHp;
            onPick(null);
            return;
        }
        this.els.levelUpMenu.style.display = 'flex';
        // focus first option for a11y
        options.querySelector('.upgrade-option')?.focus();
    }

    hideLevelUp() {
        this.els.levelUpMenu.style.display = 'none';
    }

    showBossBanner() {
        if (!this.els.bossBanner) return;
        this._activeBannerKey = 'bossIncoming';
        this.els.bossBanner.textContent = t('bossIncoming');
        this.els.bossBanner.classList.add('visible');
        clearTimeout(this._bannerTimer);
        this._bannerTimer = setTimeout(() => {
            this.els.bossBanner.classList.remove('visible');
            this._activeBannerKey = null;
        }, 2500);
    }

    /** Re-translate any sticky DOM text that does not flow through updateHud. */
    onLocaleChanged() {
        if (this._activeBannerKey && this.els.bossBanner) {
            this.els.bossBanner.textContent = t(this._activeBannerKey);
        }
    }

    showPause() {
        this.els.pauseMenu.style.display = 'flex';
    }
    hidePause() {
        this.els.pauseMenu.style.display = 'none';
    }

    showAchievementToast(ach) {
        const host = this.els.achievementToasts;
        if (!host) return;
        const el = document.createElement('div');
        el.className = 'ach-toast';
        el.innerHTML = `
            <div class="ach-icon">${ach.icon}</div>
            <div class="ach-body">
                <div class="ach-title">${t('achievementUnlocked')}</div>
                <div class="ach-name">${ach.name}</div>
                <div class="ach-desc">${ach.description}</div>
            </div>`;
        host.appendChild(el);
        // fade-in
        requestAnimationFrame(() => el.classList.add('visible'));
        setTimeout(() => {
            el.classList.remove('visible');
            setTimeout(() => el.remove(), 500);
        }, 3500);
    }

    showSettings(settings, onChange, onClose, onReset) {
        const m = this.els.settingsMenu;
        m.innerHTML = `
            <div class="settings-card">
                <h2>${t('settings')}</h2>
                ${sliderRow('masterVolume', settings.masterVolume)}
                ${sliderRow('sfxVolume', settings.sfxVolume)}
                ${sliderRow('musicVolume', settings.musicVolume)}
                ${checkboxRow('musicEnabled', settings.musicEnabled !== false)}
                ${selectRow('difficulty', settings.difficulty, ['easy', 'normal', 'hard', 'nightmare'])}
                ${checkboxRow('showFps', settings.showFps)}
                ${checkboxRow('screenShake', settings.screenShake)}
                ${checkboxRow('reducedMotion', settings.reducedMotion)}
                ${checkboxRow('colorblind', !!settings.colorblind)}
                ${selectRow('locale', settings.locale, availableLocales())}
                <div class="settings-buttons">
                    <button class="danger" data-action="reset">${t('resetData')}</button>
                    <button data-action="close">${t('close')}</button>
                </div>
            </div>`;
        m.style.display = 'flex';
        m.addEventListener('input', handler);
        m.addEventListener('change', handler);
        m.addEventListener('click', buttonHandler);

        const self = this;
        function handler(e) {
            const key = e.target.dataset.key;
            if (!key) return;
            const val =
                e.target.type === 'checkbox'
                    ? e.target.checked
                    : e.target.type === 'range'
                      ? parseFloat(e.target.value)
                      : e.target.value;
            if (key === 'locale') {
                setLocale(val);
                self.onLocaleChanged();
            }
            if (key === 'colorblind') {
                document.body.classList.toggle('cb-mode', !!val);
            }
            onChange(key, val);
        }
        function buttonHandler(e) {
            const a = e.target.dataset.action;
            if (a === 'close') {
                m.removeEventListener('input', handler);
                m.removeEventListener('change', handler);
                m.removeEventListener('click', buttonHandler);
                m.style.display = 'none';
                onClose();
            } else if (a === 'reset') {
                if (confirm(t('confirmReset'))) onReset();
            }
        }
    }

    hideSettings() {
        this.els.settingsMenu.style.display = 'none';
    }

    showGameOver(game) {
        const m = Math.floor(game.gameTime / 60)
            .toString()
            .padStart(2, '0');
        const s = Math.floor(game.gameTime % 60)
            .toString()
            .padStart(2, '0');
        this.els.finalTime.textContent = `${m}:${s}`;
        this.els.finalKills.textContent = game.kills;
        this.els.finalLevel.textContent = game.player.level;

        // Render leaderboard under the run summary.
        if (this.els.highScoreList) {
            const rows = game.save.highScores || [];
            // Speedrun splits block (if applicable).
            let splitsHtml = '';
            if (game.speedrunMode && game.speedrunSplits?.length) {
                splitsHtml =
                    `<div class="splits"><div class="splits-head">${t('splits')}</div>` +
                    game.speedrunSplits
                        .map((sp) => {
                            const mm = Math.floor(sp.mark / 60)
                                .toString()
                                .padStart(2, '0');
                            const ss = Math.floor(sp.mark % 60)
                                .toString()
                                .padStart(2, '0');
                            const rs = (sp.realMs / 1000).toFixed(2);
                            return `<div class="split-row"><span>${mm}:${ss}</span><span>${rs}s</span></div>`;
                        })
                        .join('') +
                    '</div>';
            }
            if (!rows.length) {
                this.els.highScoreList.innerHTML =
                    splitsHtml + `<div class="hs-empty">${t('noHighScores')}</div>`;
            } else {
                this.els.highScoreList.innerHTML =
                    splitsHtml +
                    `<div class="hs-head"><span>#</span><span>${t('time')}</span><span>${t('level')}</span><span>${t('kills')}</span><span>${t('date')}</span></div>` +
                    rows
                        .map((r, i) => {
                            const mm = Math.floor(r.timeSurvived / 60)
                                .toString()
                                .padStart(2, '0');
                            const ss = Math.floor(r.timeSurvived % 60)
                                .toString()
                                .padStart(2, '0');
                            const d = new Date(r.date || 0);
                            const dstr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            return `<div class="hs-row"><span>${i + 1}</span><span>${mm}:${ss}</span><span>${r.level}</span><span>${r.kills}</span><span>${dstr}</span></div>`;
                        })
                        .join('');
            }
        }

        this.els.gameOver.style.display = 'flex';
    }

    hideGameOver() {
        this.els.gameOver.style.display = 'none';
    }
    hideStart() {
        this.els.startScreen.style.display = 'none';
    }
    showStart() {
        this.els.startScreen.style.display = 'flex';
    }
}

function buildUpgradePool(player) {
    // Two tiers: live (selectable) upgrades first, then "maxed" cards as a
    // visible reminder of mastery. The level-up screen still prefers `live`,
    // so the player rarely sees a maxed card unless their build is full.
    const live = [];
    const maxed = [];
    for (const weapon of Object.values(WEAPONS)) {
        const existing = player.weapons.find((w) => w.id === weapon.id);
        if (existing) {
            if (existing.level < CONFIG.WEAPON_MAX_LEVEL) {
                live.push({ type: 'weapon', data: weapon });
            } else {
                maxed.push({ type: 'weapon', data: weapon });
            }
        } else if (player.weapons.length < CONFIG.MAX_WEAPONS) {
            live.push({ type: 'weapon', data: weapon });
        }
    }
    for (const passive of Object.values(PASSIVES)) {
        const existing = player.passives[passive.id];
        if (!existing) {
            if (Object.keys(player.passives).length < CONFIG.MAX_PASSIVES) {
                live.push({ type: 'passive', data: passive });
            }
        } else if (existing.count < CONFIG.PASSIVE_MAX_STACK) {
            live.push({ type: 'passive', data: passive });
        } else {
            maxed.push({ type: 'passive', data: passive });
        }
    }
    return live.concat(maxed);
}

function isUpgradeLive(player, up) {
    if (up.type === 'weapon') {
        const existing = player.weapons.find((w) => w.id === up.data.id);
        return !existing || existing.level < CONFIG.WEAPON_MAX_LEVEL;
    }
    const existing = player.passives[up.data.id];
    return !existing || existing.count < CONFIG.PASSIVE_MAX_STACK;
}

function pickN(arr, n) {
    const out = [];
    const copy = arr.slice();
    while (out.length < n && copy.length) {
        const i = Math.floor(Math.random() * copy.length);
        out.push(copy.splice(i, 1)[0]);
    }
    return out;
}

function sliderRow(key, value) {
    return `
        <label class="settings-row">
            <span>${t(key)}</span>
            <input type="range" min="0" max="1" step="0.05" value="${value}" data-key="${key}">
            <output>${Math.round(value * 100)}%</output>
        </label>`;
}

function selectRow(key, value, values) {
    return `
        <label class="settings-row">
            <span>${t(key)}</span>
            <select data-key="${key}">
                ${values.map((v) => `<option value="${v}" ${v === value ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
        </label>`;
}

function checkboxRow(key, value) {
    return `
        <label class="settings-row">
            <span>${t(key)}</span>
            <input type="checkbox" data-key="${key}" ${value ? 'checked' : ''}>
        </label>`;
}

// Expose catalogue count for badges / tests.
export function totalAchievements() {
    return ACHIEVEMENTS.length;
}
