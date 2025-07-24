const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const linkChecker = require('./scripts/link-checker');
const proxyManager = require('./scripts/proxy-manager');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(async () => {
  createWindow();
  
  // Khởi tạo Link Checker
  await linkChecker.initialize({
    maxConcurrency: 2
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  await linkChecker.cleanup();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Link checking handlers
ipcMain.handle('link:check', async (event, url) => {
  const page = await linkChecker.browser.newPage();
  try {
    const result = await linkChecker.checkSingleLink(page, url);
    await page.close();
    return result;
  } catch (error) {
    await page.close();
    throw error;
  }
});

ipcMain.handle('links:checkMultiple', async (event, urls) => {
  return await linkChecker.checkBatch(urls);
});

// Proxy handlers
ipcMain.handle('proxy:set', async (event, proxyConfig) => {
  const isValid = await proxyManager.testProxy(proxyConfig);
  if (isValid) {
    proxyManager.setCurrentProxy(proxyConfig);
    linkChecker.setProxy(proxyConfig);
    return true;
  }
  return false;
});

// File operation handlers
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Text Files', extensions: ['txt'] }
    ]
  });
  if (!canceled) {
    return filePaths[0];
  }
});

ipcMain.handle('dialog:saveFile', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    filters: [
      { name: 'CSV', extensions: ['csv'] },
      { name: 'JSON', extensions: ['json'] }
    ]
  });
  if (!canceled) {
    return filePath;
  }
});

ipcMain.handle('file:read', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content.split('\n').filter(line => line.trim());
  } catch (error) {
    throw new Error(`Error reading file: ${error.message}`);
  }
});

ipcMain.handle('file:write', async (event, { filePath, data }) => {
  try {
    await fs.writeFile(filePath, data);
    return true;
  } catch (error) {
    throw new Error(`Error writing file: ${error.message}`);
  }
});
