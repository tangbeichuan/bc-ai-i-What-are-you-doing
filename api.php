<?php
require_once 'config.php';

// 获取设备数据
function getDevicesData() {
    if (!file_exists(DB_FILE)) {
        file_put_contents(DB_FILE, '{}');
        return [];
    }
    $data = file_get_contents(DB_FILE);
    if (empty($data)) {
        return [];
    }
    $decoded = json_decode($data, true);
    // 确保返回的是关联数组（对象格式）而不是索引数组
    $result = is_array($decoded) ? $decoded : [];
    
    // 如果解码结果是索引数组，将其转换为关联数组
    if (array_keys($result) === range(0, count($result) - 1)) {
        $assocResult = [];
        foreach ($result as $device) {
            if (is_array($device) && isset($device['deviceId'])) {
                $assocResult[$device['deviceId']] = $device;
            }
        }
        return $assocResult;
    }
    
    return $result;
}

// 保存设备数据
function saveDevicesData($data) {
    if (!is_array($data)) {
        $data = [];
    }
    return file_put_contents(DB_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// 获取在线用户数据
function getOnlineUsers() {
    if (!file_exists(USERS_FILE)) {
        file_put_contents(USERS_FILE, '[]');
        return [];
    }
    $data = file_get_contents(USERS_FILE);
    if (empty($data)) {
        return [];
    }
    $decoded = json_decode($data, true);
    return is_array($decoded) ? $decoded : [];
}

// 保存在线用户数据
function saveOnlineUsers($data) {
    if (!is_array($data)) {
        $data = [];
    }
    return file_put_contents(USERS_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// 清理过期用户
function cleanupExpiredUsers() {
    $users = getOnlineUsers();
    $now = time();
    $activeUsers = array_filter($users, function($user) use ($now) {
        return ($now - $user['lastActive']) < ONLINE_TIMEOUT;
    });
    saveOnlineUsers(array_values($activeUsers));
    return $activeUsers;
}

// 更新在线用户
function updateOnlineUser($sessionId) {
    $users = getOnlineUsers();
    $userIndex = -1;
    
    // 查找现有用户
    foreach ($users as $index => $user) {
        if ($user['sessionId'] === $sessionId) {
            $userIndex = $index;
            break;
        }
    }
    
    // 更新或添加用户
    $userData = [
        'sessionId' => $sessionId,
        'lastActive' => time(),
        'ip' => getClientIP(),
        'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'
    ];
    
    if ($userIndex >= 0) {
        $users[$userIndex] = $userData;
    } else {
        $users[] = $userData;
    }
    
    saveOnlineUsers($users);
    return cleanupExpiredUsers();
}

// 清理过期设备
function cleanupExpiredDevices() {
    $devices = getDevicesData();
    $cleaned = false;
    $now = time();
    
    foreach ($devices as $deviceId => $device) {
        if (!isset($device['lastUpdate'])) {
            unset($devices[$deviceId]);
            $cleaned = true;
            continue;
        }
        
        // 尝试多种时间格式解析，确保时间戳正确
        $lastUpdate = strtotime($device['lastUpdate']);
        if ($lastUpdate === false) {
            // 尝试另一种时间格式解析，使用安全的方法
            try {
                $dateTime = DateTime::createFromFormat('Y-m-d H:i:s', $device['lastUpdate']);
                if ($dateTime) {
                    $lastUpdate = $dateTime->getTimestamp();
                }
            } catch (Exception $e) {
                // 如果解析失败，记录错误并跳过
                file_put_contents('debug.log', date('Y-m-d H:i:s') . ' - 时间解析错误: ' . $e->getMessage() . ', 设备ID: ' . $deviceId . '
', FILE_APPEND);
            }
        }
        
        // 只有在时间解析成功的情况下才进行超时判断
        if ($lastUpdate !== false) {
            // 如果设备超过超时时间，标记为离线
            if (($now - $lastUpdate) > DEVICE_TIMEOUT) {
                unset($devices[$deviceId]);
                $cleaned = true;
            }
        } else {
            // 时间解析失败，记录错误但不立即删除设备
            file_put_contents('debug.log', date('Y-m-d H:i:s') . ' - 设备时间解析失败，保留设备: ' . $deviceId . '
', FILE_APPEND);
        }
    }
    
    if ($cleaned) {
        saveDevicesData($devices);
    }
    
    return $devices;
}

// JSON响应函数
function jsonResponse($success, $message = '', $data = []) {
    $response = ['success' => $success];
    if ($message) $response['message'] = $message;
    if ($data) $response = array_merge($response, $data);
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}

// 触发设备更新事件
function triggerDeviceUpdate($deviceId) {
    $devices = getDevicesData();
    $device = $devices[$deviceId] ?? null;
    
    if ($device) {
        // 记录事件到文件（用于SSE）
        $eventData = [
            'type' => 'device_update',
            'deviceId' => $deviceId,
            'device' => $device,
            'timestamp' => time(),
            'totalDevices' => count($devices)
        ];
        
        file_put_contents(EVENT_FILE, json_encode($eventData));
    }
}

// SSE事件流处理
function handleEvents() {
    // 设置SSE头
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: *');
    header('X-Accel-Buffering: no'); // 禁用Nginx缓冲
    
    // 禁用输出缓冲
    while (ob_get_level()) {
        ob_end_clean();
    }
    
    $lastEventId = isset($_SERVER['HTTP_LAST_EVENT_ID']) ? intval($_SERVER['HTTP_LAST_EVENT_ID']) : 0;
    $clientId = uniqid('sse_', true);
    
    file_put_contents('debug.log', date('Y-m-d H:i:s') . " - SSE连接建立: {$clientId}, Last-Event-ID: {$lastEventId}\n", FILE_APPEND);
    
    // 发送初始连接事件
    sendSSEEvent([
        'type' => 'connected',
        'clientId' => $clientId,
        'timestamp' => time()
    ]);
    
    // 发送当前设备状态
    $devices = getDevicesData();
    sendSSEEvent([
        'type' => 'initial_data',
        'devices' => $devices,
        'count' => count($devices),
        'timestamp' => time()
    ]);
    
    // 保持连接并监听事件
    $startTime = time();
    $lastCheckTime = file_exists(EVENT_FILE) ? filemtime(EVENT_FILE) : 0;
    
    // 设置超时时间
    set_time_limit(0);
    ignore_user_abort(true);
    
    while (true) {
        // 检查客户端是否断开连接
        if (connection_aborted()) {
            file_put_contents('debug.log', date('Y-m-d H:i:s') . " - SSE连接断开: {$clientId}\n", FILE_APPEND);
            break;
        }
        
        $currentTime = time();
        
        // 每3秒发送一次心跳
        if ($currentTime - $startTime > 0 && ($currentTime % 3 === 0)) {
            sendSSEEvent([
                'type' => 'heartbeat',
                'timestamp' => $currentTime
            ]);
        }
        
        // 检查设备更新事件
        if (file_exists(EVENT_FILE)) {
            $fileTime = filemtime(EVENT_FILE);
            if ($fileTime > $lastCheckTime) {
                $lastCheckTime = $fileTime;
                
                $eventContent = file_get_contents(EVENT_FILE);
                // 确保内容不为空
                if (!empty(trim($eventContent))) {
                    $eventData = json_decode($eventContent, true);
                    if ($eventData && is_array($eventData) && isset($eventData['timestamp']) && $eventData['timestamp'] > $lastEventId) {
                        sendSSEEvent($eventData);
                        $lastEventId = $eventData['timestamp'];
                    } else {
                        // 如果JSON解析失败，记录错误并继续
                        file_put_contents('debug.log', date('Y-m-d H:i:s') . " - SSE事件数据解析失败: {$eventContent}\n", FILE_APPEND);
                    }
                }
            }
        }
        
        // 立即刷新输出
        if (ob_get_level()) {
            ob_flush();
        }
        flush();
        
        // 休眠0.5秒减少CPU使用
        usleep(500000);
    }
    
    exit;
}

// 发送SSE事件
function sendSSEEvent($data) {
    $eventId = $data['timestamp'] ?? time();
    
    echo "id: {$eventId}\n";
    echo "event: {$data['type']}\n";
    echo "data: " . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
    
    // 立即刷新
    if (ob_get_level()) {
        ob_flush();
    }
    flush();
}

// 处理状态更新
function handleStatusUpdate() {
    file_put_contents('debug.log', date('Y-m-d H:i:s') . ' - 进入handleStatusUpdate函数' . "\n", FILE_APPEND);
    
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        file_put_contents('debug.log', date('Y-m-d H:i:s') . ' - 错误: 方法不允许: ' . $_SERVER['REQUEST_METHOD'] . "\n", FILE_APPEND);
        http_response_code(405);
        jsonResponse(false, '仅支持POST请求');
        return;
    }
    
    $input = file_get_contents('php://input');
    file_put_contents('debug.log', date('Y-m-d H:i:s') . ' - 原始输入数据: ' . $input . "\n", FILE_APPEND);
    
    $data = json_decode($input, true);
    $jsonError = json_last_error();
    file_put_contents('debug.log', date('Y-m-d H:i:s') . ' - JSON解码结果: ' . print_r($data, true) . ', 错误码: ' . $jsonError . "\n", FILE_APPEND);
    
    if ($jsonError !== JSON_ERROR_NONE) {
        file_put_contents('debug.log', date('Y-m-d H:i:s') . ' - JSON解码错误: ' . json_last_error_msg() . "\n", FILE_APPEND);
        http_response_code(400);
        jsonResponse(false, '无效的JSON数据: ' . json_last_error_msg());
        return;
    }
    
    if (!$data || !is_array($data)) {
        file_put_contents('debug.log', date('Y-m-d H:i:s') . ' - 错误: 无效的数据格式' . "\n", FILE_APPEND);
        http_response_code(400);
        jsonResponse(false, '无效的数据格式');
        return;
    }
    
    // 清理和验证数据
    $cleanedData = cleanInputData($data);
    file_put_contents('debug.log', date('Y-m-d H:i:s') . ' - 清理后的数据: ' . print_r($cleanedData, true) . "\n", FILE_APPEND);
    
    // 添加额外信息
    $cleanedData['lastUpdate'] = date('Y-m-d H:i:s');
    $cleanedData['clientIP'] = getClientIP();
    
    // 保存设备数据
    $devices = getDevicesData();
    file_put_contents('debug.log', date('Y-m-d H:i:s') . ' - 现有设备数据: ' . print_r($devices, true) . "\n", FILE_APPEND);
    
    $devices[$cleanedData['deviceId']] = $cleanedData;
    
    $saveResult = saveDevicesData($devices);
    file_put_contents('debug.log', date('Y-m-d H:i:s') . ' - 保存结果: ' . ($saveResult ? '成功' : '失败') . "\n", FILE_APPEND);
    
    if ($saveResult) {
        // 触发设备更新事件
        triggerDeviceUpdate($cleanedData['deviceId']);
        
        jsonResponse(true, '状态更新成功');
    } else {
        http_response_code(500);
        jsonResponse(false, '数据保存失败');
    }
}

// 获取设备列表
function getDevicesList() {
    $devices = cleanupExpiredDevices();
    
    jsonResponse(true, '', [
        'devices' => $devices,
        'count' => count($devices),
        'timestamp' => time()
    ]);
}

// 更新在线状态
function updateOnlineStatus() {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (!$data || !isset($data['sessionId'])) {
        jsonResponse(false, '无效的数据');
        return;
    }
    
    $onlineUsers = updateOnlineUser($data['sessionId']);
    jsonResponse(true, '', ['onlineUsers' => count($onlineUsers)]);
}

// 获取在线用户数
function getOnlineUsersCount() {
    $onlineUsers = cleanupExpiredUsers();
    jsonResponse(true, '', ['onlineUsers' => count($onlineUsers)]);
}

// 获取服务器信息
function getServerInfo() {
    $devices = getDevicesData();
    $onlineUsers = cleanupExpiredUsers();
    
    jsonResponse(true, '', [
        'info' => [
            'status' => '运行中',
            'server_time' => date('Y-m-d H:i:s'),
            'php_version' => PHP_VERSION,
            'online_devices' => count($devices),
            'online_users' => count($onlineUsers),
            'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown'
        ]
    ]);
}

// 列出背景文件
function listBackgroundFiles() {
    if (!isset($_GET['type'])) {
        jsonResponse(false, '缺少必要的参数');
        return;
    }
    
    $type = $_GET['type'];
    $files = [];
    
    if ($type === 'images') {
        $dir = __DIR__ . '/webimg/';
        $urlPrefix = 'webimg/';
        $extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    } elseif ($type === 'videos') {
        $dir = __DIR__ . '/webmp4/';
        $urlPrefix = 'webmp4/';
        $extensions = ['mp4', 'webm', 'ogg'];
    } else {
        jsonResponse(false, '无效的文件类型');
        return;
    }
    
    if (is_dir($dir)) {
        $dirFiles = scandir($dir);
        foreach ($dirFiles as $file) {
            $fileExt = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            if (in_array($fileExt, $extensions)) {
                $files[] = $urlPrefix . $file;
            }
        }
    }
    
    jsonResponse(true, '', ['files' => $files]);
}

// API路由处理
$action = $_GET['action'] ?? '';

// 添加调试日志
file_put_contents('debug.log', date('Y-m-d H:i:s') . ' - 请求: ' . $action . ', 方法: ' . $_SERVER['REQUEST_METHOD'] . ', IP: ' . getClientIP() . "\n", FILE_APPEND);
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $postData = file_get_contents('php://input');
    file_put_contents('debug.log', date('Y-m-d H:i:s') . ' - POST数据: ' . $postData . "\n", FILE_APPEND);
}

try {
    switch ($action) {
        case 'status':
            handleStatusUpdate();
            break;
        case 'devices':
            getDevicesList();
            break;
        case 'update_online':
            updateOnlineStatus();
            break;
        case 'get_online_users':
            getOnlineUsersCount();
            break;
        case 'server_info':
            getServerInfo();
            break;
        case 'events':  // SSE事件流
            handleEvents();
            break;
        case 'list_bg_files':
            listBackgroundFiles();
            break;
        default:
            jsonResponse(false, '未知操作');
    }
} catch (Exception $e) {
    file_put_contents('debug.log', date('Y-m-d H:i:s') . ' - 错误: ' . $e->getMessage() . "\n", FILE_APPEND);
    http_response_code(500);
    jsonResponse(false, '服务器错误: ' . $e->getMessage());
}
?>