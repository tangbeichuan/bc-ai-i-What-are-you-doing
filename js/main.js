/**
 * 手机状态监控系统 - 主应用类
 * 负责协调各个模块，管理应用生命周期
 */
class MonitorApp {
    constructor() {
        this.deviceManager = new DeviceManager();
        this.onlineManager = new OnlineManager();
        this.isInitialized = false;
        this.lastUpdateTime = null;
        this.backgroundResources = {
            images: [],
            videos: []
        };
        
        // 视频背景音量控制
        this.videoVolume = 0.3; // 默认音量30%
        this.isVideoMuted = false;
        
        // 绑定this上下文
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.handleWindowFocus = this.handleWindowFocus.bind(this);
        this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    }

    /**
     * 初始化应用
     */
    async init() {
        if (this.isInitialized) {
            console.log('应用已经初始化');
            return;
        }
        
        try {
            console.log('开始初始化监控系统...');
            

            
            // 初始化管理器
            await this.onlineManager.init();
            await this.deviceManager.init();
            
            // 加载背景资源
            await this.loadBackgroundResources();
            
            // 设置定时任务
            this.setupIntervals();
            
            // 绑定事件监听器
            this.bindEventListeners();
            
            // 更新初始时间显示
            this.updateTimeDisplay();
            
            this.isInitialized = true;
            this.lastUpdateTime = new Date();
            
            // 自动随机应用背景
            this.applyRandomBackground();
            
            console.log('监控系统初始化完成');
            this.showNotification('系统就绪', '监控系统已成功启动', 'success');
            
        } catch (error) {
            console.error('初始化失败:', error);
            this.showNotification('初始化错误', '系统初始化失败: ' + error.message, 'error');
        }
    }

    /**
     * 创建浮动背景元素
     */


