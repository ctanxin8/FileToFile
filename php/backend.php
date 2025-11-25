<?php
// 设置响应头为JSON
header('Content-Type: application/json');

// 增大PHP内存限制和执行时间
ini_set('memory_limit', '512M');
ini_set('max_execution_time', 300);

// 定义存储目录
define('STORAGE_DIR', __DIR__ . '/storage/');
define('ROOMS_DIR', STORAGE_DIR . 'rooms/');

// 确保存储目录存在
if (!file_exists(ROOMS_DIR)) {
    mkdir(ROOMS_DIR, 0777, true);
}

// 加密密钥
define('ENCRYPTION_KEY', 'your-secure-encryption-key-2025');

// 文件大小限制调整
define('MAX_FILE_SIZE', 100 * 1024 * 1024); // 100MB
define('MAX_ROOM_SIZE', 1024 * 1024 * 1024); // 1GB

// 获取请求数据
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $_POST['action'] ?? $_GET['action'] ?? $input['action'] ?? '';
$roomId = $_POST['roomId'] ?? $_GET['roomId'] ?? $input['roomId'] ?? '';

// 验证房间号
if (!preg_match('/^\d{4}$/', $roomId)) {
    sendResponse(false, '无效的房间号');
    exit;
}

// 房间目录
$roomDir = ROOMS_DIR . $roomId . '/';

// 根据操作类型处理请求
switch ($action) {
    case 'upload':
        handleFileUpload();
        break;
    case 'getRoomData':
        getRoomData();
        break;
    case 'sendMessage':
        sendMessage();
        break;
    case 'deleteFile':
        deleteFile();
        break;
    case 'download':
        downloadFile();
        break;
    case 'cleanup':
        cleanupRoom();
        break;
    default:
        sendResponse(false, '未知操作');
        break;
}

// 处理文件上传
function handleFileUpload() {
    global $roomDir, $roomId;
    
    // 检查是否有文件上传
    if (empty($_FILES['files'])) {
        sendResponse(false, '没有文件被上传');
        return;
    }
    
    // 确保房间目录存在
    if (!file_exists($roomDir)) {
        mkdir($roomDir, 0777, true);
        mkdir($roomDir . 'files/', 0777, true);
        mkdir($roomDir . 'messages/', 0777, true);
    }
    
    $filesDir = $roomDir . 'files/';
    $uploadedFiles = [];
    
    // 计算房间当前存储使用量
    $roomSize = calculateRoomSize($filesDir);
    
    // 处理每个上传的文件
    foreach ($_FILES['files']['name'] as $index => $name) {
        $tmpName = $_FILES['files']['tmp_name'][$index];
        $error = $_FILES['files']['error'][$index];
        $fileSize = $_FILES['files']['size'][$index];
        
        // 检查文件是否成功上传
        if ($error !== UPLOAD_ERR_OK) {
            $errorMsg = getUploadError($error);
            sendResponse(false, "文件 \"$name\" 上传失败: $errorMsg");
            return;
        }
        
        // 检查文件大小
        if ($fileSize > MAX_FILE_SIZE) {
            sendResponse(false, "文件 \"$name\" 超过 " . formatBytes(MAX_FILE_SIZE) . " 限制");
            return;
        }
        
        // 检查文件类型
        if (!isSafeFileType($name)) {
            sendResponse(false, "文件 \"$name\" 类型不被允许");
            return;
        }
        
        // 检查房间总大小
        if ($roomSize + $fileSize > MAX_ROOM_SIZE) {
            sendResponse(false, "房间存储空间不足");
            return;
        }
        
        // 生成唯一文件名
        $fileId = uniqid();
        $filePath = $filesDir . $fileId . '.dat';
        
        // 加密并保存文件
        if (encryptAndSaveFile($tmpName, $filePath, $roomId)) {
            // 保存文件元数据
            $fileMeta = [
                'id' => $fileId,
                'name' => $name,
                'size' => $fileSize,
                'upload_time' => time(),
                'encrypted_name' => encryptData($name, $roomId)
            ];
            
            file_put_contents($filesDir . $fileId . '.meta', json_encode($fileMeta));
            $uploadedFiles[] = $fileMeta;
            
            // 更新房间大小
            $roomSize += $fileSize;
        } else {
            sendResponse(false, "文件 \"$name\" 加密保存失败");
            return;
        }
    }
    
    // 清理过期文件
    cleanupExpiredFiles($filesDir);
    
    sendResponse(true, '文件上传成功', ['files' => $uploadedFiles]);
}

