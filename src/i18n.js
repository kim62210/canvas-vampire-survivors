/**
 * @module i18n
 * @description Single-locale layer for the Korean build. Originally shipped
 * en + zh + ko; the channel target (a Korean-only game portal) made the
 * extra locales dead weight, so the public API is now ko-locked: any locale
 * argument resolves to ko, and `availableLocales()` returns `['ko']` so the
 * Settings panel skips drawing a one-option select. STRINGS lookup still
 * falls back to the raw key, so a typo never crashes.
 *
 * Dependencies: none.
 *
 * Exports:
 *   - setLocale(loc), getLocale()
 *   - availableLocales() → ['ko']
 *   - t(key) → translated string
 *   - detectLocale() → 'ko' (kept for API compatibility)
 */

const STRINGS = {
    ko: {
        title: '서바이버',
        subtitle: '뱀파이어 서바이버 스타일 로그라이트',
        start: '게임 시작',
        continue: '이어하기',
        settings: '설정',
        howToPlay: '플레이 방법',
        move: 'WASD / 방향키로 이동',
        autoAttack: '무기는 근처 적을 자동 공격',
        survive: '최대한 오래 살아남자!',
        level: '레벨',
        xp: '경험치',
        time: '시간',
        kills: '처치',
        hp: '체력',
        gameover: '사망',
        finalTime: '생존 시간',
        finalKills: '처치 수',
        finalLevel: '레벨',
        retry: '다시 시작',
        mainMenu: '메인 메뉴',
        paused: '일시정지',
        resume: '계속하기',
        quit: '메뉴로 나가기',
        masterVolume: '마스터 볼륨',
        sfxVolume: '효과음',
        musicVolume: '배경음',
        musicEnabled: '음악',
        difficulty: '난이도',
        showFps: 'FPS 표시',
        screenShake: '화면 흔들림',
        reducedMotion: '모션 감소',
        colorblind: '고대비 (색약 모드)',
        locale: '언어',
        close: '닫기',
        resetData: '저장 데이터 모두 초기화',
        confirmReset: '업적과 최고 기록이 모두 삭제됩니다. 계속하시겠습니까?',
        chooseUpgrade: '강화를 선택하세요',
        highScore: '최고',
        highScores: '최고 기록',
        wave: '웨이브',
        bossIncoming: '보스 등장',
        achievementUnlocked: '업적 달성',
        date: '날짜',
        noHighScores: '아직 기록이 없습니다.',
        achievements: '업적',
        viewAchievements: '업적 보기',
        totals: '누적',
        speedrun: '스피드런',
        leaderboard: '리더보드',
        export: '내보내기',
        import: '가져오기',
        paste: 'JSON 붙여넣기',
        splits: '구간 기록',
        noHit: '무피격',
        weapons: '무기',
        speedrunMode: '스피드런 모드',
        newPb: '개인 신기록!',
        stage: '스테이지',
        chooseStage: '스테이지 선택',
        dailyChallenge: '일일 챌린지',
        dailyToday: '오늘의 챌린지',
        shareDaily: '결과 공유',
        copied: '클립보드에 복사됨',
        copyManual: '수동으로 복사하세요',
        damageNumbers: '데미지 숫자 표시',
        touchButtonScale: '터치 버튼 크기',
        viewStreak: '연속 기록 보기',
        dailyStreak: '일일 연속 기록',
        currentStreak: '현재 연속',
        bestStreak: '최고 연속',
        last14Days: '최근 14일',
        noStreakYet: '아직 일일 챌린지 기록이 없어요 — 오늘 도전해보세요!',
        howToPlayBtn: '플레이 방법',
        helpTitle: '단축키',
        hotkeyHint: '팁: P/Esc 일시정지 · M 음소거 · H 도움말',
        helpKeyMove: '이동',
        helpKeyPause: '일시정지 / 재개',
        helpKeyMute: '음소거',
        helpKeyHelp: '도움말 토글',
        helpKeyLanguage: '언어 전환',
        helpKeySettings: '설정 패널',
        helpKeyConfirm: '확인 / 발사',
        howToTitle: '플레이 방법',
        howToBody1: '자동 공격 게임입니다. WASD나 방향키로 이동하면 무기는 알아서 발사됩니다.',
        howToBody2:
            '초록색 경험치 구슬을 주워 레벨업하세요. 레벨업마다 강화를 하나씩 고를 수 있습니다.',
        howToBody3: '오래 버티면 몇 분 간격으로 보스가 등장합니다.',
        howToBody4: 'P/Esc 일시정지, M 음소거, H 단축키 도움말을 언제든 열 수 있어요.',
        gotIt: '확인',
        tutorialOffer: '환영합니다! 5단계 튜토리얼을 진행할까요?',
        tryTutorial: '튜토리얼 시작',
        skipTutorial: '건너뛰기',
        tutorialSkipHint: 'Esc로 건너뛰기.',
        tutorialDone: '튜토리얼 완료!',
        replayLastRun: '마지막 판 리플레이',
        noReplay: '저장된 리플레이가 없어요 — 한 판 먼저 끝내보세요.',
        replaySpeed: '속도',
        replayPlaying: '리플레이 중 (입력 비활성화)',
        criticalFlash: '치명타 화면 플래시',
        vibration: '진동 (모바일)',
        customizeControls: '키 바인딩 변경',
        remapHint: '항목을 클릭한 뒤 원하는 키를 누르세요.',
        pressAnyKey: '아무 키나 누르세요…',
        keymapConflict: '키 바인딩이 충돌합니다',
        resetDefaults: '기본값으로 초기화',
        cancel: '취소',
        save: '저장',
        remap_up: '위로 이동',
        remap_down: '아래로 이동',
        remap_left: '왼쪽 이동',
        remap_right: '오른쪽 이동',
        remap_pause: '일시정지 / 재개',
        remap_help: '도움말 토글',
        remap_mute: '음소거'
    }
};

const CURRENT = 'ko';

export function setLocale(_loc) {
    // Locked to Korean — accepted for API compatibility but ignored.
    if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.lang = 'ko';
    }
}

export function getLocale() {
    return CURRENT;
}

export function availableLocales() {
    return [CURRENT];
}

export function t(key) {
    return STRINGS[CURRENT][key] || key;
}

/**
 * Kept as a no-op detector for backwards compatibility with callers that
 * still pass `setLocale(detectLocale())` during boot. Always returns ko now.
 */
export function detectLocale() {
    return CURRENT;
}
