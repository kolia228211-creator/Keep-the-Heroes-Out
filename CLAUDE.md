# Нотатки для Claude

Відповідай українською. Користувач не програміст: пояснюй коротко і без жаргону.

- Код гри — `game/src/*` (спільний для сайту й програми). Збірка: `node game/build.js` (програма) / `--web` (сайт). Після змін у грі запускай `cd desktop && npm test` — там і димовий тест гри (випадкові партії всіх 20 сценаріїв у jsdom).
- Програма — `desktop/` (Electron). Гра вантажиться з `hhn://game/` (стабільне походження → localStorage зберігається між версіями). У гри є `window.hhn` (preload), Node недоступний.
- Оновлення гри: `cd desktop && npm run game:release -- X.Y.Z`, потім commit + push `game/` і `updates/`. Не редагуй `updates/game.json` руками.
- Оновлення програми: підняти `desktop/package.json` version → тег `vX.Y.Z` → GitHub Actions збирає NSIS на windows-latest і публікує Release (electron-updater).
- `npm test` у `desktop/` — тести оновлювача. Локально .exe не збирається (немає wine) — це нормально, збирає CI.
- План робіт і рішення — `claude/HANDOFF-desktop.md` у Проєкті claude.ai.