// 加密并保存文件
function encryptAndSaveFile($sourcePath, $destPath, $roomId) {
    // 分块读取和加密文件，避免内存问题
    $source = fopen($sourcePath, 'rb');
    $dest = fopen($destPath, 'wb');
    
    if (!$source || !$dest) {
        return false;
    }
    
    $chunkSize = 8192; // 8KB chunks
    $iv = openssl_random_pseudo_bytes(16);
    fwrite($dest, $iv); // 写入IV
    
    $key = hash('sha256', ENCRYPTION_KEY . $roomId, true);
    
    while (!feof($source)) {
        $chunk = fread($source, $chunkSize);
        $encrypted = openssl_encrypt($chunk, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
        
        // 使用下一个块的IV
        $iv = substr($encrypted, -16);
        fwrite($dest, $encrypted);
    }
    
    fclose($source);
    fclose($dest);
    return true;
}

// 解密文件
function decryptFile($sourcePath, $roomId) {
    $source = fopen($sourcePath, 'rb');
    if (!$source) {
        return false;
    }
    
    $iv = fread($source, 16);
    $key = hash('sha256', ENCRYPTION_KEY . $roomId, true);
    
    $decrypted = '';
    $chunkSize = 8192 + 16; // 加密块会稍大
    
    while (!feof($source)) {
        $chunk = fread($source, $chunkSize);
        if ($chunk) {
            $decrypted .= openssl_decrypt($chunk, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
            $iv = substr($chunk, -16);
        }
    }
    
    fclose($source);
    return $decrypted;
}

// 检查文件类型是否安全
function isSafeFileType($filename) {
    $dangerousExtensions = [
        'php', 'exe', 'bat', 'cmd', 'sh', 'bin', 'jar', 'app', 'scr',
        'com', 'pif', 'vb', 'vbs', 'js', 'jse', 'wsf', 'wsh', 'msi',
        'appx', 'dmg', 'deb', 'rpm'
    ];
    
    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    return !in_array($extension, $dangerousExtensions);
}

// 获取上传错误信息
function getUploadError($errorCode) {
    $errors = [
        UPLOAD_ERR_INI_SIZE => '文件超过服务器大小限制',
        UPLOAD_ERR_FORM_SIZE => '文件超过表单大小限制',
        UPLOAD_ERR_PARTIAL => '文件只有部分被上传',
        UPLOAD_ERR_NO_FILE => '没有文件被上传',
        UPLOAD_ERR_NO_TMP_DIR => '缺少临时文件夹',
        UPLOAD_ERR_CANT_WRITE => '文件写入失败',
        UPLOAD_ERR_EXTENSION => 'PHP扩展阻止了文件上传'
    ];
    
    return $errors[$errorCode] ?? '未知错误';
}

// 获取房间数据
function getRoomData() {
    global $roomDir;
    
    // 如果房间不存在，返回空数据
    if (!file_exists($roomDir)) {
        sendResponse(true, '房间数据', [
            'files' => [],
            'messages' => [],
            'storageUsed' => 0,
            'maxStorage' => MAX_ROOM_SIZE
        ]);
        return;
    }
    
    $filesDir = $roomDir . 'files/';
    $messagesDir = $roomDir . 'messages/';
    
    // 获取文件列表
    $files = [];
    $storageUsed = 0;
    if (file_exists($filesDir)) {
        $fileMetaFiles = glob($filesDir . '*.meta');
        
        foreach ($fileMetaFiles as $metaFile) {
            $metaContent = file_get_contents($metaFile);
            $fileMeta = json_decode($metaContent, true);
            if ($fileMeta && is_array($fileMeta)) {
                // 检查文件是否过期
                if (time() - $fileMeta['upload_time'] < 24 * 3600) {
                    $files[] = [
                        'id' => $fileMeta['id'],
                        'name' => $fileMeta['name'],
                        'size' => $fileMeta['size'],
                        'upload_time' => $fileMeta['upload_time'],
                        'formatted_size' => formatBytes($fileMeta['size']),
                        'formatted_time' => date('Y-m-d H:i:s', $fileMeta['upload_time'])
                    ];
                    $storageUsed += $fileMeta['size'];
                }
            }
        }
    }
    
    // 获取消息列表
    $messages = [];
    if (file_exists($messagesDir)) {
        $messageFiles = glob($messagesDir . '*.json');
        
        foreach ($messageFiles as $messageFile) {
            $messageData = json_decode(file_get_contents($messageFile), true);
            if ($messageData && is_array($messageData)) {
                // 检查消息是否过期
                if (time() - $messageData['timestamp'] < 24 * 3600) {
                    $messages[] = $messageData;
                }
            }
        }
        
        // 按时间排序
        usort($messages, function($a, $b) {
            return $a['timestamp'] - $b['timestamp'];
        });
    }
    
    sendResponse(true, '房间数据', [
        'files' => $files,
        'messages' => $messages,
        'storageUsed' => $storageUsed,
        'maxStorage' => MAX_ROOM_SIZE,
        'storagePercent' => round(($storageUsed / MAX_ROOM_SIZE) * 100, 2)
    ]);
}

// 计算房间大小
function calculateRoomSize($filesDir) {
    if (!file_exists($filesDir)) {
        return 0;
    }
    
    $size = 0;
    $fileMetaFiles = glob($filesDir . '*.meta');
    
    foreach ($fileMetaFiles as $metaFile) {
        $fileMeta = json_decode(file_get_contents($metaFile), true);
        if ($fileMeta && is_array($fileMeta) && isset($fileMeta['size'])) {
            $size += $fileMeta['size'];
        }
    }
    
    return $size;
}

// 发送消息
function sendMessage() {
    global $roomDir, $input;
    
    $message = $_POST['message'] ?? $input['message'] ?? '';
    
    if (empty(trim($message))) {
        sendResponse(false, '消息不能为空');
        return;
    }
    
    // 限制消息长度
    if (strlen($message) > 10000) {
        sendResponse(false, '消息过长');
        return;
    }
    
    // 确保房间目录存在
    if (!file_exists($roomDir)) {
        mkdir($roomDir, 0777, true);
        mkdir($roomDir . 'files/', 0777, true);
        mkdir($roomDir . 'messages/', 0777, true);
    }
    
    $messagesDir = $roomDir . 'messages/';
    
    // 创建消息数据
    $messageData = [
        'id' => uniqid(),
        'text' => htmlspecialchars($message), // 防止XSS
        'timestamp' => time(),
        'time' => date('H:i:s'),
        'date' => date('Y-m-d')
    ];
    
    // 保存消息
    $messageFile = $messagesDir . $messageData['id'] . '.json';
    if (file_put_contents($messageFile, json_encode($messageData))) {
        sendResponse(true, '消息发送成功', ['message' => $messageData]);
    } else {
        sendResponse(false, '消息发送失败');
    }
}

// 删除文件
function deleteFile() {
    global $roomDir, $input;
    
    $fileId = $_POST['fileId'] ?? $input['fileId'] ?? '';
    
    if (empty($fileId)) {
        sendResponse(false, '文件ID不能为空');
        return;
    }
    
    $filesDir = $roomDir . 'files/';
    $filePath = $filesDir . $fileId . '.dat';
    $metaPath = $filesDir . $fileId . '.meta';
    
    // 删除文件和数据
    $success = true;
    if (file_exists($filePath)) {
        $success = $success && unlink($filePath);
    }
    
    if (file_exists($metaPath)) {
        $success = $success && unlink($metaPath);
    }
    
    if ($success) {
        sendResponse(true, '文件删除成功');
    } else {
        sendResponse(false, '文件删除失败');
    }
}

// 下载文件
function downloadFile() {
    global $roomDir, $roomId;
    
    $fileId = $_GET['fileId'] ?? '';
    
    if (empty($fileId)) {
        sendResponse(false, '文件ID不能为空');
        return;
    }
    
    $filesDir = $roomDir . 'files/';
    $filePath = $filesDir . $fileId . '.dat';
    $metaPath = $filesDir . $fileId . '.meta';
    
    if (!file_exists($filePath) || !file_exists($metaPath)) {
        sendResponse(false, '文件不存在');
        return;
    }
    
    // 获取文件元数据
    $fileMeta = json_decode(file_get_contents($metaPath), true);
    if (!$fileMeta) {
        sendResponse(false, '文件元数据损坏');
        return;
    }
    
    // 读取并解密文件内容
    $decryptedContent = decryptFile($filePath, $roomId);
    if ($decryptedContent === false) {
        sendResponse(false, '文件解密失败');
        return;
    }
    
    // 发送文件
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . $fileMeta['name'] . '"');
    header('Content-Length: ' . strlen($decryptedContent));
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');
    
    echo $decryptedContent;
    exit;
}

// 清理过期文件
function cleanupExpiredFiles($filesDir) {
    if (!file_exists($filesDir)) return;
    
    $expiryTime = 24 * 60 * 60; // 24小时
    $cleaned = 0;
    
    $fileMetaFiles = glob($filesDir . '*.meta');
    
    foreach ($fileMetaFiles as $metaFile) {
        $fileMeta = json_decode(file_get_contents($metaFile), true);
        if ($fileMeta && is_array($fileMeta)) {
            $fileAge = time() - $fileMeta['upload_time'];
            
            if ($fileAge > $expiryTime) {
                $fileId = $fileMeta['id'];
                $filePath = $filesDir . $fileId . '.dat';
                
                if (file_exists($filePath)) {
                    unlink($filePath);
                }
                
                unlink($metaFile);
                $cleaned++;
            }
        }
    }
    
    // 清理过期消息
    $messagesDir = dirname($filesDir) . '/messages/';
    if (file_exists($messagesDir)) {
        $messageFiles = glob($messagesDir . '*.json');
        
        foreach ($messageFiles as $messageFile) {
            $messageData = json_decode(file_get_contents($messageFile), true);
            if ($messageData && is_array($messageData)) {
                $messageAge = time() - $messageData['timestamp'];
                
                if ($messageAge > $expiryTime) {
                    unlink($messageFile);
                    $cleaned++;
                }
            }
        }
    }
    
    return $cleaned;
}

// 清理房间
function cleanupRoom() {
    global $roomDir;
    
    $filesDir = $roomDir . 'files/';
    $cleaned = cleanupExpiredFiles($filesDir);
    
    sendResponse(true, "清理完成，删除了 {$cleaned} 个过期项目");
}

// 加密数据
function encryptData($data, $roomId) {
    $key = hash('sha256', ENCRYPTION_KEY . $roomId, true);
    $iv = openssl_random_pseudo_bytes(16);
    $encrypted = openssl_encrypt($data, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
    return base64_encode($iv . $encrypted);
}

// 解密数据
function decryptData($data, $roomId) {
    $data = base64_decode($data);
    $key = hash('sha256', ENCRYPTION_KEY . $roomId, true);
    $iv = substr($data, 0, 16);
    $encrypted = substr($data, 16);
    return openssl_decrypt($encrypted, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
}

// 格式化字节大小
function formatBytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    
    $bytes /= pow(1024, $pow);
    
    return round($bytes, $precision) . ' ' . $units[$pow];
}

// 发送JSON响应
function sendResponse($success, $message, $data = []) {
    $response = [
        'success' => $success,
        'message' => $message
    ];
    
    if (!empty($data)) {
        $response = array_merge($response, $data);
    }
    
    echo json_encode($response);
    exit;
}
?>