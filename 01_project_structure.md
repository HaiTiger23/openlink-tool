# Cấu trúc dự án

## Thư mục và file
```
openlink/
├── package.json         # Cấu hình dự án và dependencies
├── main.js             # Process chính của Electron
├── preload.js          # Script preload cho IPC
├── index.html          # Giao diện người dùng
├── styles/
│   └── main.css        # CSS cho giao diện
├── scripts/
│   ├── renderer.js     # Logic xử lý giao diện
│   ├── link-checker.js # Module kiểm tra link
│   └── proxy-manager.js# Module quản lý proxy
└── assets/
    └── icons/          # Icons và resources
```

## Dependencies cần thiết
```json
{
  "electron": "^latest",
  "puppeteer": "^latest",
  "puppeteer-cluster": "^latest"
}
```

## Yêu cầu môi trường
- Node.js >= 18
- Electron
- Puppeteer / Puppeteer-cluster
