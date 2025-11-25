/**
 * 在线用户管理器
 * 负责在线用户统计和状态管理
 */
class OnlineManager {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.onlineCount = 0;
        this.lastReportTime = null;
        this.isReporting = false;
    }

    /**
     * 生成唯一会话ID
     */
    generateSessionId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `session_${timestamp}_${random}`;
    }

    /**
     * 初始化在线管理器
     */
    async init() {
        console.log('初始化在线用户管理器，会话ID:', this.sessionId);
        
        // 初始上报在线状态
        await this.reportOnlineStatus();
        
        // 初始获取在线人数
        await this.updateOnlineDisplay();
        
        // 存储会话ID到localStorage
        this.saveSessionToStorage();
    }

    /**
     * 保存会话到本地存储
     */
    saveSessionToStorage() {
        try {
            const sessionData = {
                sessionId: this.sessionId,
                created: Date.now()
            };
            localStorage.setItem('monitor_session', JSON.stringify(sessionData));
        } catch (error) {
            console.warn('无法保存会话到本地存储:', error);
        }
    }

    /**
     * 从本地存储恢复会话
     */
    restoreSessionFromStorage() {
        try {
            const stored = localStorage.getItem('monitor_session');
            if (stored) {
                const sessionData = JSON.parse(stored);
                // 如果会话在1小时内创建，则恢复使用
                if (Date.now() - sessionData.created < 3600000) {
                    this.sessionId = sessionData.sessionId;
                    return true;
                }
            }
        } catch (error) {
            console.warn('从本地存储恢复会话失败:', error);
        }
        return false;
    }

    /**
     * 上报在线状态
     */
    async reportOnlineStatus() {
        if (this.isReporting) {
            console.log('在线状态上报中，跳过此次请求');
            return;
        }
        
        this.isReporting = true;
        
        try {
            const response = await fetch('api.php?action=update_online', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    timestamp: Date.now()
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.onlineCount = data.onlineUsers;
                this.lastReportTime = new Date();
                this.updateDisplay();
                
                console.log(`在线状态上报成功，当前在线: ${this.onlineCount}人`);
            } else {
                throw new Error(data.error || '上报失败');
            }
            
        } catch (error) {
            console.error('在线状态上报失败:', error);
            
            // 在界面上显示错误状态
            this.showErrorState();
            
        } finally {
            this.isReporting = false;
        }
    }

    /**
     * 获取在线人数
     */
    async updateOnlineDisplay() {
        try {
            const response = await fetch(`api.php?action=get_online_users&t=${Date.now()}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.onlineCount = data.onlineUsers;
                this.updateDisplay();
                
                console.log(`在线人数更新成功: ${this.onlineCount}人`);
            } else {
                throw new Error(data.error || '获取在线人数失败');
            }
            
        } catch (error) {
            console.error('获取在线人数失败:', error);
            this.showErrorState();
        }
    }

    /**
     * 更新显示
     */
    updateDisplay() {
        const onlineElement = document.getElementById('onlineUsers');
        const viewersElement = document.getElementById('viewers-count');
        
        if (onlineElement) {
            onlineElement.textContent = this.onlineCount;
            onlineElement.title = `最后更新: ${new Date().toLocaleTimeString('zh-CN')}`;
        }
        
        if (viewersElement) {
            viewersElement.textContent = this.onlineCount + ' 人';
            viewersElement.title = `当前在线观看人数: ${this.onlineCount}人`;
        }
        
        // 更新在线用户指示器样式
        this.updateOnlineIndicatorStyle();
    }

    /**
     * 更新在线指示器样式
     */
    updateOnlineIndicatorStyle() {
        const onlineElement = document.getElementById('onlineUsers');
        if (!onlineElement) return;
        
        // 根据在线人数改变颜色
        if (this.onlineCount === 0) {
            onlineElement.style.background = 'linear-gradient(135deg, #f44336, #da190b)';
        } else if (this.onlineCount < 5) {
            onlineElement.style.background = 'linear-gradient(135deg, #ff9800, #f57c00)';
        } else {
            onlineElement.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
        }
    }

    /**
     * 显示错误状态
     */
    showErrorState() {
        const onlineElement = document.getElementById('onlineUsers');
        const viewersElement = document.getElementById('viewers-count');
        
        if (onlineElement) {
            onlineElement.textContent = '?';
            onlineElement.style.background = 'linear-gradient(135deg, #9e9e9e, #757575)';
            onlineElement.title = '在线人数获取失败';
        }
        
        if (viewersElement) {
            viewersElement.textContent = '未知';
            viewersElement.title = '在线人数获取失败';
        }
    }

    /**
     * 获取在线人数
     */
    getOnlineCount() {
        return this.onlineCount;
    }

    /**
     * 获取会话ID
     */
    getSessionId() {
        return this.sessionId;
    }

    /**
     * 获取最后上报时间
     */
    getLastReportTime() {
        return this.lastReportTime;
    }

    /**
     * 检查是否需要重新上报（超过30秒未上报）
     */
    needsReReport() {
        if (!this.lastReportTime) return true;
        return (Date.now() - this.lastReportTime.getTime()) > 30000;
    }
}