<?php
// 测试status接口
$url = 'http://localhost/api.php?action=status';

// 测试数据
$test_data = [
    'deviceId' => 'test_device_123',
    'deviceName' => 'Test Device',
    'batteryLevel' => 85,
    'isCharging' => false,
    'wifiConnected' => true,
    'cellularConnected' => false,
    'networkType' => 'WiFi',
    'location' => 'Test Location',
    'currentApp' => 'Test App'
];

// 发送测试请求
$options = [
    'http' => [
        'header'  => "Content-type: application/json\r\n",
        'method'  => 'POST',
        'content' => json_encode($test_data)
    ]
];

$context  = stream_context_create($options);
$result = file_get_contents($url, false, $context);

// 输出结果
var_dump($result);
var_dump(json_decode($result, true));

// 检查data目录
var_dump('Data directory exists: ' . is_dir(__DIR__ . '/data'));
var_dump('Data directory permissions: ' . substr(sprintf('%o', fileperms(__DIR__ . '/data')), -4));
var_dump('Devices.json exists: ' . file_exists(__DIR__ . '/data/devices.json'));
if (file_exists(__DIR__ . '/data/devices.json')) {
    var_dump('Devices.json content: ' . file_get_contents(__DIR__ . '/data/devices.json'));
}
?>