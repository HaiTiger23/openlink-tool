const http = require('http');
const https = require('https');
const { URL } = require('url');

class ProxyManager {
    constructor() {
        this.currentProxy = null;
        this.proxyList = [];
    }

    // Thêm proxy vào danh sách
    addProxy(proxyString) {
        // Format: host:port hoặc host:port:username:password
        const parts = proxyString.split(':');
        if (parts.length >= 2) {
            this.proxyList.push(proxyString);
            return true;
        }
        return false;
    }

    // Xóa proxy khỏi danh sách
    removeProxy(proxyString) {
        const index = this.proxyList.indexOf(proxyString);
        if (index > -1) {
            this.proxyList.splice(index, 1);
            return true;
        }
        return false;
    }

    // Set proxy hiện tại
    setCurrentProxy(proxyString) {
        this.currentProxy = proxyString;
        return true;
    }

    // Lấy proxy hiện tại
    getCurrentProxy() {
        return this.currentProxy;
    }

    // Kiểm tra proxy có hoạt động không
    async testProxy(proxyString) {
        return new Promise((resolve) => {
            const [host, port, username, password] = proxyString.split(':');
            const testUrl = new URL('https://www.google.com');

            const options = {
                host: host,
                port: parseInt(port),
                method: 'CONNECT',
                path: `${testUrl.hostname}:443`
            };

            if (username && password) {
                options.headers = {
                    'Proxy-Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
                };
            }

            const req = http.request(options);
            req.setTimeout(10000); // 10 seconds timeout

            req.on('connect', (res, socket) => {
                socket.destroy();
                resolve(res.statusCode === 200);
            });

            req.on('error', () => {
                resolve(false);
            });

            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });

            req.end();
        });
    }

    // Tự động chuyển sang proxy khác
    async rotateProxy() {
        if (this.proxyList.length === 0) {
            return false;
        }

        const currentIndex = this.proxyList.indexOf(this.currentProxy);
        let nextIndex = (currentIndex + 1) % this.proxyList.length;
        let attempts = 0;

        while (attempts < this.proxyList.length) {
            const nextProxy = this.proxyList[nextIndex];
            if (await this.testProxy(nextProxy)) {
                this.currentProxy = nextProxy;
                return true;
            }
            nextIndex = (nextIndex + 1) % this.proxyList.length;
            attempts++;
        }

        return false;
    }

    // Xóa tất cả proxy
    clearProxies() {
        this.proxyList = [];
        this.currentProxy = null;
    }
}

module.exports = new ProxyManager();
