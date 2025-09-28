const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getClusterInfo: async () => ipcRenderer.invoke('cluster:getInfo'),
    setMaxConcurrency: (value) => ipcRenderer.invoke('set-max-concurrency', value),
    
    // File operations
    openFile: async () => ipcRenderer.invoke('dialog:openFile'),
    saveFile: async () => ipcRenderer.invoke('dialog:saveFile'),
    readFile: async (filePath) => ipcRenderer.invoke('file:read', filePath),
    saveToFile: async (filePath, data) => ipcRenderer.invoke('file:write', { filePath, data }),

    // Link checking operations
    checkLink: async (link) => {
        try {
            const result = await ipcRenderer.invoke('link:check', link);
            return result;
        } catch (error) {
            throw new Error(`Error checking link: ${error.message}`);
        }
    },

    checkMultipleLinks: async (links, onProgress) => {
        try {
            // Lắng nghe progress events nếu có callback
            let progressHandler = null;
            if (onProgress) {
                progressHandler = (event, data) => {
                    onProgress(data.result, data.index);
                };
                ipcRenderer.on('link:progress', progressHandler);
            }
            
            const results = await ipcRenderer.invoke('links:checkMultiple', links);
            
            // Xóa listener sau khi hoàn thành
            if (progressHandler) {
                ipcRenderer.removeListener('link:progress', progressHandler);
            }
            
            return results;
        } catch (error) {
            throw new Error(`Error checking multiple links: ${error.message}`);
        }
    }
});
