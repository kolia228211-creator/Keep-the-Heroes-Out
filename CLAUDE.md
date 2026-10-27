# Нотатки для Claude

Відповідай українською. Користувач не програміст: пояснюй коротко і без жаргону.

- Код гри — `game/src/*` (спільний для сайту й програми). Збірка: `node game/build.js` (програма) / `--web` (сайт). Після змін у грі запускай `cd desktop && npm test` — там і димовий тест гри (випадкові партії всіх 20 сценаріїв у jsdom).
- Програма — `desktop/` (Electron). Гра вантажиться з `hhn://game/` (стабільне походження → localStorage зберігається між версіями). У гри є `window.hhn` (preload), Node недоступний.
- Гра по мережі: `desktop/src/lan.js` (ws-сервер у хоста, порт 47777; та сама модель, що онлайн-кімнати сайту — спільний документ {s,fr,v,by}) + `game/src/net.js` (меню, `window.hhn.net`). На сайті `LAN=null` — працюють кімнати claude.ai. Тест двох гравців — `desktop/test/lan-game.test.js`.
- Оновлення гри: спершу додай запис версії в `game/src/changes.js` (вікно «Що нового» — гравці бачать його після оновлення; без запису скрипт не випустить), потім `cd desktop && npm run game:release -- X.Y.Z`, потім commit + push `game/` і `updates/`. Не редагуй `updates/game.json` руками.
- Оновлення програми: підняти `desktop/package.json` version → push у main → GitHub Actions бачить, що релізу vX.Y.Z немає, збирає NSIS на windows-latest і публікує Release (electron-updater). Теги з цієї сесії пушити не можна (403) — і не треба.
- `npm test` у `desktop/` — тести оновлювача. Локально .exe не збирається (немає wine) — це нормально, збирає CI.
- План робіт і рішення — `claude/HANDOFF-desktop.md` у Проєкті claude.ai.
