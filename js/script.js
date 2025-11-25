// 全局变量
let currentRoom = null;
let fileList = [];
let chatMessages = [];
let activeUploads = new Map(); // 存储活跃的上传请求
let roomStorage = {
    used: 0,
    max: 1024 * 1024 * 1024 // 1 GB in bytes
};

// DOM元素
const roomIdInput = document.getElementById('roomId');
const joinRoomBtn = document.getElementById('joinRoom');
const currentRoomDisplay = document.getElementById('currentRoom');
const fileListContainer = document.getElementById('fileList');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const chatMessagesContainer = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessage');
const statusMessage = document.getElementById('statusMessage');
const uploadProgressContainer = document.getElementById('uploadProgressContainer');
const uploadProgressList = document.getElementById('uploadProgressList');
const storageUsed = document.getElementById('storageUsed');
const storageFill = document.getElementById('storageFill');

// 事件监听
joinRoomBtn.addEventListener('click', joinRoom);
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.backgroundColor = '#e9ecef';
});
uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.backgroundColor = '#f8f9fa';
});
uploadArea.addEventListener('drop', handleFileDrop);
fileInput.addEventListener('change', handleFileSelect);
sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// 加入房间
function joinRoom() {
    const roomId = roomIdInput.value.trim();
    
    if (!/^\d{4}$/.test(roomId)) {
        showStatus('请输入4位数字房间号', 'error');
        return;
    }
    
    currentRoom = roomId;
    currentRoomDisplay.textContent = `当前房间: ${roomId}`;
    showStatus(`已加入房间 ${roomId}`, 'success');
    
    // 加载房间的文件和聊天记录
    loadRoomData();
    
    // 开始定期更新
    setInterval(loadRoomData, 3000);
}

// 处理文件选择
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        uploadFiles(files);
    }
}

// 处理文件拖放
function handleFileDrop(e) {
    e.preventDefault();
    uploadArea.style.backgroundColor = '#f8f9fa';
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        uploadFiles(files);
    }
}

// 上传文件
function uploadFiles(files) {
    if (!currentRoom) {
        showStatus('请先加入房间', 'error');
        return;
    }
    
    // 显示上传进度容器
    uploadProgressContainer.classList.remove('hidden');
    
    // 处理每个文件
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 检查文件大小
        if (file.size > 1024 * 1024 * 1024) { // 1 GB
            showStatus(`文件 "${file.name}" 超过1GB限制`, 'error');
            continue;
        }
        
        // 检查文件类型，排除可执行文件
        const fileName = file.name.toLowerCase();
        const disallowedExtensions = ['.exe', '.bat', '.sh', '.php', '.js', '.py', '.pl', '.rb'];
        const isDisallowed = disallowedExtensions.some(ext => fileName.endsWith(ext));
        
        if (isDisallowed) {
            showStatus(`不允许上传可执行文件: ${file.name}`, 'error');
            continue;
        }
        
        // 添加上传进度项
        const uploadId = 'upload_' + Date.now() + '_' + i;
        addUploadProgressItem(uploadId, file);
        
        // 开始上传
        uploadFile(file, uploadId);
    }
    
    // 清空文件输入
    fileInput.value = '';
}

// 添加上传进度项
function addUploadProgressItem(uploadId, file) {
    const uploadItem = document.createElement('div');
    uploadItem.className = 'upload-item';
    uploadItem.id = uploadId;
    
    const fileSize = formatFileSize(file.size);
    
    uploadItem.innerHTML = `
        <div class="upload-progress-header">
            <span>${file.name}</span>
            <span>0%</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
        </div>
        <div class="progress-info">
            <span>0 B / ${fileSize}</span>
            <span>等待中...</span>
        </div>
        <div class="upload-stats">
            <span>速度: 0 KB/s</span>
            <span>剩余时间: 计算中...</span>
        </div>
        <button class="upload-cancel-btn" data-upload-id="${uploadId}">取消上传</button>
        <div class="upload-error hidden"></div>
    `;
    
    uploadProgressList.appendChild(uploadItem);
    
    // 添加取消按钮事件
    const cancelBtn = uploadItem.querySelector('.upload-cancel-btn');
    cancelBtn.addEventListener('click', cancelUpload);
}

// 上传单个文件
function uploadFile(file, uploadId) {
    const formData = new FormData();
    formData.append('roomId', currentRoom);
    formData.append('action', 'upload');
    formData.append('files[]', file);
    
    const xhr = new XMLHttpRequest();
    const startTime = Date.now();
    
    // 存储上传请求
    activeUploads.set(uploadId, {
        xhr: xhr,
        file: file,
        startTime: startTime
    });
    
    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            const elapsedTime = (Date.now() - startTime) / 1000; // 秒
            const speed = e.loaded / elapsedTime; // 字节/秒
            const remainingTime = (e.total - e.loaded) / speed; // 秒
            
            updateUploadProgress(
                uploadId, 
                percentComplete, 
                e.loaded, 
                e.total, 
                speed, 
                remainingTime
            );
        }
    });
    
    xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
            try {
                const response = JSON.parse(xhr.responseText);
                if (response.success) {
                    completeUpload(uploadId, true);
                    showStatus('文件上传成功', 'success');
                    loadRoomData();
                } else {
                    completeUpload(uploadId, false, response.message || '上传失败');
                }
            } catch (e) {
                completeUpload(uploadId, false, '服务器响应错误');
            }
        } else {
            completeUpload(uploadId, false, '网络错误: ' + xhr.status);
        }
        
        // 从活跃上传中移除
        activeUploads.delete(uploadId);
    });
    
    xhr.addEventListener('error', () => {
        completeUpload(uploadId, false, '网络错误');
        activeUploads.delete(uploadId);
    });
    
    xhr.open('POST', './php/backend.php');
    xhr.send(formData);
}

