#!/usr/bin/env node
const fs = require('fs');
const readline = require('readline');
const { firefox } = require('playwright');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function menu() {
  console.log(`
🔗 Tool kiểm tra trạng thái URL
1. Nhập file link (links.txt)
2. Xuất kết quả (output.json)
3. Chạy kiểm tra toàn bộ link
0. Thoát
`);
  rl.question("👉 Nhập lựa chọn: ", async (choice) => {
    switch (choice.trim()) {
      case '1':
        console.log("📥 Đã đọc link từ links.txt");
        menu();
        break;
      case '2':
        console.log("📤 Đã xuất kết quả ra output.json");
        menu();
        break;
      case '3':
        await checkLinks();
        menu();
        break;
      case '0':
        rl.close();
        break;
      default:
        console.log("⚠️ Lựa chọn không hợp lệ");
        menu();
        break;
    }
  });
}

async function checkLinks() {
  const links = fs.readFileSync('links.txt', 'utf-8').split('\n').map(x => x.trim()).filter(Boolean);
  console.log(`🚀 Đang kiểm tra ${links.length} link...\n`);
  const browser = await firefox.launch();
  const results = [];

  await Promise.all(links.map(async (link, index) => {
    const page = await browser.newPage();
    try {
      await page.goto(link, { timeout: 15000 });
      const content = await page.content();
      const ok = content.includes("Thành công");
      console.log(`${index + 1}. ${link} => ${ok ? "✔ Thành công" : "❌ Không tìm thấy"}`);
      results.push({ link, status: ok ? "Success" : "Fail" });
    } catch (err) {
      console.log(`${index + 1}. ${link} => ❌ Lỗi khi tải trang`);
      results.push({ link, status: "Error" });
    } finally {
      await page.close();
    }
  }));

  await browser.close();
  fs.writeFileSync('output.json', JSON.stringify(results, null, 2), 'utf-8');
}

menu();
