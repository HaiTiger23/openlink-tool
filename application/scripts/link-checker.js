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
            headless: false, // Set to false để hiển thị browser
            defaultViewport: null, // Cho phép cửa sổ browser có kích thước tự động
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--start-maximized' // Maximize cửa sổ browser
            ]
        };

        if (this.proxyConfig) {
            browserOptions.args.push(`--proxy-server=${this.proxyConfig}`);
        }

        // Khởi tạo browser cho single link checking
        this.browser = await puppeteer.launch(browserOptions);

        // Tính toán số worker tối ưu
        const maxWorkers = Math.min(10, navigator.hardwareConcurrency || 4); // Tối đa 10 worker hoặc theo số CPU

        // Khởi tạo cluster cho multiple link checking
        this.cluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_PAGE, // Sử dụng PAGE thay vì CONTEXT để tối ưu hóa bộ nhớ
            maxConcurrency: options.maxConcurrency || maxWorkers,
            puppeteerOptions: browserOptions,
            monitor: true, // Bật monitor để theo dõi tiến trình
            timeout: 30000, // Timeout cho mỗi task
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
                timeout: 30000 
            });
            
            const html = await page.content();
            const hasSuccess = html.includes("New IP"); // Kiểm tra nội dung HTML để xác định thành công
            
            return {
                url,
                success: hasSuccess,
                status: hasSuccess ? 'success' : 'error',
                statusText: hasSuccess ? '✅ Thành công' : '❌ Không tìm thấy',
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
}

module.exports = new LinkChecker();
