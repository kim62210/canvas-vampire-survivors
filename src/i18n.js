/**
 * @module i18n
 * @description Minimal localisation layer. Currently ships English and
 * 简体中文; new locales drop in by adding a key to `STRINGS` and a PR. All
 * lookups fall back to English then to the raw key, so a typo never crashes.
 *
 * Dependencies: none.
 *
 * Exports:
 *   - setLocale(loc), getLocale()
 *   - availableLocales() → string[]
 *   - t(key) → translated string
 */

const STRINGS = {
    en: {
        title: 'SURVIVOR',
        subtitle: 'Vampire Survivors style roguelite',
        start: 'Start Run',
        continue: 'Continue',
        settings: 'Settings',
        howToPlay: 'How to play',
        move: 'WASD / arrow keys to move',
        autoAttack: 'Weapons auto-attack nearby foes',
        survive: 'Survive as long as you can!',
        level: 'LEVEL',
        xp: 'XP',
        time: 'TIME',
        kills: 'KILLS',
        hp: 'HP',
        gameover: 'YOU DIED',
        finalTime: 'Survived',
        finalKills: 'Kills',
        finalLevel: 'Level',
        retry: 'Retry',
        mainMenu: 'Main Menu',
        paused: 'PAUSED',
        resume: 'Resume',
        quit: 'Quit to Menu',
        masterVolume: 'Master Volume',
        sfxVolume: 'SFX Volume',
        musicVolume: 'Music Volume',
        musicEnabled: 'Music',
        difficulty: 'Difficulty',
        showFps: 'Show FPS',
        screenShake: 'Screen shake',
        reducedMotion: 'Reduced motion',
        colorblind: 'High contrast (colorblind)',
        locale: 'Language',
        close: 'Close',
        resetData: 'Reset all saved data',
        confirmReset: 'This will wipe achievements and high scores. Continue?',
        chooseUpgrade: 'Choose an upgrade',
        highScore: 'Best',
        highScores: 'High Scores',
        wave: 'Wave',
        bossIncoming: 'A BOSS APPROACHES',
        achievementUnlocked: 'Achievement Unlocked',
        date: 'Date',
        noHighScores: 'No runs recorded yet.',
        achievements: 'Achievements',
        viewAchievements: 'View Achievements',
        totals: 'Totals',
        speedrun: 'Speedrun',
        leaderboard: 'Leaderboard',
        export: 'Export',
        import: 'Import',
        paste: 'Paste JSON',
        splits: 'Splits',
        noHit: 'No-Hit',
        weapons: 'Weapons',
        speedrunMode: 'Speedrun Mode',
        newPb: 'New personal best!'
    },
    zh: {
        title: '幸存者',
        subtitle: '吸血鬼幸存者风格 Roguelite',
        start: '开始游戏',
        continue: '继续',
        settings: '设置',
        howToPlay: '玩法',
        move: 'WASD / 方向键 移动',
        autoAttack: '武器自动攻击附近敌人',
        survive: '尽可能存活更久！',
        level: '等级',
        xp: '经验',
        time: '时间',
        kills: '击杀',
        hp: '生命',
        gameover: '你死了',
        finalTime: '存活时间',
        finalKills: '击杀',
        finalLevel: '等级',
        retry: '再来一局',
        mainMenu: '返回菜单',
        paused: '已暂停',
        resume: '继续游戏',
        quit: '退出到菜单',
        masterVolume: '主音量',
        sfxVolume: '音效',
        musicVolume: '音乐',
        musicEnabled: '音乐',
        difficulty: '难度',
        showFps: '显示 FPS',
        screenShake: '屏幕抖动',
        reducedMotion: '减少动效',
        colorblind: '高对比度（色盲友好）',
        locale: '语言',
        close: '关闭',
        resetData: '清空所有存档',
        confirmReset: '这会抹掉成就和最高分，确认？',
        chooseUpgrade: '选择一个升级',
        highScore: '最佳',
        highScores: '高分榜',
        wave: '波次',
        bossIncoming: 'BOSS 来了',
        achievementUnlocked: '成就解锁',
        date: '日期',
        noHighScores: '暂无记录',
        achievements: '成就',
        viewAchievements: '查看成就',
        totals: '累计',
        speedrun: '速通',
        leaderboard: '排行榜',
        export: '导出',
        import: '导入',
        paste: '粘贴 JSON',
        splits: '分段',
        noHit: '无伤',
        weapons: '武器',
        speedrunMode: '速通模式',
        newPb: '个人最佳！'
    }
};

let current = 'en';

export function setLocale(loc) {
    if (STRINGS[loc]) current = loc;
}
export function getLocale() {
    return current;
}
export function availableLocales() {
    return Object.keys(STRINGS);
}
export function t(key) {
    return (STRINGS[current] && STRINGS[current][key]) || STRINGS.en[key] || key;
}
