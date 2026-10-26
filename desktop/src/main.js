/* Головний процес оболонки «Ходу героям нема».
   1) показує вікно-лаунчер, 2) підтягує свіжу версію гри з GitHub,
   3) запускає гру з диска через протокол hhn://game/,
   4) у фоні перевіряє оновлення самої оболонки (electron-updater, GitHub Releases). */
const { app, BrowserWindow, protocol, net, ipcMain, shell, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const cfg = require('./config');
const { GameUpdater } = require('./game-updater');
const { Lan, addresses } = require('./lan');

// Дані в %APPDATA%\HoduHeroyamNema (латиницею, без пробілів)
// HHN_PROFILE=2 — друга копія програми на тому самому ПК (щоб перевірити гру по мережі самому)
const profile = (process.env.HHN_PROFILE || '').replace(/[^\w-]/g, '');
app.setPath('userData', path.join(app.getPath('appData'), cfg.DATA_DIR_NAME + (profile ? '-' + profile : '')));
app.setAppUserModelId('ua.kolia.hodu-heroyam-nema');

protocol.registerSchemesAsPrivileged([
  { scheme: 'hhn', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

const LOG_FILE = () => path.join(app.getPath('userData'), 'launcher.log');
function log(...a) {
  const line = `[${new Date().toISOString()}] ${a.join(' ')}\n`;
  try {
    fs.appendFileSync(LOG_FILE(), line);
  } catch {}
  if (!app.isPackaged) process.stdout.write(line);
}

let win = null;
let gameDir = null;
let state = { stage: 'starting' };

const bundledDir = app.isPackaged
  ? path.join(process.resourcesPath, 'game')
  : path.join(__dirname, '..', '..', 'game', 'dist');

const updater = new GameUpdater({
  dataDir: app.getPath('userData'),
  bundledDir,
  manifestUrl: cfg.MANIFEST_URL,
  shellVersion: app.getVersion(),
  fetch: (url, opts) => net.fetch(url, opts),
  timeoutMs: cfg.MANIFEST_TIMEOUT_MS,
  keep: cfg.KEEP_VERSIONS,
  log,
});

function send(s) {
  state = { ...state, ...s };
  if (win && !win.isDestroyed()) win.webContents.send('launcher:status', state);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#120e0c',
    show: false,
    title: 'Ходу героям нема!',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win.show());

  // Посилання на зовнішні сайти відкриваємо в браузері, а не в грі
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('hhn://') || url.startsWith('file://')) return;
    e.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
  });

  // F11 — повний екран, F12 — інструменти розробника, Ctrl+R / F5 — перезапуск сторінки
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    } else if (input.key === 'F12') {
      win.webContents.toggleDevTools();
      e.preventDefault();
    } else if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      win.webContents.reload();
      e.preventDefault();
    }
  });

  win.webContents.on('did-start-navigation', (_e, _url, inPlace, isMainFrame) => {
    if (isMainFrame && !inPlace && lan.mode) lan.leave().catch(() => {});
  });

  win.loadFile(path.join(__dirname, 'launcher.html'));
}

