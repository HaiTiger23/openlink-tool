package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/chromedp/chromedp"
)

func main() {
	// Nhập từ người dùng
	fmt.Println("Dán list link vào đây (kết thúc bằng dòng trống):")

	var links []string
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			break
		}
		links = append(links, line)
	}

	if len(links) == 0 {
		fmt.Println("Không có link nào cả 😢")
		return
	}

	// Khởi tạo context Chrome
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
	)
	ctx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancel()

	ctx, cancel = chromedp.NewContext(ctx)
	defer cancel()

	// Chạy đa luồng, tối đa 10 goroutine cùng lúc
	maxConcurrency := 5
	sem := make(chan struct{}, maxConcurrency)
	done := make(chan struct{})
	type Result struct {
		Link   string
		Status string
		OldIP  string
		NewIP  string
	}
	results := make([]Result, len(links))

	for idx, link := range links {
		sem <- struct{}{} // chiếm slot
		go func(idx int, link string) {
			defer func() { <-sem; done <- struct{}{} }()
			// Tạo context riêng cho mỗi link
			opts := append(chromedp.DefaultExecAllocatorOptions[:],
				chromedp.Flag("headless", true),
				chromedp.Flag("disable-gpu", true),
				chromedp.Flag("no-sandbox", true),
			)
			ctx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
			defer cancel()
			ctx, cancel = chromedp.NewContext(ctx)
			defer cancel()

			fmt.Println("Đang kiểm tra:", link)
			var oldIP, newIP string
			var body string
			err := chromedp.Run(ctx,
				chromedp.Navigate(link),
			)
			status := "error"
			if err != nil {
				fmt.Println("Lỗi khi load trang:", err)
				fmt.Println("----------")
				results[idx] = Result{Link: link, Status: status, OldIP: "", NewIP: ""}
				return
			}

			// Vòng lặp chờ #loading ẩn đi (tối đa 60 lần, mỗi lần 1s)
			loaded := false
			for i := 0; i < 60; i++ {
				var display string
				err = chromedp.Run(ctx,
					chromedp.EvaluateAsDevTools(`(function(){
						var el = document.querySelector('#loading');
						return el ? el.style.display : 'none';
					})()`, &display),
				)
				if err != nil {
					fmt.Println("❌ Lỗi khi kiểm tra loading:", err)
					break
				}
				if display == "none" {
					loaded = true
					break
				}
				time.Sleep(1 * time.Second)
			}

			if !loaded {
				fmt.Println("❌ Quá thời gian chờ trang load xong!")
				fmt.Println("----------")
				results[idx] = Result{Link: link, Status: status, OldIP: "", NewIP: ""}
				return
			}

			// Lấy old_ip, new_ip và body
			err = chromedp.Run(ctx,
				chromedp.EvaluateAsDevTools(`(function(){
					var el = document.querySelector('#oldIp');
					return el ? el.textContent.trim() : '';
				})()`, &oldIP),
				chromedp.EvaluateAsDevTools(`(function(){
					var el = document.querySelector('#result');
					return el ? el.textContent.trim() : '';
				})()`, &newIP),
				chromedp.OuterHTML("body", &body),
			)
			if err != nil {
				fmt.Println("❌ Lỗi:", err)
				results[idx] = Result{Link: link, Status: status, OldIP: oldIP, NewIP: newIP}
			} else {
				// Tách IP nếu có dạng "old_ip: 1.2.3.4"
				oldIP = extractIP(oldIP)
				newIP = extractIP(newIP)
				isIP := isIPv4(newIP)
				if oldIP == "" || newIP == "" || !isIP {
					fmt.Printf("❌ Không tìm thấy thông tin IP\nOld IP: %s\nNew IP: %s\n", oldIP, newIP)
					status = "notfound"
				} else if oldIP != newIP {
					fmt.Printf("✅ Thành công\nOld IP: %s\nNew IP: %s\n", oldIP, newIP)
					status = "success"
				} else {
					fmt.Printf("❌ Không tìm thấy\nOld IP: %s\nNew IP: %s\n", oldIP, newIP)
					status = "notfound"
				}
				results[idx] = Result{Link: link, Status: status, OldIP: oldIP, NewIP: newIP}
			}
			fmt.Println("----------")
		}(idx, link)
	}

	// Chờ tất cả goroutine xong
	for i := 0; i < len(links); i++ {
		<-done
	}

	// Lưu kết quả ra file
	outFile := fmt.Sprintf("output_%d.txt", time.Now().Unix())
	f, err := os.Create(outFile)
	if err != nil {
		fmt.Println("❌ Không thể tạo file output:", err)
		return
	}
	defer f.Close()
	for _, r := range results {
		fmt.Fprintf(f, "%s|%s|%s|%s\n", r.Link, r.Status, r.OldIP, r.NewIP)
	}
	fmt.Println("✅ Đã lưu kết quả vào:", outFile)

	// Tự động mở file kết quả bằng Notepad (Windows)
	go func() {
		time.Sleep(1 * time.Second) // chờ file ghi xong
		_ = openFileWithNotepad(outFile)
	}()
}

// Mở file bằng Notepad trên Windows
func openFileWithNotepad(filename string) error {
	return execCommand("notepad", filename)
}

func execCommand(name string, arg ...string) error {
	cmd := exec.Command(name, arg...)
	return cmd.Start()
}

// Tách IP từ chuỗi kiểu "old_ip: 1.2.3.4" hoặc trả về nguyên nếu không có dấu :
func extractIP(s string) string {
	parts := strings.Split(s, ":")
	if len(parts) == 2 {
		return strings.TrimSpace(parts[1])
	}
	return strings.TrimSpace(s)
}

// Kiểm tra chuỗi có phải IPv4 không
func isIPv4(ip string) bool {
	segs := strings.Split(ip, ".")
	if len(segs) != 4 {
		return false
	}
	for _, seg := range segs {
		if seg == "" {
			return false
		}
	}
	return true
}
