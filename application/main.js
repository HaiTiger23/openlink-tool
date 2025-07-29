const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const chromeLauncher = require('chrome-launcher');
const path = require('path');
const fs = require('fs').promises;
const linkChecker = require('./scripts/link-checker');
const proxyManager = require('./scripts/proxy-manager');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    resizable: false,
    maximizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');

  // Custom menu: Tác giả Hải Dev
  const menuTemplate = [
    {
      label: 'Tác giả: Hải Dev',
      click: () => {
        shell.openExternal('https://www.facebook.com/haitiger23');
      }
    }
  ];
  const customMenu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(customMenu);

  // Chặn F5, Ctrl+R, F12
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F5' || (input.key.toLowerCase() === 'r' && input.control)) {
      event.preventDefault();
    }
    if (input.key === 'F12') {
      event.preventDefault();
    }
  });
}



app.whenReady().then(async () => {
  // Kiểm tra Chrome/Chromium khi app khởi động
  const chromePaths = chromeLauncher.Launcher.getInstallations();
  if (!chromePaths || chromePaths.length === 0) {
    dialog.showMessageBoxSync({
      type: 'error',
      title: 'Thiếu Chrome/Chromium',
      message: 'Không tìm thấy Chrome hoặc Chromium trên máy.\n\nVui lòng tải và cài đặt Google Chrome để sử dụng phần mềm!\n\nTải tại: https://www.google.com/chrome/'
    });
    app.quit();
    return;
  }
  createWindow();

  // Khởi tạo Link Checker
  await linkChecker.initialize({
    maxConcurrency: 10
  });
  let maxConcurrency = 10;

  ipcMain.handle('set-max-concurrency', async (event, value) => {
    if (typeof value === 'number' && value > 0 && value <= 50) {
      maxConcurrency = value;
      // Khởi tạo lại cluster với maxConcurrency mới
      await linkChecker.cleanup();
      await linkChecker.initialize({ maxConcurrency });
      return { success: true };
    }
    return { success: false, message: 'Giá trị không hợp lệ' };
  });

  // Khi app ready, khởi tạo cluster lần đầu
  app.whenReady().then(async () => {
    await linkChecker.initialize({ maxConcurrency });
    // ...existing code...
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
  try {
    const result = await linkChecker.cluster.execute(url);
    return result;
  } catch (error) {

    return {
      url,
      success: false,
      status: 'error',
      statusText: `❌ Lỗi: ${error.message}`,
      error: error,
      time: '0.00'
    };
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

// Cluster info handler
ipcMain.handle('cluster:getInfo', async () => {
  if (!linkChecker.cluster) {
    return {
      maxConcurrency: 0,
      currentlyRunning: 0,
      queueLength: 0,
      status: 'Chưa khởi tạo'
    };
  }
  try {
    const cluster = linkChecker.cluster;
    return {
      maxConcurrency: cluster.options.maxConcurrency,
      currentlyRunning: cluster.workers && cluster.workers.length ? cluster.workers.filter(w => w.isBusy).length : 0,
      queueLength: cluster.queue ? cluster.queue.length : 0,
      status: cluster.isClosed ? 'Đã đóng' : 'Đang chạy'
    };
  } catch (err) {
    throw new Error('Không lấy được thông tin cluster: ' + err.message);
  }
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
      { name: 'Text', extensions: ['txt'] },
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