function serveGame() {
  protocol.handle('hhn', req => {
    const u = new URL(req.url);
    if (u.host !== 'game' || !gameDir) return new Response('Not found', { status: 404 });
    let rel = decodeURIComponent(u.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.resolve(gameDir, '.' + rel);
    if (!file.startsWith(gameDir + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

async function launch() {
  send({ stage: 'checking', error: null });
  const r = await updater.run(s => send(s));
  log('результат оновлення:', r.result, r.game ? `${r.game.version} (${r.game.source})` : 'гри немає', r.error || '');
  if (!r.game) {
    send({
      stage: 'error',
      error:
        'Не вдалося завантажити гру. Перевірте інтернет і натисніть «Спробувати ще раз». ' + (r.error ? `(${r.error})` : ''),
    });
    return;
  }
  gameDir = path.resolve(r.game.dir);
  state.game = { version: r.game.version, source: r.game.source, result: r.result };
  send({ stage: 'starting', version: r.game.version, note: noteFor(r) });
  // коротка пауза, щоб було видно, що оновилося
  await new Promise(res => setTimeout(res, r.result === 'updated' ? 900 : 250));
  await win.loadURL('hhn://game/index.html');
  checkShellUpdate();
}

function noteFor(r) {
  if (r.result === 'updated') return `Гру оновлено до версії ${r.game.version}`;
  if (r.result === 'offline') return 'Немає зв’язку з GitHub — запускаю збережену версію';
  if (r.result === 'failed') return 'Оновлення не вдалося — запускаю попередню версію';
  if (r.result === 'shell-too-old') return 'Для нової версії гри потрібне оновлення програми — воно завантажується у фоні';
  return null;
}

/* ---------- оновлення самої оболонки (.exe) ---------- */
let shellUpdateChecked = false;
function checkShellUpdate() {
  if (shellUpdateChecked || !app.isPackaged || process.env.HHN_NO_SHELL_UPDATE) return;
  shellUpdateChecked = true;
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (e) {
    log('electron-updater недоступний:', e.message);
    return;
  }
  autoUpdater.logger = { info: m => log('[shell]', m), warn: m => log('[shell]', m), error: m => log('[shell]', m), debug: () => {} };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', async info => {
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Перезапустити зараз', 'Пізніше'],
      defaultId: 0,
      cancelId: 1,
      title: 'Оновлення програми',
      message: `Завантажено нову версію програми ${info.version}.`,
      detail: 'Вона встановиться під час перезапуску. Якщо оберете «Пізніше» — встановиться, коли закриєте гру.',
    });
    if (response === 0) autoUpdater.quitAndInstall(true, true);
  });
  autoUpdater.on('error', e => log('[shell] помилка:', e && e.message));
  autoUpdater.checkForUpdates().catch(e => log('[shell] перевірка не вдалася:', e.message));
}

/* ---------- гра по мережі ---------- */
const lan = new Lan({
  emit: ev => { if (win && !win.isDestroyed()) win.webContents.send('net:event', ev); },
  log,
});
// Помилки повертаємо як {error}, щоб гра показала зрозумілий текст без службових префіксів
const safe = fn => async (_e, arg) => {
  try { return { ok: true, ...(await fn(arg || {})) }; }
  catch (e) { log('[lan]', e.message); return { ok: false, error: e.message }; }
};
ipcMain.handle('net:host', safe(o => lan.host({ port: o.port, name: o.name, gv: o.gv })));
ipcMain.handle('net:join', safe(o => lan.join({ addr: o.addr, name: o.name, gv: o.gv })));
ipcMain.handle('net:leave', safe(async () => { await lan.leave(); return {}; }));
ipcMain.handle('net:set', safe(o => ({ sent: lan.set(o.data) })));
ipcMain.handle('net:seat', safe(o => { lan.seat(o.seat); return {}; }));
ipcMain.handle('net:status', safe(() => lan.status()));
ipcMain.handle('net:addresses', safe(() => ({ addresses: addresses() })));
app.on('before-quit', () => { lan.leave().catch(() => {}); });

/* ---------- IPC ---------- */
ipcMain.handle('hhn:info', () => ({
  shellVersion: app.getVersion(),
  game: state.game || null,
  platform: process.platform,
}));
ipcMain.handle('launcher:state', () => state);
ipcMain.handle('launcher:retry', () => {
  if (state.stage === 'error') launch();
});

/* ---------- старт ---------- */
app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
app.on('window-all-closed', () => app.quit());

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  serveGame();
  createWindow();
  win.webContents.once('did-finish-load', () => launch().catch(e => {
    log('збій запуску:', e.stack || e.message);
    send({ stage: 'error', error: 'Збій запуску: ' + e.message });
  }));
});