// 更新上传进度
function updateUploadProgress(uploadId, percent, loaded, total, speed, remainingTime) {
    const uploadItem = document.getElementById(uploadId);
    if (!uploadItem) return;
    
    const percentElement = uploadItem.querySelector('.upload-progress-header span:last-child');
    const progressFill = uploadItem.querySelector('.progress-fill');
    const progressInfo = uploadItem.querySelector('.progress-info');
    const statsElement = uploadItem.querySelector('.upload-stats');
    
    percentElement.textContent = Math.round(percent) + '%';
    progressFill.style.width = percent + '%';
    
    const loadedFormatted = formatFileSize(loaded);
    const totalFormatted = formatFileSize(total);
    const speedFormatted = formatFileSize(speed) + '/s';
    
    let remainingFormatted = '计算中...';
    if (remainingTime && isFinite(remainingTime)) {
        if (remainingTime < 60) {
            remainingFormatted = Math.round(remainingTime) + '秒';
        } else if (remainingTime < 3600) {
            remainingFormatted = Math.round(remainingTime / 60) + '分钟';
        } else {
            remainingFormatted = Math.round(remainingTime / 3600) + '小时';
        }
    }
    
    progressInfo.innerHTML = `<span>${loadedFormatted} / ${totalFormatted}</span><span>${speedFormatted}</span>`;
    statsElement.innerHTML = `<span>速度: ${speedFormatted}</span><span>剩余时间: ${remainingFormatted}</span>`;
}

// 完成上传
function completeUpload(uploadId, success, message) {
    const uploadItem = document.getElementById(uploadId);
    if (!uploadItem) return;
    
    const errorElement = uploadItem.querySelector('.upload-error');
    const cancelBtn = uploadItem.querySelector('.upload-cancel-btn');
    
    if (success) {
        uploadItem.style.opacity = '0.7';
        uploadItem.querySelector('.upload-progress-header span:last-child').textContent = '完成';
        uploadItem.querySelector('.progress-fill').style.backgroundColor = '#28a745';
        cancelBtn.style.display = 'none';
        
        // 10秒后移除上传项
        setTimeout(() => {
            if (uploadItem.parentNode) {
                uploadItem.parentNode.removeChild(uploadItem);
            }
            
            // 如果没有更多上传项，隐藏进度容器
            if (uploadProgressList.children.length === 0) {
                uploadProgressContainer.classList.add('hidden');
            }
        }, 10000);
    } else {
        uploadItem.style.opacity = '0.9';
        uploadItem.querySelector('.upload-progress-header span:last-child').textContent = '失败';
        uploadItem.querySelector('.progress-fill').style.backgroundColor = '#dc3545';
        uploadItem.querySelector('.progress-info span:last-child').textContent = '上传失败';
        
        // 显示错误信息
        errorElement.textContent = message || '上传失败';
        errorElement.classList.remove('hidden');
        
        // 更改取消按钮文本
        cancelBtn.textContent = '关闭';
        cancelBtn.style.backgroundColor = '#6c757d';
    }
}

// 取消上传
function cancelUpload(e) {
    const uploadId = e.target.getAttribute('data-upload-id');
    const uploadData = activeUploads.get(uploadId);
    
    if (uploadData && uploadData.xhr) {
        uploadData.xhr.abort();
        activeUploads.delete(uploadId);
    }
    
    const uploadItem = document.getElementById(uploadId);
    if (uploadItem) {
        uploadItem.parentNode.removeChild(uploadItem);
        
        // 如果没有更多上传项，隐藏进度容器
        if (uploadProgressList.children.length === 0) {
            uploadProgressContainer.classList.add('hidden');
        }
    }
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 获取文件类型图标
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    // 图片文件
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) {
        return '🖼️';
    }
    // 视频文件
    else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(ext)) {
        return '🎬';
    }
    // 音频文件
    else if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) {
        return '🎵';
    }
    // PDF文件
    else if (ext === 'pdf') {
        return '📕';
    }
    // Word文档
    else if (['doc', 'docx'].includes(ext)) {
        return '📄';
    }
    // Excel文档
    else if (['xls', 'xlsx'].includes(ext)) {
        return '📊';
    }
    // PowerPoint文档
    else if (['ppt', 'pptx'].includes(ext)) {
        return '📑';
    }
    // 压缩文件
    else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
        return '📦';
    }
    // 代码文件
    else if (['html', 'css', 'js', 'php', 'py', 'java', 'cpp', 'c', 'json', 'xml'].includes(ext)) {
        return '📝';
    }
    // 默认文件图标
    else {
        return '📄';
    }
}

