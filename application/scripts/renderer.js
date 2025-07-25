// Renderer process
if (!window.electronAPI) {
    throw new Error('Electron API not available');
}

const { checkLink, checkMultipleLinks, openFile, saveFile, readFile, saveToFile } = window.electronAPI;

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const selectAllBtn = document.getElementById('selectAll');
    const deselectAllBtn = document.getElementById('deselectAll');
    const deleteSelectedBtn = document.getElementById('deleteSelected');
    const changeIPBtn = document.getElementById('changeIP');
    const loadFileBtn = document.getElementById('loadFile');
    const saveFileBtn = document.getElementById('saveFile');
    const resetBtn = document.getElementById('reset');
    const linkTable = document.getElementById('linkTable');
    const logContent = document.getElementById('logContent');
    const tbody = linkTable.querySelector('tbody');
    const maxConcurrencyInput = document.getElementById('maxConcurrency');
    const saveSettingBtn = document.getElementById('saveSetting');

    // Sự kiện lưu số worker tối đa
    saveSettingBtn.addEventListener('click', async () => {
        const value = parseInt(maxConcurrencyInput.value, 10);
        if (isNaN(value) || value < 1 || value > 50) {
            addLog('Giá trị số tiến trình tối đa không hợp lệ (1-50)');
            return;
        }
        const result = await window.electronAPI.setMaxConcurrency(value);
        if (result.success) {
            addLog(`Đã cập nhật số tiến trình tối đa: ${value}`);
        } else {
            addLog(`Không thể cập nhật: ${result.message || 'Lỗi không xác định'}`);
        }
    });

    // State management
    let links = [];
    let currentConcurrency = 5;

    // Helper functions
    const addLog = (message) => {
        const timestamp = new Date().toLocaleTimeString();
        logContent.innerHTML += `[${timestamp}] ${message}<br>`;
        logContent.scrollTop = logContent.scrollHeight;
    };

    const createTableRow = (link) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input ${link.status === 'checking' ? 'disabled' : ''} class="active-checkbox" data-url="${link.url}"  type="checkbox" ${link.active ? 'checked' : ''}></td>
            <td><button ${link.status === 'checking' ? 'disabled' : ''} class="action-button check-button">Đổi</button></td>
            <td><button ${link.status === 'checking' ? 'disabled' : ''} class="action-button delete-button">Xóa</button></td>
            <td class="link-url">${link.url}</td>
            <td class="status-${link.status}">${link.statusText}</td>
            <td>${link.time || ''}</td>
            <td>${link.old_ip || ''}</td>
            <td>${link.new_ip || ''}</td>
        `;
        return row;
    };

    const updateTable = () => {
        const tbody = linkTable.querySelector('tbody');
        tbody.innerHTML = '';
        links.forEach(link => {
            tbody.appendChild(createTableRow(link));
        });
        const activeCheckboxes = tbody.querySelectorAll('.active-checkbox');
        activeCheckboxes.forEach(checkbox => {
            checkbox.removeEventListener('change', () => {});
        });
        activeCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const url = checkbox.getAttribute('data-url');
                links.find(link => link.url === url).active = checkbox.checked;
            });
        });
    };

    function updateWorkerInfo() {
        const infoWorker = document.getElementById('infoWorker');
        infoWorker.textContent = `Số tiến trình đang chạy: ${activeWorkers}/${currentConcurrency}`;
    }

    // Event listeners
    selectAllBtn.addEventListener('click', () => {
        links.forEach(link => link.active = true);
        updateTable();
        addLog('Đã chọn tất cả các link');
    });

    deselectAllBtn.addEventListener('click', () => {
        links.forEach(link => link.active = false);
        updateTable();
        addLog('Đã bỏ chọn tất cả các link');
    });

    deleteSelectedBtn.addEventListener('click', () => {
        links = links.filter(link => !link.active);
        updateTable();
        addLog('Đã xóa các link được chọn');
    });

    // Event listener for checking selected links
    changeIPBtn.addEventListener('click', async () => {
        const selectedLinks = links.filter(link => link.active);
        if (selectedLinks.length === 0) {
            addLog('Không có link nào được chọn');
            return;
        }

        addLog(`Bắt đầu kiểm tra ${selectedLinks.length} link đã chọn...`);
        
        // Update status to checking
        selectedLinks.forEach( async (link) => {
             try {
                link.status = 'checking';
                link.statusText = '⏳ Đang kiểm tra...';
                updateTable();
                
                const result = await checkLink(link.url);
                console.log("Kết quả", result);
                
                link.status = result.status;
                link.statusText = result.statusText;
                link.time = result.time;
                link.old_ip = result.old_ip || '';
                link.new_ip = result.new_ip || '';
                updateTable();
                addLog(`Kiểm tra xong: ${link.url} - ${link.statusText}`);
            } catch (error) {
                links[index].status = 'error';
                links[index].statusText = `❌ Lỗi: ${error.message}`;
                updateTable();
                addLog(`Lỗi khi kiểm tra: ${error.message}`);
            }
        });
        // try {
        //     // Process links in parallel using checkMultipleLinks
        //     const results = await checkMultipleLinks(selectedLinks.map(link => link.url));
            
        //     // Update results
        //     results.forEach((result, index) => {
        //         const link = selectedLinks[index];
        //         link.status = result.status;
        //         link.statusText = result.statusText;
        //         link.time = result.time;
        //         link.old_ip = result.old_ip || '';
        //         link.new_ip = result.new_ip || '';
        //     });

        //     updateTable();
        //     addLog(`Đã hoàn thành kiểm tra ${selectedLinks.length} link`);
        // } catch (error) {
        //     // Update status to error for all selected links
        //     selectedLinks.forEach(link => {
        //         link.status = 'error';
        //         link.statusText = '❌ Lỗi khi kiểm tra';
        //     });
        //     updateTable();
        //     addLog(`Lỗi khi kiểm tra hàng loạt: ${error.message}`);
        // }
    });

    loadFileBtn.addEventListener('click', async () => {
        try {
            const filePath = await openFile();
            if (filePath) {
                const fileContent = await readFile(filePath);
                for (const url of fileContent) {
                    if (url.trim()) {
                        links.push({
                            url: url.trim(),
                            active: false,
                            status: 'pending',
                            statusText: 'Chưa kiểm tra',
                            time: '',
                            old_ip: '',
                            new_ip: ''
                        });
                    }
                }
                updateTable();
                addLog(`Đã nạp ${fileContent.length} link từ file`);
            }
        } catch (error) {
            addLog(`Lỗi khi đọc file: ${error.message}`);
        }
    });

    saveFileBtn.addEventListener('click', async () => {
        try {
            const filePath = await saveFile();
            if (filePath) {
                const data = links.map(link => ({
                    url: link.url,
                    old_ip: link.old_ip || '',
                    new_ip: link.new_ip || ''
                }));

                if (filePath.endsWith('.csv')) {
                    const csv = ['URL,Trạng thái,Thời gian,IP hình thị trước,IP hình thị sau'];
                    data.forEach(row => {
                        csv.push(`${row.url},${row.status},${row.time},${row.old_ip},${row.new_ip}`);
                    });
                    await saveToFile(filePath, csv.join('\n'));
                } else if (filePath.endsWith('.txt')) {
                    const txt = data.map(row => `${row.url}|${row.old_ip}|${row.new_ip}`).join('\n');
                    await saveToFile(filePath, txt);
                } else {
                    await saveToFile(filePath, JSON.stringify(data, null, 2));
                }
                addLog(`Đã lưu danh sách vào ${filePath}`);
            }
        } catch (error) {
            addLog(`Lỗi khi lưu file: ${error.message}`);
        }
    });

    resetBtn.addEventListener('click', () => {
        links = [];
        updateTable();
        addLog('Đã làm mới danh sách');
    });

    // Table event delegation
    linkTable.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const row = button.closest('tr');
        const index = Array.from(row.parentNode.children).indexOf(row);

        if (button.classList.contains('check-button')) {
            try {
                const link = links[index];
                link.status = 'checking';
                link.statusText = '⏳ Đang kiểm tra...';
                updateTable();
                
                const result = await checkLink(link.url);
                console.log("Kết quả", result);
                
                link.status = result.status;
                link.statusText = result.statusText;
                link.time = result.time;
                link.old_ip = result.old_ip || '';
                link.new_ip = result.new_ip || '';
                updateTable();
                addLog(`Kiểm tra xong: ${link.url} - ${link.statusText}`);
            } catch (error) {
                links[index].status = 'error';
                links[index].statusText = `❌ Lỗi: ${error.message}`;
                updateTable();
                addLog(`Lỗi khi kiểm tra: ${error.message}`);
            }
        } else if (button.classList.contains('delete-button')) {
            links.splice(index, 1);
            updateTable();
            addLog('Đã xóa link');
        }
    });

    // Thêm chức năng kiểm tra hàng loạt
    async function checkSelectedLinks() {
        const selectedLinks = links.filter(link => link.active);
        if (selectedLinks.length === 0) {
            addLog('Không có link nào được chọn');
            return;
        }

        addLog(`Bắt đầu kiểm tra ${selectedLinks.length} link...`);
        
        for (const link of selectedLinks) {
            link.status = 'checking';
            link.statusText = '⏳ Đang kiểm tra...';
        }
        updateTable();

        try {
            const results = await checkMultipleLinks(
                selectedLinks.map(link => link.url)
            );

            results.forEach((result, i) => {
                const link = selectedLinks[i];
                link.status = result.status;
                link.statusText = result.statusText;
                link.time = result.time;
            });

            updateTable();
            addLog(`Đã hoàn thành kiểm tra ${selectedLinks.length} link`);
        } catch (error) {
            addLog(`Lỗi khi kiểm tra hàng loạt: ${error.message}`);
        }
    }

    updateTable();

    // Hiển thị thông tin Puppeteer Cluster (tự động thử lại nếu chưa khởi tạo)
    async function showClusterInfo() {
        const infoDiv = document.getElementById('infoWorker');
        if (window.electronAPI && window.electronAPI.getClusterInfo) {
            try {
                const info = await window.electronAPI.getClusterInfo();
                infoDiv.innerHTML = `
                    <b>Cluster Puppeteer:</b><br>
                    Số worker tối đa: ${info.maxConcurrency}<br>
                    Đang chạy: ${info.currentlyRunning}<br>
                    Đang chờ: ${info.queueLength}<br>
                    Trạng thái: ${info.status}
                `;
            } catch (err) {
                if (err.message.includes('Cluster chưa khởi tạo')) {
                    infoDiv.innerHTML = `<span style='color:orange'>Đang khởi tạo Cluster...</span>`;
                } else {
                    infoDiv.innerHTML = `<span style='color:red'>Không lấy được thông tin cluster: ${err.message}</span>`;
                }
            }
            setTimeout(showClusterInfo, 500);
        } else {
            infoDiv.innerHTML = '<i>Không hỗ trợ lấy thông tin cluster</i>';
        }
    }
    showClusterInfo();
});