    /**
     * 设置定时任务
     */
    setupIntervals() {
        // 每3秒刷新设备状态
        this.deviceInterval = setInterval(() => {
            this.deviceManager.loadDevices();
        }, 3000);

        // 每5秒更新在线状态
        this.onlineInterval = setInterval(() => {
            this.onlineManager.reportOnlineStatus();
        }, 5000);

        // 每10秒更新在线人数显示
        this.onlineDisplayInterval = setInterval(() => {
            this.onlineManager.updateOnlineDisplay();
        }, 5000);

        // 每秒更新时间显示
        this.timeInterval = setInterval(() => {
            this.updateTimeDisplay();
        }, 1000);

        console.log('定时任务已启动');
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        // 刷新按钮
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.handleRefreshClick();
            });
        }

        // 背景切换按钮
        const backgroundBtn = document.getElementById('background-btn');
        if (backgroundBtn) {
            backgroundBtn.addEventListener('click', () => {
                this.changeBackground();
            });
        }

        // 帮助按钮
        const helpBtn = document.getElementById('help-btn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                this.showHelp();
            });
        }

        // 页面可见性变化
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // 窗口焦点事件
        window.addEventListener('focus', this.handleWindowFocus);

        // 页面关闭前
        window.addEventListener('beforeunload', this.handleBeforeUnload);

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        console.log('事件监听器已绑定');
    }

    /**
     * 处理刷新按钮点击
     */
    handleRefreshClick() {
        console.log('手动刷新设备状态');
        this.deviceManager.loadDevices(true);
        this.showNotification('刷新中', '正在获取最新设备状态...', 'info');
    }

    /**
     * 处理页面可见性变化
     */
    handleVisibilityChange() {
        if (!document.hidden) {
            console.log('页面变为可见，刷新数据');
            this.deviceManager.loadDevices(true);
            this.onlineManager.reportOnlineStatus();
        }
    }

    /**
     * 处理窗口焦点事件
     */
    handleWindowFocus() {
        console.log('窗口获得焦点，刷新数据');
        this.deviceManager.loadDevices(true);
        this.onlineManager.reportOnlineStatus();
    }

    /**
     * 处理页面关闭前
     */
    handleBeforeUnload() {
        console.log('页面关闭，清理资源');
        // 可以在这里发送离线状态，但navigator.sendBeacon更可靠
        if (navigator.sendBeacon) {
            const data = JSON.stringify({
                sessionId: this.onlineManager.sessionId,
                action: 'leave'
            });
            navigator.sendBeacon('api.php?action=update_online', data);
        }
    }

    /**
     * 处理键盘快捷键
     */
    handleKeyboardShortcuts(event) {
        // Ctrl+R 或 Cmd+R - 刷新
        if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
            event.preventDefault();
            this.handleRefreshClick();
        }
        
        // F5 - 刷新
        if (event.key === 'F5') {
            event.preventDefault();
            this.handleRefreshClick();
        }
        
        // F1 - 帮助
        if (event.key === 'F1') {
            event.preventDefault();
            this.showHelp();
        }
        
        // B - 切换背景（仅在非输入元素时）
        if (event.key === 'b' && !event.target.matches('input, textarea, select')) {
            event.preventDefault();
            this.showBackgroundManager();
        }
    }

    /**
     * 加载本地背景资源
     */
    async loadBackgroundResources(retries = 2) {
        try {
            // 加载本地图片资源
            const imagesResponse = await fetch('api.php?action=list_bg_files&type=images');
            if (imagesResponse.ok) {
                const response = await imagesResponse.json();
                this.backgroundResources.images = response.success ? response.files : [];
            }

            // 加载本地视频资源
            const videosResponse = await fetch('api.php?action=list_bg_files&type=videos');
            if (videosResponse.ok) {
                const response = await videosResponse.json();
                this.backgroundResources.videos = response.success ? response.files : [];
            }
        } catch (error) {
            console.warn('加载背景资源失败，尝试重试:', error);
            if (retries > 0) {
                // 重试加载资源
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.loadBackgroundResources(retries - 1);
            } else {
                // 重试失败，使用默认资源
                console.warn('背景资源加载失败，使用默认资源');
                this.backgroundResources.images = this.backgroundResources.images || [];
                this.backgroundResources.videos = this.backgroundResources.videos || [];
            }
        }
    }

    /**
     * 显示背景管理界面
     */
    showBackgroundManager() {
        // 如果背景资源未加载，先加载
        if (this.backgroundResources.images.length === 0 && this.backgroundResources.videos.length === 0) {
            this.loadBackgroundResources().then(() => {
                this.renderBackgroundManager();
            });
        } else {
            this.renderBackgroundManager();
        }
    }

    /**
     * 渲染背景管理界面
     */
    renderBackgroundManager() {
        // 创建背景管理器容器
        const bgManager = document.createElement('div');
        bgManager.className = 'background-manager';
        bgManager.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(10px);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            animation: fadeIn 0.3s ease-in forwards;
        `;

        // 创建内容面板
        const contentPanel = document.createElement('div');
        contentPanel.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px) saturate(200%);
            border-radius: 16px;
            padding: 30px;
            width: 90%;
            max-width: 1200px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            position: relative;
        `;

        // 创建标题
        const title = document.createElement('h2');
        title.textContent = '背景管理';
        title.style.cssText = `
            margin-top: 0;
            margin-bottom: 25px;
            color: #333;
            font-size: 28px;
            text-align: center;
            font-weight: 600;
        `;
        contentPanel.appendChild(title);

        // 创建背景类型选择
        const bgTypes = document.createElement('div');
        bgTypes.style.cssText = `
            display: flex;
            gap: 15px;
            margin-bottom: 25px;
            justify-content: center;
            flex-wrap: wrap;
        `;

        // 默认渐变背景
        const defaultBgBtn = document.createElement('button');
        defaultBgBtn.textContent = '默认渐变背景';
        defaultBgBtn.onclick = () => this.setBackgroundType('default');
        defaultBgBtn.style.cssText = this.getBgButtonStyle();
        bgTypes.appendChild(defaultBgBtn);

        // 自定义图片背景
        const imgBgBtn = document.createElement('button');
        imgBgBtn.textContent = '自定义图片背景';
        imgBgBtn.onclick = () => this.showBackgroundImages();
        imgBgBtn.style.cssText = this.getBgButtonStyle();
        bgTypes.appendChild(imgBgBtn);

        // 视频背景
        const videoBgBtn = document.createElement('button');
        videoBgBtn.textContent = '视频背景';
        videoBgBtn.onclick = () => this.showBackgroundVideos();
        videoBgBtn.style.cssText = this.getBgButtonStyle();
        bgTypes.appendChild(videoBgBtn);

        contentPanel.appendChild(bgTypes);

        // 创建手机状态监控系统元素背景设置
        const monitorBgSection = document.createElement('div');
        monitorBgSection.style.cssText = `
            border-top: 1px solid rgba(0, 0, 0, 0.1);
            padding-top: 25px;
            margin-top: 25px;
        `;

        const monitorBgTitle = document.createElement('h3');
        monitorBgTitle.textContent = '📱 手机状态监控系统元素背景设置';
        monitorBgTitle.style.cssText = `
            margin-top: 0;
            margin-bottom: 20px;
            color: #333;
            font-size: 20px;
            text-align: center;
            font-weight: 600;
        `;
        monitorBgSection.appendChild(monitorBgTitle);

        // 创建元素选择和背景设置区域
        const monitorElements = document.createElement('div');
        monitorElements.style.cssText = `
            display: grid;
            gap: 20px;
            margin-bottom: 20px;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
        `;

        // 主容器背景
        const containerBg = document.createElement('div');
        containerBg.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: rgba(240, 240, 240, 0.6);
            border-radius: 12px;
        `;
        containerBg.innerHTML = `
            <span>主容器背景</span>
            <button class="btn" style="${this.getBgButtonStyle()}">🎨 更改</button>
        `;
        containerBg.querySelector('.btn').onclick = () => this.setMonitorElementBg('.container');
        monitorElements.appendChild(containerBg);

        // 标题背景
        const headerBg = document.createElement('div');
        headerBg.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: rgba(240, 240, 240, 0.6);
            border-radius: 12px;
        `;
        headerBg.innerHTML = `
            <span>标题区域背景</span>
            <button class="btn" style="${this.getBgButtonStyle()}">🎨 更改</button>
        `;
        headerBg.querySelector('.btn').onclick = () => this.setMonitorElementBg('header');
        monitorElements.appendChild(headerBg);

        // 服务器信息面板背景
        const serverInfoBg = document.createElement('div');
        serverInfoBg.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: rgba(240, 240, 240, 0.6);
            border-radius: 12px;
        `;
        serverInfoBg.innerHTML = `
            <span>服务器信息面板背景</span>
            <button class="btn" style="${this.getBgButtonStyle()}">🎨 更改</button>
        `;
        serverInfoBg.querySelector('.btn').onclick = () => this.setMonitorElementBg('.server-info');
        monitorElements.appendChild(serverInfoBg);

        // 控制按钮背景
        const controlsBg = document.createElement('div');
        controlsBg.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: rgba(240, 240, 240, 0.6);
            border-radius: 12px;
        `;
        controlsBg.innerHTML = `
            <span>控制按钮区域背景</span>
            <button class="btn" style="${this.getBgButtonStyle()}">🎨 更改</button>
        `;
        controlsBg.querySelector('.btn').onclick = () => this.setMonitorElementBg('.controls');
        monitorElements.appendChild(controlsBg);

        // 设备卡片背景
        const deviceCardsBg = document.createElement('div');
        deviceCardsBg.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: rgba(240, 240, 240, 0.6);
            border-radius: 12px;
        `;
        deviceCardsBg.innerHTML = `
            <span>设备卡片背景</span>
            <button class="btn" style="${this.getBgButtonStyle()}">🎨 更改</button>
        `;
        deviceCardsBg.querySelector('.btn').onclick = () => this.setMonitorElementBg('.device-card');
        monitorElements.appendChild(deviceCardsBg);

        monitorBgSection.appendChild(monitorElements);
        contentPanel.appendChild(monitorBgSection);

        // 创建资源展示区
        const resourcesSection = document.createElement('div');
        resourcesSection.id = 'bgResourcesSection';
        resourcesSection.style.cssText = `
            animation: slideUp 0.4s ease-out;
        `;
        contentPanel.appendChild(resourcesSection);

        // 创建视频控制区
        const videoControls = document.createElement('div');
        videoControls.id = 'videoControls';
        videoControls.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            gap: 15px;
            background: rgba(0, 0, 0, 0.7);
            padding: 10px 20px;
            border-radius: 25px;
            backdrop-filter: blur(10px);
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 10000;
        `;
        
        // 静音/取消静音按钮
        const muteBtn = document.createElement('button');
        muteBtn.innerHTML = '🔊';
        muteBtn.id = 'muteBtn';
        muteBtn.onclick = () => this.toggleVideoMute();
        muteBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            padding: 5px;
            border-radius: 50%;
            transition: all 0.3s ease;
        `;
        muteBtn.onmouseover = () => muteBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        muteBtn.onmouseout = () => muteBtn.style.background = 'none';
        
        // 音量滑块
        const volumeSlider = document.createElement('input');
        volumeSlider.type = 'range';
        volumeSlider.id = 'volumeSlider';
        volumeSlider.min = '0';
        volumeSlider.max = '1';
        volumeSlider.step = '0.1';
        volumeSlider.value = this.videoVolume;
        volumeSlider.oninput = (e) => this.setVideoVolume(parseFloat(e.target.value));
        volumeSlider.style.cssText = `
            width: 100px;
            height: 5px;
            border-radius: 5px;
            background: rgba(255, 255, 255, 0.3);
            outline: none;
            -webkit-appearance: none;
        `;
        volumeSlider.style.webkitAppearance = 'none';
        volumeSlider.oninput = (e) => {
            this.setVideoVolume(parseFloat(e.target.value));
            // 更新滑块样式
            const value = e.target.value;
            e.target.style.background = `linear-gradient(to right, #ffffff 0%, #ffffff ${value * 100}%, rgba(255, 255, 255, 0.3) ${value * 100}%, rgba(255, 255, 255, 0.3) 100%)`;
        };
        
        videoControls.appendChild(muteBtn);
        videoControls.appendChild(volumeSlider);
        bgManager.appendChild(videoControls);

        // 创建关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => {
            bgManager.style.animation = 'fadeOut 0.3s ease-out forwards';
            setTimeout(() => bgManager.remove(), 300);
        };
        closeBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            color: white;
            font-size: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            font-weight: bold;
        `;
        closeBtn.onmouseover = () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
            closeBtn.style.transform = 'scale(1.1)';
        };
        closeBtn.onmouseout = () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
            closeBtn.style.transform = 'scale(1)';
        };
        bgManager.appendChild(closeBtn);

        // 添加动画样式
        const bgAnimations = document.createElement('style');
        bgAnimations.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(bgAnimations);

        bgManager.appendChild(contentPanel);
        document.body.appendChild(bgManager);
    }

    /**
     * 获取背景按钮样式
     */
    getBgButtonStyle() {
        return `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        `;
    }

    /**
     * 显示背景图片列表
     */
    showBackgroundImages() {
        const section = document.getElementById('bgResourcesSection');
        if (!section) return;

        section.innerHTML = '';

        const title = document.createElement('h3');
        title.textContent = '选择背景图片';
        title.style.cssText = `
            margin-top: 0;
            margin-bottom: 20px;
            color: #444;
            font-size: 20px;
            font-weight: 500;
            text-align: center;
        `;
        section.appendChild(title);

        const imagesGrid = document.createElement('div');
        imagesGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 15px;
            max-height: 400px;
            overflow-y: auto;
            padding: 10px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.5);
        `;

        // 添加随机图片选项
        const randomImgItem = document.createElement('div');
        randomImgItem.onclick = async () => {
            try {
                await this.setBackgroundImage('random');
            } catch (error) {
                console.warn('设置随机背景失败:', error);
            }
        };
        randomImgItem.style.cssText = `
            cursor: pointer;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transition: all 0.3s ease;
            aspect-ratio: 16/9;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 500;
            font-size: 14px;
            text-align: center;
            padding: 10px;
        `;
        randomImgItem.onmouseover = () => randomImgItem.style.transform = 'scale(1.05)';
        randomImgItem.onmouseout = () => randomImgItem.style.transform = 'scale(1)';
        randomImgItem.innerHTML = '<span>随机图片</span>';
        imagesGrid.appendChild(randomImgItem);

        // 显示本地图片
        this.backgroundResources.images.forEach(image => {
            const imgItem = document.createElement('div');
            imgItem.onclick = async () => {
                try {
                    await this.setBackgroundImage(image);
                } catch (error) {
                    console.warn('设置本地背景图片失败:', error);
                }
            };
            imgItem.style.cssText = `
                cursor: pointer;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                transition: all 0.3s ease;
                position: relative;
                aspect-ratio: 16/9;
            `;
            imgItem.onmouseover = () => imgItem.style.transform = 'scale(1.05)';
            imgItem.onmouseout = () => imgItem.style.transform = 'scale(1)';

            const img = document.createElement('img');
            img.src = image;
            img.alt = '背景图片';
            img.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
            `;

            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.3);
                opacity: 0;
                transition: opacity 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 500;
            `;
            overlay.innerHTML = '<span>使用此图片</span>';
            imgItem.onmouseover = () => overlay.style.opacity = '1';
            imgItem.onmouseout = () => overlay.style.opacity = '0';

            imgItem.appendChild(img);
            imgItem.appendChild(overlay);
            imagesGrid.appendChild(imgItem);
        });

        section.appendChild(imagesGrid);
    }

    /**
     * 显示背景视频列表
     */
    showBackgroundVideos() {
        const section = document.getElementById('bgResourcesSection');
        if (!section) return;

        section.innerHTML = '';

        const title = document.createElement('h3');
        title.textContent = '选择视频背景';
        title.style.cssText = `
            margin-top: 0;
            margin-bottom: 20px;
            color: #444;
            font-size: 20px;
            font-weight: 500;
            text-align: center;
        `;
        section.appendChild(title);

        const videosGrid = document.createElement('div');
        videosGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            max-height: 400px;
            overflow-y: auto;
            padding: 10px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.5);
        `;

        this.backgroundResources.videos.forEach(video => {
            const videoItem = document.createElement('div');
            videoItem.onclick = () => this.setBackgroundVideo(video);
            videoItem.style.cssText = `
                cursor: pointer;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                transition: all 0.3s ease;
                position: relative;
                aspect-ratio: 16/9;
            `;
            videoItem.onmouseover = () => videoItem.style.transform = 'scale(1.05)';
            videoItem.onmouseout = () => videoItem.style.transform = 'scale(1)';

            const videoPreview = document.createElement('video');
            videoPreview.src = video;
            videoPreview.muted = true;
            videoPreview.loop = true;
            videoPreview.playsInline = true;
            videoPreview.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
            `;
            videoPreview.onmouseover = () => videoPreview.play();
            videoPreview.onmouseout = () => videoPreview.pause();

            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.3);
                opacity: 0;
                transition: opacity 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 500;
            `;
            overlay.innerHTML = '<span>使用此视频</span>';
            videoItem.onmouseover = () => {
                overlay.style.opacity = '1';
                videoPreview.play();
            };
            videoItem.onmouseout = () => {
                overlay.style.opacity = '0';
                videoPreview.pause();
            };

            videoItem.appendChild(videoPreview);
            videoItem.appendChild(overlay);
            videosGrid.appendChild(videoItem);
        });

        section.appendChild(videosGrid);
    }

    /**
     * 设置背景类型
     */
    async setBackgroundType(type, resource = null) {
        const backgroundElement = document.querySelector('.background');
        const backgroundVideo = document.getElementById('backgroundVideo');
        
        if (!backgroundElement || !backgroundVideo) return;

        // 先重置所有背景
        backgroundElement.classList.remove('background-image');
        backgroundElement.style.backgroundImage = '';
        backgroundElement.style.animation = 'none'; // 禁用默认渐变动画
        backgroundVideo.classList.remove('active');
        backgroundVideo.src = '';

        switch (type) {
            case 'default':
                // 使用默认背景图片
                backgroundElement.style.background = '';
                backgroundElement.style.backgroundSize = 'cover';
                backgroundElement.style.backgroundPosition = 'center';
                backgroundElement.style.backgroundRepeat = 'no-repeat';
                this.showNotification('背景已更换', '成功切换到默认背景', 'success');
                break;
            
            case 'image':
                // 如果有资源，设置图片背景
                if (resource) {
                    try {
                        await this.setBackgroundImage(resource);
                    } catch (error) {
                        console.warn('设置图片背景失败:', error);
                        this.setBackgroundType('default');
                    }
                }
                break;
            
            case 'video':
                // 如果有资源，设置视频背景
                if (resource) {
                    try {
                        await this.setBackgroundVideo(resource);
                    } catch (error) {
                        console.warn('设置视频背景失败:', error);
                        this.setBackgroundType('default');
                    }
                }
                break;
        }
    }

    /**
     * 设置背景图片
     */
    setBackgroundImage(imageUrl, retries = 2) {
        return new Promise((resolve, reject) => {
            const backgroundElement = document.querySelector('.background');
            const backgroundVideo = document.getElementById('backgroundVideo');
            
            if (!backgroundElement || !backgroundVideo) {
                reject(new Error('背景元素不存在'));
                return;
            }

            // 停止视频
            backgroundVideo.classList.remove('active');
            backgroundVideo.src = '';

            // 设置图片背景
            backgroundElement.classList.add('background-image');
            backgroundElement.style.animation = 'none';
            
            if (imageUrl === 'random') {
                // 使用随机图片
                const randomImages = [
                    'https://source.unsplash.com/random/1920x1080/?technology,abstract',
                    'https://source.unsplash.com/random/1920x1080/?cyber,digital',
                    'https://source.unsplash.com/random/1920x1080/?network,data',
                    'https://source.unsplash.com/random/1920x1080/?future,tech',
                    'https://source.unsplash.com/random/1920x1080/?code,programming'
                ];
                const randomImg = randomImages[Math.floor(Math.random() * randomImages.length)];
                
                const tempImage = new Image();
                tempImage.onload = () => {
                    backgroundElement.style.backgroundImage = `url('${randomImg}')`;
                    this.showNotification('背景已更换', '成功切换到随机背景图片', 'success');
                    resolve();
                };
                tempImage.onerror = () => {
                    console.warn('背景图片加载失败，尝试重试:', randomImg);
                    if (retries > 0) {
                        // 重试加载不同的随机图片
                        setTimeout(() => {
                            this.setBackgroundImage('random', retries - 1)
                                .then(resolve)
                                .catch(reject);
                        }, 500);
                    } else {
                        this.showNotification('背景加载失败', '使用默认背景', 'warning');
                        this.setBackgroundType('default');
                        reject(new Error('背景图片加载失败'));
                    }
                };
                tempImage.src = randomImg;
            } else {
                // 使用本地图片
                const tempImage = new Image();
                tempImage.onload = () => {
                    backgroundElement.style.backgroundImage = `url('${imageUrl}')`;
                    this.showNotification('背景已更换', '成功切换到自定义背景图片', 'success');
                    resolve();
                };
                tempImage.onerror = () => {
                    console.warn('本地背景图片加载失败，尝试重试:', imageUrl);
                    if (retries > 0) {
                        // 重试加载相同的图片
                        setTimeout(() => {
                            this.setBackgroundImage(imageUrl, retries - 1)
                                .then(resolve)
                                .catch(reject);
                        }, 500);
                    } else {
                        this.showNotification('背景加载失败', '已切换到默认背景', 'warning');
                        this.setBackgroundType('default');
                        reject(new Error('本地背景图片加载失败'));
                    }
                };
                tempImage.src = imageUrl;
            }
        });
    }

    /**
     * 设置视频背景
     */
    async setBackgroundVideo(videoUrl) {
        const backgroundElement = document.querySelector('.background');
        const backgroundVideo = document.getElementById('backgroundVideo');
        
        if (!backgroundElement || !backgroundVideo) return;

        // 重置图片背景
        backgroundElement.classList.remove('background-image');
        backgroundElement.style.backgroundImage = '';
        backgroundElement.style.background = 'rgba(0, 0, 0, 0.3)';
        backgroundElement.style.animation = 'none';

        // 设置视频背景
        try {
            backgroundVideo.src = videoUrl;
            backgroundVideo.classList.add('active');
            backgroundVideo.muted = this.isVideoMuted;
            backgroundVideo.volume = this.isVideoMuted ? 0 : this.videoVolume;
            backgroundVideo.load();
            await backgroundVideo.play();
            
            this.showNotification('背景已更换', '成功切换到视频背景', 'success');
            this.showVideoControls(); // 显示视频控制
        } catch (error) {
            console.warn('视频背景加载失败:', error);
            // 视频加载失败时，切换回默认背景
            this.setBackgroundType('default');
            this.showNotification('视频加载失败', '已切换到默认背景', 'warning');
        }
    }

    /**
     * 显示视频控制
     */
    showVideoControls() {
        const videoControls = document.getElementById('videoControls');
        if (videoControls) {
            videoControls.style.opacity = '1';
        }
    }
    
    /**
     * 切换视频静音状态
     */
    toggleVideoMute() {
        const backgroundVideo = document.getElementById('backgroundVideo');
        const muteBtn = document.getElementById('muteBtn');
        
        if (!backgroundVideo || !muteBtn) return;
        
        this.isVideoMuted = !this.isVideoMuted;
        backgroundVideo.muted = this.isVideoMuted;
        
        // 更新按钮图标
        muteBtn.innerHTML = this.isVideoMuted ? '🔇' : '🔊';
    }
    
    /**
     * 设置视频音量
     */
    setVideoVolume(volume) {
        const backgroundVideo = document.getElementById('backgroundVideo');
        if (!backgroundVideo) return;
        
        this.videoVolume = parseFloat(volume);
        this.isVideoMuted = this.videoVolume === 0;
        
        // 更新视频音量
        backgroundVideo.volume = this.videoVolume;
        backgroundVideo.muted = this.isVideoMuted;
        
        // 更新静音按钮图标
        const muteBtn = document.getElementById('muteBtn');
        if (muteBtn) {
            muteBtn.innerHTML = this.isVideoMuted ? '🔇' : '🔊';
        }
    }

    /**
     * 设置手机状态监控系统元素背景
     */
    setMonitorElementBg(selector) {
        // 创建颜色选择器对话框
        const colorPickerDiv = document.createElement('div');
        colorPickerDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(10px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease-in forwards;
        `;

        // 创建内容面板
        const contentPanel = document.createElement('div');
        contentPanel.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px) saturate(200%);
            border-radius: 16px;
            padding: 30px;
            width: 90%;
            max-width: 400px;
            text-align: center;
        `;

        // 创建标题
        const title = document.createElement('h2');
        title.textContent = '选择背景颜色';
        title.style.cssText = `
            margin-top: 0;
            margin-bottom: 25px;
            color: #333;
            font-size: 22px;
            font-weight: 600;
        `;
        contentPanel.appendChild(title);

        // 创建颜色选择器
        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.id = 'elementBgColorPicker';
        colorPicker.value = '#ffffff';
        colorPicker.style.cssText = `
            width: 100px;
            height: 100px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            margin-bottom: 20px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        `;
        contentPanel.appendChild(colorPicker);

        // 创建透明度选择器
        const opacityLabel = document.createElement('label');
        opacityLabel.textContent = '透明度: 100%';
        opacityLabel.style.cssText = `
            display: block;
            margin-bottom: 10px;
            color: #333;
            font-weight: 500;
        `;
        contentPanel.appendChild(opacityLabel);

        const opacitySlider = document.createElement('input');
        opacitySlider.type = 'range';
        opacitySlider.id = 'elementBgOpacitySlider';
        opacitySlider.min = '0';
        opacitySlider.max = '100';
        opacitySlider.value = '100';
        opacitySlider.style.cssText = `
            width: 100%;
            margin-bottom: 20px;
        `;
        opacitySlider.oninput = () => {
            opacityLabel.textContent = `透明度: ${opacitySlider.value}%`;
        };
        contentPanel.appendChild(opacitySlider);

        // 创建应用按钮
        const applyBtn = document.createElement('button');
        applyBtn.textContent = '应用';
        applyBtn.onclick = () => {
            const color = colorPicker.value;
            const opacity = opacitySlider.value / 100;
            
            // 将颜色转换为rgba格式
            const hexToRgba = (hex, alpha) => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            };
            
            const rgbaColor = hexToRgba(color, opacity);
            
            // 应用颜色到所有匹配的元素
            const elements = document.querySelectorAll(selector);
            if (elements.length === 0) {
                this.showNotification('错误', '未找到匹配的元素', 'error');
                return;
            }
            
            elements.forEach(element => {
                // 保存原始背景样式，以便可以恢复
                if (!element.dataset.originalBackground) {
                    element.dataset.originalBackground = element.style.background || '';
                }
                
                // 设置新背景
                element.style.background = rgbaColor;
                
                // 如果元素有半透明背景和毛玻璃效果，保持毛玻璃效果
                if (element.classList.contains('container') || 
                    element.classList.contains('device-card') || 
                    element.classList.contains('server-info') || 
                    element.classList.contains('online-users')) {
                    element.style.backdropFilter = element.style.backdropFilter || 'blur(15px) saturate(120%)';
                }
            });
            
            this.showNotification('成功', `已更新${selector}的背景`, 'success');
            colorPickerDiv.remove();
        };
        applyBtn.style.cssText = `
            ${this.getBgButtonStyle()}
            margin-right: 10px;
        `;
        contentPanel.appendChild(applyBtn);

        // 创建取消按钮
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.onclick = () => colorPickerDiv.remove();
        cancelBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.8);
            color: #333;
            border: 1px solid rgba(0, 0, 0, 0.2);
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        `;
        contentPanel.appendChild(cancelBtn);

        // 创建恢复默认按钮
        const resetBtn = document.createElement('button');
        resetBtn.textContent = '恢复默认';
        resetBtn.onclick = () => {
            const elements = document.querySelectorAll(selector);
            if (elements.length === 0) {
                this.showNotification('错误', '未找到匹配的元素', 'error');
                return;
            }
            
            elements.forEach(element => {
                // 恢复原始背景
                if (element.dataset.originalBackground) {
                    element.style.background = element.dataset.originalBackground;
                } else {
                    // 如果没有保存原始背景，移除内联背景样式
                    element.style.background = '';
                }
            });
            
            this.showNotification('成功', `已恢复${selector}的默认背景`, 'success');
            colorPickerDiv.remove();
        };
        resetBtn.style.cssText = `
            display: block;
            margin: 15px auto 0;
            background: rgba(245, 87, 108, 0.1);
            color: #f5576c;
            border: 1px solid rgba(245, 87, 108, 0.3);
            padding: 10px 20px;
            border-radius: 20px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        contentPanel.appendChild(resetBtn);

        colorPickerDiv.appendChild(contentPanel);
        document.body.appendChild(colorPickerDiv);
    }
    
    /**
     * 自动应用随机背景
     */
    async applyRandomBackground(retries = 3) {
        const backgroundElement = document.querySelector('.background');
        const backgroundVideo = document.getElementById('backgroundVideo');
        
        if (!backgroundElement || !backgroundVideo) return;

        // 确保背景资源已加载
        if (this.backgroundResources.images.length === 0 && this.backgroundResources.videos.length === 0) {
            try {
                await this.loadBackgroundResources();
            } catch (error) {
                console.warn('加载背景资源失败，使用备选方案:', error);
            }
        }

        // 收集所有可用的背景资源
        const allResources = [];
        
        // 添加本地图片
        this.backgroundResources.images.forEach(img => {
            allResources.push({ type: 'image', url: img });
        });
        
        // 添加本地视频
        this.backgroundResources.videos.forEach(video => {
            allResources.push({ type: 'video', url: video });
        });
        
        // 添加随机图片作为备选
        allResources.push({ type: 'image', url: 'random' });
        
        // 如果没有可用资源，使用默认渐变背景
        if (allResources.length === 0) {
            this.setBackgroundType('default');
            return;
        }
        
        // 随机选择一个背景资源
        const randomResource = allResources[Math.floor(Math.random() * allResources.length)];
        
        // 应用选中的背景
        try {
            if (randomResource.type === 'image') {
                await this.setBackgroundImage(randomResource.url);
            } else if (randomResource.type === 'video') {
                await this.setBackgroundVideo(randomResource.url);
            }
        } catch (error) {
            console.warn('应用背景失败:', error);
            // 如果重试次数大于0，递归重试
            if (retries > 0) {
                console.log(`尝试重试背景加载，剩余次数: ${retries - 1}`);
                setTimeout(() => this.applyRandomBackground(retries - 1), 1000);
            } else {
                // 重试失败，使用默认背景
                console.log('重试失败，使用默认背景');
                this.setBackgroundType('default');
            }
        }
    }

    /**
     * 更新时间显示
     */
    updateTimeDisplay() {
        const timeElement = document.getElementById('server-time');
        if (timeElement) {
            const now = new Date();
            timeElement.textContent = now.toLocaleTimeString('zh-CN', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }

    /**
     * 更换背景
     */
    async changeBackground() {
        const backgroundElement = document.querySelector('.background');
        const backgroundVideo = document.getElementById('backgroundVideo');
        
        if (!backgroundElement || !backgroundVideo) return;

        // 确保背景资源已加载
        if (this.backgroundResources.images.length === 0 && this.backgroundResources.videos.length === 0) {
            try {
                await this.loadBackgroundResources();
            } catch (error) {
                console.warn('加载背景资源失败，使用备选方案:', error);
            }
        }

        // 收集所有可用的背景资源
        const allResources = [];
        
        // 添加本地图片
        this.backgroundResources.images.forEach(img => {
            allResources.push({ type: 'image', url: img });
        });
        
        // 如果视频目录有视频，添加本地视频
        if (this.backgroundResources.videos.length > 0) {
            this.backgroundResources.videos.forEach(video => {
                allResources.push({ type: 'video', url: video });
            });
        }
        
        // 如果没有可用资源，使用随机图片作为备选
        if (allResources.length === 0) {
            allResources.push({ type: 'image', url: 'random' });
        }
        
        // 随机选择一个背景资源
        const randomResource = allResources[Math.floor(Math.random() * allResources.length)];
        
        // 应用选中的背景
        try {
            if (randomResource.type === 'image') {
                await this.setBackgroundImage(randomResource.url);
            } else if (randomResource.type === 'video') {
                await this.setBackgroundVideo(randomResource.url);
            }
        } catch (error) {
            console.warn('更换背景失败:', error);
            this.showNotification('背景加载失败', '已切换到默认背景', 'warning');
            this.setBackgroundType('default');
        }
    }

    /**
     * 显示帮助信息
     */
    showHelp() {
        const helpText = `
