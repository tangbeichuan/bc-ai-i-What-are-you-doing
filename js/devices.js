/**
 * 设备管理器 - 实时SSE版本
 * 使用Server-Sent Events实时接收设备状态更新
 */
class DeviceManager {
    constructor() {
        this.devices = {};
        this.eventSource = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.pollingInterval = null;
    }

    /**
     * 初始化设备管理器
     */
    async init() {
        console.log('初始化设备管理器 (SSE模式)...');
        await this.connectSSE();
    }

    /**
     * 连接SSE事件流
     */
    async connectSSE() {
        // 停止轮询（如果正在运行）
        this.stopPolling();
        
        if (this.eventSource) {
            this.eventSource.close();
        }

        try {
            this.eventSource = new EventSource('api.php?action=events');
            
            this.eventSource.onopen = (event) => {
                console.log('SSE连接已建立');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('connected');
            };
            
            this.eventSource.onmessage = (event) => {
                // 处理未指定事件类型的消息
                console.log('收到未指定类型的SSE消息:', event.data);
            };
            
            this.eventSource.onerror = (event) => {
                console.error('SSE连接错误:', event);
                this.isConnected = false;
                this.updateConnectionStatus('reconnecting');
                this.scheduleReconnect();
            };
            
            // 监听特定事件类型
            this.eventSource.addEventListener('connected', (event) => {
                this.handleConnectedEvent(JSON.parse(event.data));
            });
            
            this.eventSource.addEventListener('initial_data', (event) => {
                this.handleInitialDataEvent(JSON.parse(event.data));
            });
            
            this.eventSource.addEventListener('device_update', (event) => {
                this.handleDeviceUpdateEvent(JSON.parse(event.data));
            });
            
            this.eventSource.addEventListener('heartbeat', (event) => {
                this.handleHeartbeatEvent(JSON.parse(event.data));
            });
            
        } catch (error) {
            console.error('SSE连接失败:', error);
            this.isConnected = false;
            this.updateConnectionStatus('reconnecting');
            this.scheduleReconnect();
        }
    }

   // 在handleSSEError方法中添加更可靠的重连逻辑
handleSSEError(event) {
    console.error('SSE连接错误:', event);
    this.isConnected = false;
    this.updateConnectionStatus('disconnected');
    
    if (this.eventSource.readyState === EventSource.CLOSED) {
        console.log('SSE连接已关闭，尝试重连...');
        // 指数退避重连策略
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
            setTimeout(() => {
                this.reconnectAttempts++;
                this.connectSSE();
                this.updateConnectionStatus('reconnecting');
            }, delay);
        } else {
            console.error('达到最大重连次数，请刷新页面');
            if (window.monitorApp) {
                window.monitorApp.showNotification(
                    '连接已断开',
                    '无法重新连接到服务器，请刷新页面',
                    'error'
                );
            }
        }
    }
}

    /**
     * 处理SSE消息
     */
    handleSSEMessage(event) {
        console.log('SSE消息:', event);
        // 通用消息处理，特定事件由addEventListener处理
    }

    /**
     * 处理SSE错误
     */
    handleSSEError(event) {
        console.error('SSE连接错误:', event);
        this.isConnected = false;
        
        if (this.eventSource.readyState === EventSource.CLOSED) {
            console.log('SSE连接已关闭，尝试重连...');
            this.scheduleReconnect();
        }
    }

    /**
     * 处理连接事件
     */
    handleConnectedEvent(data) {
        console.log('SSE连接确认:', data);
        this.updateConnectionStatus('connected');
    }

    /**
     * 处理初始数据事件
     */
    handleInitialDataEvent(data) {
        console.log('收到初始设备数据:', data);
        this.devices = data.devices || {};
        this.updateDisplay();
        this.updateStats(data.count);
        this.updateLastUpdateTime();
    }

    // 修改handleDeviceUpdateEvent方法，确保UI立即更新
