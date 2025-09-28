const { Cluster } = require('puppeteer-cluster');

class LinkChecker {
    constructor() {
        this.browser = null;
        this.cluster = null;
        this.proxyConfig = null;
    }

    async initialize(options = {}) {
        console.log('LinkChecker.initialize nhận options:', options);
        const browserOptions = {
            // executablePath: "D:\\tool\\openlink\\application\\chrome-headless-shell\\win64-138.0.7204.168\\chrome-headless-shell-win64\\chrome-headless-shell.exe",
            headless: false,           // Chạy headless
            defaultViewport: null,     // Không fix viewport

            args: [
                '--window-size=200,500',
                '--no-sandbox',
                '--disable-setuid-sandbox',    // Bỏ sandbox để tránh lỗi quyền
                '--disable-gpu',               // Bỏ GPU
                '--disable-extensions',        // Không load extension
                '--disable-background-networking', // Chặn kết nối nền
                '--disable-sync',              // Không sync
                '--disable-default-apps',      // Không load app mặc định
                '--disable-translate',         // Bỏ Google Translate
                '--hide-scrollbars',           // Ẩn scrollbar (tăng nhẹ hiệu năng)
                '--mute-audio',                // Tắt audio
                '--disable-dev-shm-usage',     // Fix lỗi bộ nhớ trên Linux/Docker
                '--disable-web-security',      // Tắt web security để tránh CORS
                '--disable-features=VizDisplayCompositor', // Tắt một số tính năng không cần thiết
                '--disable-background-timer-throttling', // Tắt throttle timer
                '--disable-renderer-backgrounding', // Tắt background rendering
                '--disable-backgrounding-occluded-windows', // Tắt backgrounding
                '--disable-ipc-flooding-protection', // Tắt IPC flooding protection
                '--disable-hang-monitor', // Tắt hang monitor
                '--disable-prompt-on-repost', // Tắt prompt on repost
                '--disable-domain-reliability', // Tắt domain reliability
                '--disable-component-extensions-with-background-pages', // Tắt component extensions
                '--disable-client-side-phishing-detection', // Tắt phishing detection
                '--disable-sync-preferences', // Tắt sync preferences
                '--disable-features=TranslateUI', // Tắt translate UI
                '--aggressive-cache-discard', // Aggressive cache discard
                '--memory-pressure-off', // Tắt memory pressure
                '--max_old_space_size=4096', // Tăng heap size
                // Network throttling để giảm tải mạng
                '--disable-background-networking', // Tắt background networking
                '--disable-background-timer-throttling', // Tắt background timer
                '--disable-renderer-backgrounding', // Tắt renderer backgrounding
                '--disable-backgrounding-occluded-windows', // Tắt backgrounding occluded windows
                '--disable-features=TranslateUI', // Tắt translate UI
                '--disable-ipc-flooding-protection', // Tắt IPC flooding protection
                '--disable-hang-monitor', // Tắt hang monitor
                '--disable-prompt-on-repost', // Tắt prompt on repost
                '--disable-domain-reliability', // Tắt domain reliability
                '--disable-component-extensions-with-background-pages', // Tắt component extensions
                '--disable-client-side-phishing-detection', // Tắt phishing detection
                '--disable-sync-preferences', // Tắt sync preferences
                '--disable-features=TranslateUI', // Tắt translate UI
                '--aggressive-cache-discard', // Aggressive cache discard
                '--memory-pressure-off', // Tắt memory pressure
                '--max_old_space_size=4096' // Tăng heap size
            ]
        };

        // Cho phép truyền số tab đồng thời qua options.maxConcurrency
        const maxWorkers = typeof options.maxConcurrency === 'number' && options.maxConcurrency > 0 ? options.maxConcurrency : 5;
        console.log('LinkChecker sử dụng maxWorkers:', maxWorkers, 'từ options.maxConcurrency:', options.maxConcurrency);
        if (this.cluster) {
            await this.cluster.close();
        }
        // Khởi tạo cluster với số tab đồng thời từ bên ngoài
        this.cluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_PAGE, // Sử dụng PAGE thay vì CONTEXT để tối ưu hóa bộ nhớ
            maxConcurrency: maxWorkers, // Số tab mở đồng thời từ bên ngoài
            puppeteerOptions: {
                ...browserOptions,
                // Thêm connection pooling
                protocolTimeout: 120000,
                slowMo: 0, // Không delay để không ảnh hưởng logic chờ IP
            },
            monitor: true, // Bật monitor để theo dõi tiến trình
            timeout: 120000, // Tăng timeout lên 120 giây để đợi IP thay đổi
            retryLimit: 2, // Giữ retry limit hợp lý
            retryDelay: 1000, // Giữ delay hợp lý
            sameDomainDelay: 1000, // Delay giữa các request cùng domain
            skipDuplicateUrls: true, // Bỏ qua URL trùng lặp
        });

        // Định nghĩa task cho cluster
        await this.cluster.task(async ({ page, data: url }) => {
            return await this.checkSingleLink(page, url);
        });

        // Debug: Kiểm tra maxConcurrency
        console.log('Cluster initialized with maxConcurrency:', this.cluster.options.maxConcurrency);
    }

    async checkSingleLink(page, url) {
        const startTime = Date.now();
        
        // Debug: Kiểm tra số tab đang chạy
        if (this.cluster && this.cluster.workers) {
            const activeWorkers = this.cluster.workers.filter(w => w.isBusy).length;
            console.log('Active workers:', activeWorkers, 'of', this.cluster.options.maxConcurrency);
        }
        
        try {
            // Thêm network throttling để giảm tải mạng
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                // Chặn các resource không cần thiết để giảm tải mạng
                if (request.resourceType() === 'image' || 
                    request.resourceType() === 'stylesheet' || 
                    request.resourceType() === 'font' ||
                    request.resourceType() === 'media') {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            await page.goto(url, {
                waitUntil: 'networkidle2', // Khôi phục lại networkidle2 để đợi IP thay đổi
                timeout: 120000 // Tăng timeout lên 120 giây để đợi IP thay đổi
            });

            let isLoaded = false;
            let timeCheck = 0;
            do {
                isLoaded = await page.evaluate(() => {
                    const isLoaded = document.querySelector('#loading');
                    return isLoaded ? isLoaded.style.display === 'none' : false;
                });
                // console.log('Waiting for page to load...');
                await this.sleep(1000); // Khôi phục lại 1 giây để đợi IP thay đổi
                timeCheck++;
            } while (!isLoaded && timeCheck < 60); // Khôi phục lại 60 lần (60 giây) để đợi IP thay đổi
            let old_ip = await page.evaluate(() => {
                const old_ip = document.querySelector('#oldIp');
                return old_ip ? old_ip.textContent.trim() : null;
            }
            );
            let new_ip = await page.evaluate(() => {
                const new_ip = document.querySelector('#result');
                return new_ip ? new_ip.textContent.trim() : null;
            }
            );
            console.log("url checked:", url, "old_ip:", old_ip, "new_ip:", new_ip);
            if (!new_ip || !old_ip) {
                return {
                    url,
                    success: false,
                    status: 'error',
                    statusText: '❌ Không tìm thấy thông tin IP',
                    old_ip: old_ip || 'Không tìm thấy',
                    new_ip: new_ip || 'Không tìm thấy',
                    time: ((Date.now() - startTime) / 1000).toFixed(2)
                };
            }
            new_ip = new_ip.split(':')[1].trim();
            old_ip = old_ip.split(':')[1].trim();

            const hasSuccess = old_ip !== new_ip; // Kiểm tra nội dung HTML để xác định thành công
            // check new ip có phải dạng 1 ip không
            const isIP = new_ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
            if (!isIP) {
                return {
                    url,
                    success: false,
                    status: 'error',
                    statusText: '❌ Không tìm thấy thông tin IP',
                    old_ip: old_ip,
                    new_ip: new_ip,
                    time: ((Date.now() - startTime) / 1000).toFixed(2)
                };
            }
            return {
                url,
                success: hasSuccess,
                status: hasSuccess ? 'success' : 'error',
                statusText: hasSuccess ? '✅ Thành công' : '❌ Không tìm thấy',
                old_ip: old_ip,
                new_ip: new_ip,
                time: ((Date.now() - startTime) / 1000).toFixed(2)
            };
        } catch (error) {
            return {
                url,
                success: false,
                status: 'error',
                statusText: `❌ Lỗi: ${error.message}`,
                time: ((Date.now() - startTime) / 1000).toFixed(2)
            };
        }
    }

    async checkBatch(urls, onProgress = null) {
        // Xử lý tất cả URLs cùng lúc, cluster tự quản lý concurrency
        const results = [];
        
        // Debug: Kiểm tra số URLs và maxConcurrency
        console.log('Processing URLs:', urls.length, 'with maxConcurrency:', this.cluster ? this.cluster.options.maxConcurrency : 'Cluster not initialized');
        
        // Tạo promises cho tất cả URLs
        const promises = urls.map(async (url, index) => {
            try {
                const result = await this.cluster.execute(url);
                // Gọi callback ngay khi có kết quả
                if (onProgress) {
                    onProgress(result, index);
                }
                return result;
            } catch (error) {
                const errorResult = {
                    url,
                    success: false,
                    status: 'error',
                    statusText: '❌ Lỗi: ' + error.message,
                    time: '0.00'
                };
                // Gọi callback ngay khi có lỗi
                if (onProgress) {
                    onProgress(errorResult, index);
                }
                return errorResult;
            }
        });
        
        // Đợi tất cả hoàn thành
        const allResults = await Promise.allSettled(promises);
        
        // Lấy kết quả từ Promise.allSettled
        allResults.forEach(result => {
            if (result.status === 'fulfilled') {
                results.push(result.value);
            } else {
                results.push({
                    url: 'unknown',
                    success: false,
                    status: 'error',
                    statusText: '❌ Lỗi: ' + result.reason,
                    time: '0.00'
                });
            }
        });
        
        return results;
    }

    setProxy(proxyString) {
        this.proxyConfig = proxyString;
        return true;
    }

    async cleanup() {
        if (this.cluster) {
            await this.cluster.idle();
            await this.cluster.close();
        }
        if (this.browser) {
            await this.browser.close();
        }
    }
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new LinkChecker();
