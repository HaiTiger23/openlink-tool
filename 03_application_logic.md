# Logic xử lý ứng dụng

## Main Process (main.js)
- Khởi tạo cửa sổ ứng dụng
- Xử lý IPC giữa main và renderer
- Quản lý menu và shortcuts
- Xử lý file system (đọc/ghi file)

## Preload Script (preload.js)
- Định nghĩa API an toàn cho renderer
- Bridge giữa main và renderer process
- Expose các hàm cần thiết:
  - File operations
  - Link checking
  - Proxy management

## Link Checker Module (link-checker.js)
1. Chức năng cơ bản:
   - Khởi tạo Puppeteer browser
   - Xử lý single link check
   - Quản lý timeout và errors
   - Parse kết quả

2. Puppeteer Cluster:
   - Concurrent link checking
   - Queue management
   - Resource limits
   - Error handling

## Proxy Manager (proxy-manager.js)
1. Chức năng:
   - Lưu trữ danh sách proxy
   - Validate proxy
   - Rotate proxy
   - Apply proxy cho Puppeteer

2. Cấu hình Proxy:
   - Format: host:port hoặc host:port:user:pass
   - Test connection
   - Timeout handling

## Renderer Process (renderer.js)
1. UI Interactions:
   - Event listeners
   - Table management
   - Status updates
   - Progress indicators

2. Data Management:
   - Local storage
   - File import/export
   - Data validation
   - State management

## Error Handling
- Network errors
- Timeout errors
- Proxy errors
- File system errors
- Validation errors
