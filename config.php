<?php
// 设置默认时区
date_default_timezone_set('Asia/Shanghai');

// 系统配置
define('DB_FILE', __DIR__ . '/data/devices.json');
define('USERS_FILE', __DIR__ . '/data/online_users.json');
define('EVENT_FILE', __DIR__ . '/data/last_event.json'); // 新增事件文件
define('DEVICE_TIMEOUT', 30); // 设备超时30秒
define('ONLINE_TIMEOUT', 60); // 用户超时60秒

// 创建数据目录
if (!is_dir(__DIR__ . '/data')) {
    mkdir(__DIR__ . '/data', 0755, true);
    file_put_contents(DB_FILE, '{}');
    file_put_contents(USERS_FILE, '[]');
    file_put_contents(EVENT_FILE, '{}');
}

// 设置响应头 - 根据请求类型动态设置
if (!isset($_GET['action']) || $_GET['action'] !== 'events') {
    header('Content-Type: application/json; charset=utf-8');
}
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Last-Event-ID');

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// 获取客户端IP
function getClientIP() {
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($ips[0]);
    } elseif (!empty($_SERVER['HTTP_X_REAL_IP'])) {
        return $_SERVER['HTTP_X_REAL_IP'];
    } else {
        return $_SERVER['REMOTE_ADDR'];
    }
}

// 清理输入数据
function cleanInputData($data) {
    $cleaned = [];
    
    $cleaned['deviceId'] = isset($data['deviceId']) ? substr(trim($data['deviceId']), 0, 50) : 'unknown';
    $cleaned['deviceName'] = isset($data['deviceName']) ? substr(trim($data['deviceName']), 0, 50) : 'Android Device';
    
    $cleaned['batteryLevel'] = isset($data['batteryLevel']) ? max(0, min(100, intval($data['batteryLevel']))) : 0;
    $cleaned['isCharging'] = isset($data['isCharging']) ? (bool)$data['isCharging'] : false;
    $cleaned['wifiConnected'] = isset($data['wifiConnected']) ? (bool)$data['wifiConnected'] : false;
    $cleaned['cellularConnected'] = isset($data['cellularConnected']) ? (bool)$data['cellularConnected'] : false;
    
    $cleaned['networkType'] = isset($data['networkType']) ? substr(trim($data['networkType']), 0, 20) : 'Unknown';
    $cleaned['location'] = isset($data['location']) ? substr(trim($data['location']), 0, 50) : '位置未知';
    $cleaned['currentApp'] = isset($data['currentApp']) ? substr(trim($data['currentApp']), 0, 50) : '未知应用';
    
    return $cleaned;
}
?>