<?php
// 注意：API请求现在由api.php处理
?>
?>

<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>手机状态监控系统</title>
    <link rel="stylesheet" href="css/style.css?v=1.0.2">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
</head>
<body>
    <!-- 背景视频容器 -->
    <div class="background-video-container">
        <video class="background-video" autoplay loop playsinline id="backgroundVideo"></video>
    </div>
    
    <!-- 动态背景 -->
    <div class="background"></div>
    

    
    <!-- 在线人数指示器 -->
    <div class="online-users">
        <span>👥 在线观看:</span>
        <div class="users-count" id="onlineUsers">0</div>
    </div>

    <div class="container">
        <header>
            <h1>📱 手机状态监控系统</h1>
            <p class="subtitle">实时监控连接的手机设备状态 - 专业版</p>
        </header>
        
        <div class="server-info">
            <div class="info-item">
                <div class="info-label">服务器状态</div>
                <div class="info-value" id="server-status">🟢 运行中</div>
            </div>
            <div class="info-item">
                <div class="info-label">已连接设备</div>
                <div class="info-value" id="connected-devices">0 台</div>
            </div>
            <div class="info-item">
                <div class="info-label">在线观看人数</div>
                <div class="info-value" id="viewers-count">0 人</div>
            </div>
            <div class="info-item">
                <div class="info-label">服务器时间</div>
                <div class="info-value" id="server-time"><?php echo date('H:i:s'); ?></div>
            </div>
        </div>
        
        <div class="controls">
            <button class="btn" id="refresh-btn">🔄 刷新状态</button>
            <button class="btn" id="background-btn">🎨 更换背景</button>
            <button class="btn" id="help-btn">❓ 使用帮助</button>
        </div>
        
        <div class="devices-grid" id="devices-container">
            <div class="no-devices" id="no-devices">
                <h3>📱 等待设备连接</h3>
                <p>暂无设备上报数据，请确保客户端脚本正在运行</p>
            </div>
        </div>
        
        <div class="last-update" id="last-update">
            最后更新: <?php echo date('Y-m-d H:i:s'); ?>
        </div>
    </div>

    <!-- JavaScript文件 -->
    <script src="js/main.js?v=1.0.1"></script>
    <script src="js/online.js?v=1.0.1"></script>
    <script src="js/devices.js?v=1.0.1"></script>
</body>
</html>