handleDeviceUpdateEvent(data) {
    console.log('收到设备实时更新:', data);
    
    if (data.device && data.deviceId) {
        // 立即更新内存中的设备数据
        this.devices[data.deviceId] = data.device;
        
        // 强制UI更新
        this.updateSingleDevice(data.deviceId);
        this.updateStats(data.totalDevices);
        this.updateLastUpdateTime();
        
        // 显示视觉反馈
        const card = document.querySelector(`[data-device-id="${data.deviceId}"]`);
        if (card) {
            card.classList.add('updated');
            setTimeout(() => card.classList.remove('updated'), 2000);
        }
        
        // 通知用户
        if (window.monitorApp) {
            window.monitorApp.showNotification(
                '设备已更新',
                `${data.device.deviceName} 的状态已更新`,
                'info',
                2000
            );
        }
    }
}

    /**
     * 处理心跳事件
     */
    handleHeartbeatEvent(data) {
        // 更新连接状态指示
        this.updateConnectionStatus('connected');
    }

    /**
     * 更新单个设备显示
     */
    updateSingleDevice(deviceId) {
        const device = this.devices[deviceId];
        if (!device) return;
        
        const container = document.getElementById('devices-container');
        if (!container) return;
        
        // 查找现有的设备卡片
        const existingCard = container.querySelector(`[data-device-id="${deviceId}"]`);
        
        if (existingCard) {
            // 更新现有卡片
            this.updateDeviceCard(existingCard, device);
        } else {
            // 创建新卡片
            this.addNewDeviceCard(device);
        }
    }

    /**
     * 更新设备卡片内容
     */
    updateDeviceCard(cardElement, device) {
        const isOnline = MonitorUtils.isDeviceOnline(device.lastUpdate);
        const batteryClass = MonitorUtils.getBatteryClass(device.batteryLevel);
        const networkType = MonitorUtils.getNetworkTypeDisplay(device.networkType);
        const isScreenOff = this.isDeviceSleeping(device);
        
        // 更新设备名称
        const nameElement = cardElement.querySelector('.device-name');
        if (nameElement) {
            nameElement.textContent = device.deviceName + (isScreenOff ? ' 💤' : '');
            nameElement.title = device.deviceName;
        }
        
        // 更新状态
        const statusElement = cardElement.querySelector('.device-status');
        if (statusElement) {
            const statusInfo = this.getDeviceStatusInfo(device);
            statusElement.className = `device-status ${statusInfo.class}`;
            statusElement.textContent = statusInfo.text;
        }
        
        // 更新电池信息
        const batteryLevelElement = cardElement.querySelector('.battery-level');
        if (batteryLevelElement) {
            batteryLevelElement.textContent = isScreenOff ? '💤 息屏中' : `${device.batteryLevel}%`;
        }
        
        // 更新电池条
        const batteryFillElement = cardElement.querySelector('.battery-fill');
        if (batteryFillElement) {
            if (isScreenOff) {
                batteryFillElement.className = 'battery-fill battery-sleep';
                batteryFillElement.style.width = '100%';
            } else {
                batteryFillElement.className = `battery-fill ${batteryClass}`;
                batteryFillElement.style.width = `${device.batteryLevel}%`;
            }
        }
        
        // 更新充电状态
        const chargingElement = cardElement.querySelector('.charging-status');
        if (chargingElement) {
            chargingElement.innerHTML = device.isCharging ? '<span style="color: #4CAF50;">🔌 充电中</span>' : '';
        }
        
        // 更新网络状态
        this.updateNetworkIndicator(cardElement, device, isScreenOff, networkType);
        
        // 更新位置
        const locationElement = cardElement.querySelector('.device-location');
        if (locationElement) {
            locationElement.textContent = device.location;
            locationElement.title = device.location;
        }
        
        // 更新应用
        const appElement = cardElement.querySelector('.device-app');
        if (appElement) {
            const appName = MonitorUtils.getAppNameFromPackage(device.currentApp);
            appElement.textContent = appName;
            appElement.title = device.currentApp;
        }
        
        // 更新IP
        const ipElement = cardElement.querySelector('.device-ip');
        if (ipElement) {
            ipElement.textContent = device.clientIP || '未知';
            ipElement.title = device.clientIP || '未知';
        }
        
        // 更新时间
        const timeElement = cardElement.querySelector('.update-time');
        if (timeElement) {
            timeElement.textContent = MonitorUtils.formatTime(device.lastUpdate);
            timeElement.title = MonitorUtils.formatTime(device.lastUpdate);
        }
        
        // 添加更新动画
        cardElement.style.animation = 'none';
        setTimeout(() => {
            cardElement.style.animation = 'pulseUpdate 0.5s ease-in-out';
        }, 10);
    }

    /**
     * 添加新设备卡片
     */
    addNewDeviceCard(device) {
        const container = document.getElementById('devices-container');
        const noDevices = document.getElementById('no-devices');
        
        // 隐藏"无设备"提示
        if (noDevices) {
            noDevices.style.display = 'none';
        }
        
        // 创建新卡片
        const cardHtml = this.generateDeviceCard(device, Object.keys(this.devices).length - 1);
        container.insertAdjacentHTML('beforeend', cardHtml);
        
        // 添加入场动画
        const newCard = container.lastElementChild;
        newCard.style.animation = 'cardAppear 0.5s ease-out';
    }

    /**
     * 更新网络指示器
     */
    updateNetworkIndicator(cardElement, device, isScreenOff, networkType) {
        const networkContainer = cardElement.querySelector('.network-indicator');
        if (!networkContainer) return;
        
        if (isScreenOff) {
            networkContainer.innerHTML = '<div class="network-tag sleep-tag" title="设备息屏">💤 息屏</div>';
        } else {
            let networkHtml = '';
            if (device.wifiConnected) {
                networkHtml += '<div class="network-tag wifi-tag" title="WiFi连接">WiFi</div>';
            }
            if (device.cellularConnected) {
                networkHtml += `<div class="network-tag cellular-tag" title="${networkType}连接">${MonitorUtils.escapeHtml(networkType)}</div>`;
            }
            if (!device.wifiConnected && !device.cellularConnected) {
                networkHtml += '<div class="network-tag no-network-tag" title="无网络连接">无网络</div>';
            }
            networkContainer.innerHTML = networkHtml;
        }
    }

    /**
     * 检查设备是否息屏
     */
    isDeviceSleeping(device) {
        return device.networkType === 'ScreenOff' || 
               device.currentApp === '屏幕关闭' ||
               device.location === '设备息屏中';
    }

    /**
     * 获取设备状态信息
     */
    getDeviceStatusInfo(device) {
        const isScreenOff = this.isDeviceSleeping(device);
        const isOnline = MonitorUtils.isDeviceOnline(device.lastUpdate);
        const hasNetworkConnection = device.wifiConnected || device.cellularConnected;
        
        if (isScreenOff) {
            return { text: '💤 息屏中', class: 'status-offline' };
        } else if (isOnline || hasNetworkConnection) {
            return { text: '🟢 在线', class: 'status-online' };
        } else {
            return { text: '🔴 离线', class: 'status-offline' };
        }
    }

    /**
     * 生成设备卡片HTML
     */
    generateDeviceCard(device, index) {
        const isOnline = MonitorUtils.isDeviceOnline(device.lastUpdate);
        const batteryClass = MonitorUtils.getBatteryClass(device.batteryLevel);
        const networkType = MonitorUtils.getNetworkTypeDisplay(device.networkType);
        const isScreenOff = this.isDeviceSleeping(device);
        const statusInfo = this.getDeviceStatusInfo(device);
        
        return `
        <div class="device-card ${isScreenOff ? 'sleeping' : (isOnline ? 'online' : 'offline')}" 
             data-device-id="${device.deviceId}"
             style="animation-delay: ${index * 0.1}s">
            <div class="device-header">
                <div class="device-name" title="${MonitorUtils.escapeHtml(device.deviceName)}">
                    ${MonitorUtils.escapeHtml(device.deviceName)}
                    ${isScreenOff ? ' 💤' : ''}
                </div>
                <div class="device-status ${statusInfo.class}">
                    ${statusInfo.text}
                </div>
            </div>
            
            <div class="status-item">
                <span class="status-label">设备ID:</span>
                <span class="status-value device-id" title="${MonitorUtils.escapeHtml(device.deviceId)}">
                    ${MonitorUtils.escapeHtml(device.deviceId)}
                </span>
            </div>
            
            <div class="status-item">
                <span class="status-label">电池状态:</span>
                <span class="status-value">
                    <span class="battery-level">${isScreenOff ? '💤 息屏中' : device.batteryLevel + '%'}</span>
                    <span class="charging-status">${device.isCharging ? '<span style="color: #4CAF50;">🔌 充电中</span>' : ''}</span>
                </span>
            </div>
            
            <div class="status-item">
                <span class="status-label">电量:</span>
                <div class="battery-container">
                    <div class="battery-fill ${isScreenOff ? 'battery-sleep' : batteryClass}" 
                         style="width: ${isScreenOff ? 100 : device.batteryLevel}%"
                         title="${isScreenOff ? '设备息屏' : '电池电量: ' + device.batteryLevel + '%'}">
                    </div>
                </div>
            </div>
            
            <div class="status-item">
                <span class="status-label">网络状态:</span>
                <div class="network-indicator">
                    ${isScreenOff ? 
                        '<div class="network-tag sleep-tag" title="设备息屏">💤 息屏</div>' : 
                        (device.wifiConnected ? 
                            '<div class="network-tag wifi-tag" title="WiFi连接">WiFi</div>' : 
                            (device.cellularConnected ? 
                                `<div class="network-tag cellular-tag" title="${networkType}连接">${MonitorUtils.escapeHtml(networkType)}</div>` : 
                                '<div class="network-tag no-network-tag" title="无网络连接">无网络</div>'
                            )
                        )
                    }
                </div>
            </div>
            
            <div class="status-item">
                <span class="status-label">当前位置:</span>
                <span class="status-value device-location" title="${MonitorUtils.escapeHtml(device.location)}">
                    ${MonitorUtils.escapeHtml(device.location)}
                </span>
            </div>
            
            <div class="status-item">
                <span class="status-label">当前应用:</span>
                <span class="status-value device-app" title="${MonitorUtils.escapeHtml(device.currentApp)}">
                    ${MonitorUtils.escapeHtml(MonitorUtils.getAppNameFromPackage(device.currentApp))}
                </span>
            </div>
            
            <div class="status-item">
                <span class="status-label">客户端IP:</span>
                <span class="status-value device-ip" title="${MonitorUtils.escapeHtml(device.clientIP || '未知')}">
                    ${MonitorUtils.escapeHtml(device.clientIP || '未知')}
                </span>
            </div>
            
            <div class="status-item">
                <span class="status-label">最后上报:</span>
                <span class="status-value update-time" title="${MonitorUtils.formatTime(device.lastUpdate)}">
                    ${MonitorUtils.formatTime(device.lastUpdate)}
                    ${!isOnline && !isScreenOff ? '<span style="color: #f44336; margin-left: 8px;">(已离线)</span>' : ''}
                </span>
            </div>
        </div>
        `;
    }

    /**
     * 更新连接状态
     */
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            if (status === 'connected') {
                statusElement.innerHTML = '🟢 实时连接';
                statusElement.title = '与服务器保持实时连接';
                statusElement.className = 'connection-status connected';
            } else if (status === 'disconnected') {
                statusElement.innerHTML = '🔴 已断开';
                statusElement.title = '与服务器连接已断开';
                statusElement.className = 'connection-status disconnected';
            } else if (status === 'reconnecting') {
                statusElement.innerHTML = '🟡 重连中...';
                statusElement.title = '尝试重新连接服务器';
                statusElement.className = 'connection-status reconnecting';
            } else {
                statusElement.innerHTML = '🟡 轮询模式';
                statusElement.title = '使用轮询模式更新设备状态';
                statusElement.className = 'connection-status connected';
            }
        }
    }

    /**
     * 计划重连
     */
    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * this.reconnectAttempts;
            
            console.log(`计划在 ${delay}ms 后重连 (尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connectSSE();
            }, delay);
        } else {
            console.error('SSE重连次数超限，切换到轮询模式');
            this.fallbackToPolling();
        }
    }

    /**
     * 回退到轮询模式
     */
    fallbackToPolling() {
        if (window.monitorApp) {
            window.monitorApp.showNotification(
                '实时连接失败',
                '已切换到轮询模式，设备状态更新可能有延迟',
                'warning',
                5000
            );
        }
        
        this.updateConnectionStatus('polling');
        // 启动轮询逻辑
        this.startPolling();
    }
    
    /**
     * 从服务器加载最新设备数据
     */
    async loadDevices() {
        try {
            const response = await fetch('api.php?action=devices');
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.devices) {
                    // 更新设备列表
                    const updatedDeviceIds = [];
                    const newDevices = {};
                    
                    // 检查哪些设备有更新
                    for (const deviceId in data.devices) {
                        const device = data.devices[deviceId];
                        newDevices[deviceId] = device;
                        
                        // 检查设备是否有更新
                        if (!this.devices[deviceId] || 
                            JSON.stringify(this.devices[deviceId]) !== JSON.stringify(device)) {
                            updatedDeviceIds.push(deviceId);
                        }
                    }
                    
                    // 更新内存中的设备数据
                    this.devices = newDevices;
                    
                    // 更新所有有变化的设备UI
                    updatedDeviceIds.forEach(deviceId => {
                        this.updateSingleDevice(deviceId);
                    });
                    
                    // 更新统计信息
                    this.updateStats(data.count);
                    this.updateLastUpdateTime();
                    
                    return true;
                }
            }
        } catch (error) {
            console.error('加载设备数据失败:', error);
        }
        return false;
    }
    
    /**
     * 启动轮询
     */
    startPolling() {
        // 清除之前的轮询定时器（如果存在）
        this.stopPolling();
        
        // 设置新的轮询定时器，每3秒更新一次
        this.pollingInterval = setInterval(() => {
            this.loadDevices();
        }, 3000);
        
        console.log('已启动轮询模式，每3秒更新一次设备状态');
    }
    
    /**
     * 停止轮询
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * 更新统计信息
     */
    updateStats(count) {
        const countElement = document.getElementById('connected-devices');
        if (countElement) {
            countElement.textContent = count + ' 台';
        }
        
        // 更新标题显示设备数量
        const onlineCount = Object.values(this.devices).filter(device => 
            MonitorUtils.isDeviceOnline(device.lastUpdate) && !this.isDeviceSleeping(device)
        ).length;
        
        document.title = `手机监控 (${onlineCount}在线) - 实时监控系统`;
    }

    /**
     * 更新最后更新时间
     */
    updateLastUpdateTime() {
        const updateElement = document.getElementById('last-update');
        if (updateElement) {
            const now = new Date();
            updateElement.textContent = `最后更新: ${now.toLocaleString('zh-CN')} (实时)`;
            updateElement.title = `实时更新中，最后刷新: ${now.toLocaleString('zh-CN')}`;
        }
    }

    /**
     * 更新整个显示（用于初始加载）
     */
    updateDisplay() {
        const container = document.getElementById('devices-container');
        const noDevices = document.getElementById('no-devices');
        
        if (!container) {
            console.error('设备容器未找到');
            return;
        }
        
        // 检查是否有设备
        if (!this.devices || Object.keys(this.devices).length === 0) {
            noDevices.style.display = 'block';
            container.innerHTML = `
                <div class="no-devices" id="no-devices">
                    <h3>📱 等待设备连接</h3>
                    <p>暂无设备上报数据，请确保客户端脚本正在运行</p>
                    <div style="margin-top: 20px; font-size: 0.9rem; color: #888;">
                        实时监听中... ${new Date().toLocaleTimeString('zh-CN')}
                    </div>
                </div>
            `;
            return;
        }
        
        noDevices.style.display = 'none';
        
        // 生成设备卡片HTML
        let html = '';
        Object.values(this.devices).forEach((device, index) => {
            html += this.generateDeviceCard(device, index);
        });
        
        container.innerHTML = html;
    }

    /**
     * 销毁清理
     */
    destroy() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        // 停止轮询
        this.stopPolling();
        this.isConnected = false;
    }
}