📱 手机状态监控系统 - 使用说明

🔧 基本功能:
• 实时监控连接的手机设备状态
• 自动刷新设备信息（3秒间隔）
• 在线人数统计
• 毛玻璃视觉效果

🖥️ 设备信息显示:
• 设备名称和ID
• 电池电量和充电状态
• 网络连接状态
• 当前位置信息
• 当前运行应用
• 客户端IP地址

⌨️ 快捷键:
• F5 或 Ctrl+R - 手动刷新设备状态
• F1 - 显示帮助信息
• B - 打开背景管理器

🔄 自动刷新:
• 设备状态: 每3秒自动更新
• 在线人数: 每10秒自动更新
• 页面激活时立即刷新

📡 客户端配置:
服务器地址: ${window.location.origin}

如需添加新的监控设备，请确保客户端脚本正确配置并指向上述服务器地址。
        `.trim();

        this.showNotification('使用帮助', helpText, 'info', 10000);
    }

    /**
     * 显示通知
     */
    showNotification(title, message, type = 'info', duration = 5000) {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        notification.innerHTML = `
            <div class="notification-header">
                <span class="notification-icon">${icons[type] || icons.info}</span>
                <span class="notification-title">${title}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="notification-message">${message}</div>
        `;
        
        // 添加样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border-left: 4px solid ${this.getNotificationColor(type)};
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            max-width: 400px;
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // 自动移除
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.style.animation = 'slideOutRight 0.3s ease-in';
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
        }
    }

    /**
     * 获取通知颜色
     */
    getNotificationColor(type) {
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196F3'
        };
        return colors[type] || colors.info;
    }

    /**
     * 销毁应用，清理资源
     */
    destroy() {
        // 清理定时器
        if (this.deviceInterval) clearInterval(this.deviceInterval);
        if (this.onlineInterval) clearInterval(this.onlineInterval);
        if (this.onlineDisplayInterval) clearInterval(this.onlineDisplayInterval);
        if (this.timeInterval) clearInterval(this.timeInterval);
        
        // 移除事件监听器
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('focus', this.handleWindowFocus);
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        
        this.isInitialized = false;
        console.log('监控系统已销毁');
    }
}

// 应用名称配置
window.appNamesConfig = null;

/**
 * 加载应用名称配置
 */
const loadAppNamesConfig = async () => {
    try {
        const response = await fetch('config/app_names.json');
        if (!response.ok) {
            throw new Error(`加载应用名称配置失败: ${response.status}`);
        }
        window.appNamesConfig = await response.json();
        console.log('应用名称配置加载成功');
    } catch (error) {
        console.error('加载应用名称配置失败:', error);
        // 使用默认配置
        window.appNamesConfig = {
            appNames: {
                'com.miui.home': '小米桌面',
                'com.android.systemui': '系统UI',
                'com.android.settings': '设置',
                'com.tencent.mobileqq': 'QQ',
                'com.tencent.mm': '微信',
                'com.tencent.wework': '企业微信',
                'com.alibaba.android.rimet': '钉钉',
                'com.sina.weibo': '微博'
            }
        };
    }
};

// 加载应用名称配置
loadAppNamesConfig();

// 工具类定义
window.MonitorUtils = {
    /**
     * HTML特殊字符转义
     */
    escapeHtml: (text) => {
        if (typeof text !== 'string') return text;
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * 格式化时间
     */
    formatTime: (timestamp) => {
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return '时间格式错误';
            
            const now = new Date();
            const diff = now - date;
            
            // 如果是今天，显示时间
            if (date.toDateString() === now.toDateString()) {
                return date.toLocaleTimeString('zh-CN', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            }
            
            // 如果是昨天
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            if (date.toDateString() === yesterday.toDateString()) {
                return `昨天 ${date.toLocaleTimeString('zh-CN', {hour12: false, hour: '2-digit', minute: '2-digit'})}`;
            }
            
            // 其他情况显示完整时间
            return date.toLocaleString('zh-CN');
        } catch (error) {
            console.error('时间格式化错误:', error);
            return '时间错误';
        }
    },

    /**
     * 检查设备是否在线
     */
    isDeviceOnline: (lastUpdate) => {
        try {
            const updateTime = new Date(lastUpdate).getTime();
            const now = Date.now();
            return (now - updateTime) < 30000; // 30秒内在线
        } catch (error) {
            console.error('检查在线状态错误:', error);
            return false;
        }
    },

    /**
     * 获取电池状态类名
     */
    getBatteryClass: (level) => {
        if (level < 20) return 'battery-low';
        if (level < 60) return 'battery-medium';
        return 'battery-high';
    },

    /**
     * 防抖函数
     */
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * 获取网络类型显示名称
     */
    getNetworkTypeDisplay: (type) => {
        const networkTypes = {
            'WIFI': 'WiFi',
            'MOBILE': '移动网络',
            'UNKNOWN': '未知网络',
            'ETHERNET': '有线网络'
        };
        return networkTypes[type] || type;
    },

    /**
     * 将应用包名转换为友好的应用名称
     */
    getAppNameFromPackage: (packageName) => {
        if (typeof packageName !== 'string') return packageName;
        
        // 如果已经加载了应用名称映射，直接使用
        if (window.appNamesConfig && window.appNamesConfig.appNames) {
            return window.appNamesConfig.appNames[packageName] || packageName;
        }
        
        // 如果还没有加载配置，使用默认映射
        const defaultAppNames = {
            'com.miui.home': '小米桌面',
            'com.android.systemui': '系统UI',
            'com.android.settings': '设置',
            'com.tencent.mobileqq': 'QQ',
            'com.tencent.mm': '微信',
            'com.tencent.wework': '企业微信',
            'com.alibaba.android.rimet': '钉钉',
            'com.sina.weibo': '微博'
        };
        
        return defaultAppNames[packageName] || packageName;
    }
};

// 添加通知动画样式
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
    
    .notification-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s;
    }
    
    .notification-close:hover {
        background-color: rgba(0,0,0,0.1);
    }
    
    .notification-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-weight: bold;
    }
    
    .notification-message {
        white-space: pre-line;
        line-height: 1.4;
    }
`;
document.head.appendChild(notificationStyles);

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，启动监控系统...');
    
    // 创建全局应用实例
    window.monitorApp = new MonitorApp();
    
    // 初始化应用
    window.monitorApp.init().catch(error => {
        console.error('应用启动失败:', error);
    });
    
    // 在控制台显示欢迎信息
    console.log(`
    📱 手机状态监控系统已启动
    ==========================
    版本: 2.0.0
    服务器: ${window.location.origin}
    启动时间: ${new Date().toLocaleString('zh-CN')}
    ==========================
    输入 monitorApp 访问应用实例
    `);
});

// 导出到全局作用域已完成