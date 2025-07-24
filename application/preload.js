const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getClusterInfo: async () => ipcRenderer.invoke('cluster:getInfo'),
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
    
    checkMultipleLinks: async (links) => {
        try {
            return await ipcRenderer.invoke('links:checkMultiple', links);
        } catch (error) {
            throw new Error(`Error checking multiple links: ${error.message}`);
        }
    }
});
