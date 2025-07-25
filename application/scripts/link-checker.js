const puppeteer = require('puppeteer');
const { Cluster } = require('puppeteer-cluster');

class LinkChecker {
    constructor() {
        this.browser = null;
        this.cluster = null;
        this.proxyConfig = null;
    }

    async initialize(options = {}) {
        const browserOptions = {
            headless: "new", // Set to false để hiển thị browser
            defaultViewport: null, // Cho phép cửa sổ browser có kích thước tự động
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--start-maximized' // Maximize cửa sổ browser
            ]
        };

        // Khởi tạo browser cho single link checking
        this.browser = await puppeteer.launch(browserOptions);

        // Cho phép truyền số worker động qua options.maxConcurrency
        const maxWorkers = typeof options.maxConcurrency === 'number' && options.maxConcurrency > 0 ? options.maxConcurrency : 5;

        // Khởi tạo cluster cho multiple link checking
        this.cluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_PAGE, // Sử dụng PAGE thay vì CONTEXT để tối ưu hóa bộ nhớ
            maxConcurrency: maxWorkers,
            puppeteerOptions: browserOptions,
            monitor: true, // Bật monitor để theo dõi tiến trình
            timeout: 120000, // Timeout cho mỗi task
            retryLimit: 1, // Số lần thử lại nếu fail
            retryDelay: 1000, // Delay giữa các lần thử lại
        });

        // Định nghĩa task cho cluster
        await this.cluster.task(async ({ page, data: url }) => {
            return await this.checkSingleLink(page, url);
        });
    }

    async checkSingleLink(page, url) {
        const startTime = Date.now();
        try {
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 120000 // Tăng timeout lên 120 giây
            });

            let isLoaded = false;
            let timeCheck = 0;
            do {
                isLoaded = await page.evaluate(() => {
                    const isLoaded = document.querySelector('#loading');
                    return isLoaded ? isLoaded.style.display === 'none' : false;
                });
                // console.log('Waiting for page to load...');
                await this.sleep(1000); // Chờ 1 giây trước khi kiểm tra lại
                timeCheck++;;
            } while (!isLoaded && timeCheck < 60); // Tăng thời gian chờ lên 60 giây
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

    async checkBatch(urls) {
        // Queue tất cả các URLs và thu thập kết quả
        const results = await Promise.all(
            urls.map(url => this.cluster.execute(url))
        );
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
