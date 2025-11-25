<?php
/**
 * 全面测试API接口功能
 */

// API地址
$apiUrl = 'http://localhost/api.php';

// 测试函数
function testApi($action, $data = []) {
    global $apiUrl;
    
    $url = $apiUrl . '?action=' . $action;
    $ch = curl_init();
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    if (!empty($data)) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Content-Length: ' . strlen(json_encode($data))
        ]);
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    curl_close($ch);
    
    return [
        'action' => $action,
        'status' => $httpCode,
        'response' => json_decode($response, true)
    ];
}

// 测试状态上报
function testStatusReport() {
    echo "=== 测试状态上报功能 ===\n";
    
    $testData = [
        'id' => 'test_device_001',
        'deviceName' => '测试设备',
        'screenOn' => true,
        'battery' => [
            'level' => 85,
            'status' => 'charging'
        ],
        'network' => [
            'type' => 'WIFI',
            'strength' => 'strong'
        ]
    ];
    
    $result = testApi('status', $testData);
    echo "状态上报: HTTP {$result['status']}\n";
    echo "响应: " . json_encode($result['response'], JSON_PRETTY_PRINT) . "\n\n";
    
    return $result['status'] == 200 && $result['response']['success'];
}

// 测试设备列表获取
function testDevicesList() {
    echo "=== 测试设备列表获取功能 ===\n";
    
    $result = testApi('get_devices');
    echo "获取设备列表: HTTP {$result['status']}\n";
    echo "响应: " . json_encode($result['response'], JSON_PRETTY_PRINT) . "\n\n";
    
    return $result['status'] == 200;
}

// 测试在线状态获取
function testOnlineStatus() {
    echo "=== 测试在线状态获取功能 ===\n";
    
    $result = testApi('get_online_status');
    echo "获取在线状态: HTTP {$result['status']}\n";
    echo "响应: " . json_encode($result['response'], JSON_PRETTY_PRINT) . "\n\n";
    
    return $result['status'] == 200;
}

// 测试背景文件列表
function testBackgroundFiles() {
    echo "=== 测试背景文件列表功能 ===\n";
    
    // 测试图片列表
    $imagesResult = testApi('list_bg_files', ['type' => 'images']);
    echo "获取图片列表: HTTP {$imagesResult['status']}\n";
    echo "响应: " . json_encode($imagesResult['response'], JSON_PRETTY_PRINT) . "\n\n";
    
    // 测试视频列表
    $videosResult = testApi('list_bg_files', ['type' => 'videos']);
    echo "获取视频列表: HTTP {$videosResult['status']}\n";
    echo "响应: " . json_encode($videosResult['response'], JSON_PRETTY_PRINT) . "\n\n";
    
    return $imagesResult['status'] == 200 && $videosResult['status'] == 200;
}

// 运行所有测试
echo "开始测试API接口功能...\n\n";

$tests = [
    'statusReport' => '状态上报',
    'devicesList' => '设备列表',
    'onlineStatus' => '在线状态',
    'backgroundFiles' => '背景文件列表'
];

$results = [];
foreach ($tests as $function => $name) {
    $results[$name] = call_user_func($function);
}

// 输出测试总结
echo "=== 测试总结 ===\n";
foreach ($results as $name => $success) {
    echo $name . ': ' . ($success ? '通过' : '失败') . "\n";
}

// 检查数据目录
echo "\n=== 数据目录检查 ===\n";
if (is_dir('data')) {
    echo "data目录存在\n";
    
    $files = scandir('data');
    echo "目录内容: " . implode(', ', array_diff($files, ['.', '..'])) . "\n";
    
    if (file_exists('data/devices.json')) {
        echo "devices.json存在，内容: " . file_get_contents('data/devices.json') . "\n";
    } else {
        echo "devices.json不存在\n";
    }
} else {
    echo "data目录不存在\n";
}

// 检查调试日志
if (file_exists('debug.log')) {
    echo "\n=== 调试日志最后20行 ===\n";
    $logContent = file_get_contents('debug.log');
    $lines = explode("\n", $logContent);
    $lastLines = array_slice($lines, -20);
    echo implode("\n", $lastLines);
} else {
    echo "\n调试日志不存在\n";
}
