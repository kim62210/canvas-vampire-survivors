// DOM glue: HUD, menus, settings. Kept intentionally separate from the render loop
// so all UI state changes funnel through these helpers.

import { PASSIVES, WEAPONS } from './data.js';
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
            'passiveIcons'
        ];
        for (const id of ids) this.els[id] = document.getElementById(id);
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

        // Weapon icons
        this._renderChips(
            this.els.weaponIcons,
            p.weapons.map((w) => ({
                icon: w.icon,
                level: w.level,
                max: CONFIG.WEAPON_MAX_LEVEL
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
        const picks = pickN(pool, 3);

        for (const up of picks) {
            const div = document.createElement('div');
            div.className = 'upgrade-option';
            const existing =
                up.type === 'weapon'
                    ? player.weapons.find((w) => w.id === up.data.id)
                    : player.passives[up.data.id];
            const lvl = up.type === 'weapon' ? (existing?.level ?? 0) : (existing?.count ?? 0);
            const label =
                lvl > 0 ? ` (${up.type === 'weapon' ? 'Lv.' : 'x'}${lvl + 1})` : ' (New!)';
            div.innerHTML = `
                <div class="name">${up.data.icon} ${up.data.name}${label}</div>
                <div class="desc">${up.data.description}</div>
            `;
            div.addEventListener('click', () => onPick(up));
            div.setAttribute('tabindex', '0');
            div.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') onPick(up);
            });
            options.appendChild(div);
        }
        if (picks.length === 0) {
            // Nothing to upgrade (everything maxed): heal to full instead.
            player.hp = player.maxHp;
            onPick(null);
            return;
        }
        this.els.levelUpMenu.style.display = 'block';
        // focus first option for a11y
        options.querySelector('.upgrade-option')?.focus();
    }

    hideLevelUp() {
        this.els.levelUpMenu.style.display = 'none';
    }

    showBossBanner() {
        if (!this.els.bossBanner) return;
        this.els.bossBanner.textContent = t('bossIncoming');
        this.els.bossBanner.classList.add('visible');
        setTimeout(() => this.els.bossBanner.classList.remove('visible'), 2500);
    }

    showPause() {
        this.els.pauseMenu.style.display = 'flex';
    }
    hidePause() {
        this.els.pauseMenu.style.display = 'none';
    }

    showSettings(settings, onChange, onClose, onReset) {
        const m = this.els.settingsMenu;
        m.innerHTML = `
            <div class="settings-card">
                <h2>${t('settings')}</h2>
                ${sliderRow('masterVolume', settings.masterVolume)}
                ${sliderRow('sfxVolume', settings.sfxVolume)}
                ${sliderRow('musicVolume', settings.musicVolume)}
                ${selectRow('difficulty', settings.difficulty, ['easy', 'normal', 'hard', 'nightmare'])}
                ${checkboxRow('showFps', settings.showFps)}
                ${checkboxRow('screenShake', settings.screenShake)}
                ${checkboxRow('reducedMotion', settings.reducedMotion)}
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

        function handler(e) {
            const key = e.target.dataset.key;
            if (!key) return;
            let val =
                e.target.type === 'checkbox'
                    ? e.target.checked
                    : e.target.type === 'range'
                      ? parseFloat(e.target.value)
                      : e.target.value;
            if (key === 'locale') setLocale(val);
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
        this.els.gameOver.style.display = 'block';
    }

    hideGameOver() {
        this.els.gameOver.style.display = 'none';
    }
    hideStart() {
        this.els.startScreen.style.display = 'none';
    }
    showStart() {
        this.els.startScreen.style.display = 'block';
    }
}

function buildUpgradePool(player) {
    const pool = [];
    for (const weapon of Object.values(WEAPONS)) {
        const existing = player.weapons.find((w) => w.id === weapon.id);
        if (existing) {
            if (existing.level < CONFIG.WEAPON_MAX_LEVEL)
                pool.push({ type: 'weapon', data: weapon });
        } else if (player.weapons.length < CONFIG.MAX_WEAPONS) {
            pool.push({ type: 'weapon', data: weapon });
        }
    }
    for (const passive of Object.values(PASSIVES)) {
        const existing = player.passives[passive.id];
        if (!existing) {
            if (Object.keys(player.passives).length < CONFIG.MAX_PASSIVES) {
                pool.push({ type: 'passive', data: passive });
            }
        } else if (existing.count < CONFIG.PASSIVE_MAX_STACK) {
            pool.push({ type: 'passive', data: passive });
        }
    }
    return pool;
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
