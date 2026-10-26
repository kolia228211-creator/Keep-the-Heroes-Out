// Налаштування оболонки. Репозиторій, звідки беруться оновлення гри.
const OWNER = 'kolia228211-creator';
const REPO = 'keep-the-heroes-out';
const BRANCH = 'main';

module.exports = {
  OWNER,
  REPO,
  // Маніфест пакета гри: версія, файл zip, контрольна сума. Лежить у репозиторії в updates/game.json.
  // Для тестів можна підмінити змінною середовища HHN_MANIFEST_URL.
  MANIFEST_URL:
    process.env.HHN_MANIFEST_URL ||
    `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/updates/game.json`,
  // Скільки чекати відповіді GitHub, перш ніж запускати гру без оновлення.
  MANIFEST_TIMEOUT_MS: 8000,
  // Скільки версій гри тримати на диску (поточна + попередня на випадок збою).
  KEEP_VERSIONS: 2,
  // Папка даних: %APPDATA%\HoduHeroyamNema
  DATA_DIR_NAME: 'HoduHeroyamNema',
};