// 发送消息
function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message) {
        showStatus('消息不能为空', 'error');
        return;
    }
    
    if (!currentRoom) {
        showStatus('请先加入房间', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('roomId', currentRoom);
    formData.append('action', 'sendMessage');
    formData.append('message', message);
    
    fetch('./php/backend.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            messageInput.value = '';
            loadRoomData();
        } else {
            showStatus('发送消息失败: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showStatus('发送消息过程中发生错误', 'error');
    });
}

// 加载房间数据
function loadRoomData() {
    if (!currentRoom) return;
    
    const formData = new FormData();
    formData.append('roomId', currentRoom);
    formData.append('action', 'getRoomData');
    
    fetch('./php/backend.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            fileList = data.files || [];
            chatMessages = data.messages || [];
            roomStorage.used = data.storageUsed || 0;
            renderFileList();
            renderChatMessages();
            updateStorageDisplay();
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

// 更新存储显示
function updateStorageDisplay() {
    const usedMB = (roomStorage.used / (1024 * 1024)).toFixed(2);
    const usedPercent = (roomStorage.used / roomStorage.max) * 100;
    
    storageUsed.textContent = `${usedMB} MB`;
    storageFill.style.width = `${usedPercent}%`;
    
    // 如果超过80%，显示警告色
    if (usedPercent > 80) {
        storageFill.style.background = 'linear-gradient(90deg, #ff6b6b, #ee5a52)';
    } else {
        storageFill.style.background = 'linear-gradient(90deg, #4b6cb7, #2575fc)';
    }
}

// 渲染文件列表
function renderFileList() {
    fileListContainer.innerHTML = '';
    
    if (fileList.length === 0) {
        fileListContainer.innerHTML = '<p style="text-align: center; color: #777;">暂无文件</p>';
        return;
    }
    
    fileList.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        
        const fileIcon = document.createElement('span');
        fileIcon.className = 'file-icon';
        fileIcon.textContent = getFileIcon(file.name);
        
        const fileName = document.createElement('span');
        fileName.textContent = file.name;
        
        const fileSize = document.createElement('div');
        fileSize.style.fontSize = '0.8rem';
        fileSize.style.color = '#666';
        fileSize.textContent = formatFileSize(file.size);
        
        const fileDetails = document.createElement('div');
        fileDetails.style.display = 'flex';
        fileDetails.style.flexDirection = 'column';
        fileDetails.appendChild(fileName);
        fileDetails.appendChild(fileSize);
        
        const fileActions = document.createElement('div');
        fileActions.className = 'file-actions';
        
        const downloadBtn = document.createElement('button');
        downloadBtn.innerHTML = '⬇️';
        downloadBtn.title = '下载';
        downloadBtn.addEventListener('click', () => downloadFile(file.id));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '❌';
        deleteBtn.title = '删除';
        deleteBtn.addEventListener('click', () => deleteFile(file.id));
        
        fileInfo.appendChild(fileIcon);
        fileInfo.appendChild(fileDetails);
        fileActions.appendChild(downloadBtn);
        fileActions.appendChild(deleteBtn);
        fileItem.appendChild(fileInfo);
        fileItem.appendChild(fileActions);
        fileListContainer.appendChild(fileItem);
    });
}

// 渲染聊天消息
function renderChatMessages() {
    chatMessagesContainer.innerHTML = '';
    
    if (chatMessages.length === 0) {
        chatMessagesContainer.innerHTML = '<p style="text-align: center; color: #777;">暂无消息</p>';
        return;
    }
    
    chatMessages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msg.type === 'own' ? 'own' : 'other'}`;
        messageDiv.textContent = msg.text;
        
        const timeSpan = document.createElement('span');
        timeSpan.style.display = 'block';
        timeSpan.style.fontSize = '0.8rem';
        timeSpan.style.opacity = '0.7';
        timeSpan.style.marginTop = '5px';
        timeSpan.textContent = msg.time;
        
        messageDiv.appendChild(timeSpan);
        chatMessagesContainer.appendChild(messageDiv);
    });
    
    // 滚动到底部
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// 下载文件
function downloadFile(fileId) {
    window.open(`./php/backend.php?action=download&roomId=${currentRoom}&fileId=${fileId}`, '_blank');
}

// 删除文件
function deleteFile(fileId) {
    if (!confirm('确定要删除这个文件吗？')) return;
    
    const formData = new FormData();
    formData.append('roomId', currentRoom);
    formData.append('action', 'deleteFile');
    formData.append('fileId', fileId);
    
    fetch('./php/backend.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showStatus('文件删除成功', 'success');
            loadRoomData();
        } else {
            showStatus('文件删除失败: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showStatus('删除文件过程中发生错误', 'error');
    });
}

// 显示状态消息
function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
    statusMessage.classList.remove('hidden');
    
    setTimeout(() => {
        statusMessage.classList.add('hidden');
    }, 3000);
}