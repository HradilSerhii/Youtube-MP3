const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

const downloader = require('./src/downloader');
const menuBuilder = require('./src/menu-builder');

const PROTOCOL_CLIENT = 'yt2mp3app';

app.disableHardwareAcceleration();
app.setAsDefaultProtocolClient(PROTOCOL_CLIENT);

let deepLinkUrl;
let mainWindow;

const gotTheLock = app.requestSingleInstanceLock();
if (gotTheLock) {
  app.on('second-instance', (e, argv) => {
    if (process.platform === 'win32') {
      deepLinkUrl = argv.slice(2);
      downloadFromDeepLink(deepLinkUrl);
    }

    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
} else {
  app.quit();
  return;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html')).then(r => {
    if (process.platform === 'win32') {
      deepLinkUrl = process.argv.slice(1);
    }

    if (deepLinkUrl) {
      downloadFromDeepLink(deepLinkUrl);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  menuBuilder.setMenu();
}

app.on('open-url', function (event, url) {
  if (!mainWindow) {
    createWindow();
  }
  event.preventDefault();
  deepLinkUrl = url;
  downloadFromDeepLink(deepLinkUrl);
});

app.whenReady().then(() => {
  ipcMain.on('download-invoked', (event, url) => {
    downloader.startDownload(url, event);
  });

  ipcMain.on('restart_app', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.on('download-progress', (event, data) => {
    if (mainWindow) {
      mainWindow.setProgressBar(data / 100);
    }
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0 || mainWindow === null) {
      createWindow();
    }
  });

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('ready', function () {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-downloaded', (info) => {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow) {
        focusedWindow.webContents.send('update_downloaded', info);
      }
    });
  });
});

function downloadFromDeepLink(deepLink) {
  const protocolClient = `${PROTOCOL_CLIENT}://`;

  if (deepLink.toString().indexOf(protocolClient) !== -1) {
    let param = deepLink.toString().substring(protocolClient.length);
    if (mainWindow) {
      mainWindow.webContents.send('deeplink_download', param);
    }
  }
}
