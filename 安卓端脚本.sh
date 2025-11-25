#!/system/bin/sh

# 手机状态监控客户端
# 将设备状态发送到PHP服务器

# 服务器配置
SERVER_URL="http://192.168.78.97/api.php?action=status"
DEVICE_ID=$(getprop ro.serialno)
if [ -z "$DEVICE_ID" ]; then
    DEVICE_ID="android_$(date +%s)"
fi
# 正常上报间隔
INTERVAL=10

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# 检测屏幕状态
is_screen_on() {
    # 方法1: 通过dumpsys power检测
    local screen_state=$(dumpsys power 2>/dev/null | grep -i "mScreenOn=true")
    if [ -n "$screen_state" ]; then
        echo "1"
        return
    fi
    
    # 方法2: 通过display状态检测
    local display_state=$(dumpsys display 2>/dev/null | grep -i "mScreenState=ON")
    if [ -n "$display_state" ]; then
        echo "1"
        return
    fi
    
    echo "0"
}

# 上报息屏状态
report_screen_off() {
    local device_name=$(getprop ro.product.model 2>/dev/null || echo 'Android Device')
    local status_json=$(printf '{"deviceId":"%s","deviceName":"%s","batteryLevel":0,"isCharging":0,"wifiConnected":0,"cellularConnected":0,"networkType":"ScreenOff","location":"设备息屏中","currentApp":"屏幕关闭"}' \
        "$DEVICE_ID" \
        "$device_name")
    
    send_json_data "$status_json" "息屏状态"
}

# 获取前台应用
get_foreground_app() {
    local app_info=$(dumpsys activity recents 2>/dev/null | grep -A10 'Recent #0')
    
    # 从cmp字段提取
    local current_app=$(echo "$app_info" | grep 'cmp=' | head -1 | sed 's/.*cmp=\([^/]*\).*/\1/')
    
    # 如果没找到，从origActivity字段提取
    if [ -z "$current_app" ]; then
        current_app=$(echo "$app_info" | grep 'origActivity=' | head -1 | sed 's/.*origActivity=\([^/]*\).*/\1/')
    fi
    
    # 如果还是没找到，从mActivityComponent字段提取
    if [ -z "$current_app" ]; then
        current_app=$(echo "$app_info" | grep 'mActivityComponent=' | head -1 | sed 's/.*mActivityComponent=\([^/]*\).*/\1/')
    fi
    
    echo "$current_app"
}

# 获取电池信息
get_battery_info() {
    local battery_info=$(dumpsys battery 2>/dev/null)
    local level=$(echo "$battery_info" | grep level | awk '{print $2}')
    local status=$(echo "$battery_info" | grep status | awk '{print $2}')
    
    if [ -z "$level" ]; then
        level=0
    fi
    
    local charging=0
    if [ "$status" = "2" ] || [ "$status" = "5" ]; then
        charging=1
    fi
    
    echo "$level $charging"
}

# 获取网络信息
get_network_info() {
    local wifi_connected=0
    local cellular_connected=0
    local network_type="Unknown"
    
    # 检查WiFi
    if iwconfig 2>/dev/null | grep -q "ESSID"; then
        wifi_connected=1
        network_type="WiFi"
    else
        cellular_connected=1
        network_type=$(getprop gsm.network.type 2>/dev/null)
        if [ -z "$network_type" ]; then
            network_type="Mobile"
        fi
    fi
    
    echo "$wifi_connected $cellular_connected $network_type"
}

# 安全字符串处理
safe_string() {
    echo "$1" | sed 's/"/\\"/g' | tr -d '\n\r\t'
}

# 生成设备状态JSON
generate_status() {
    # 设备信息
    local device_name=$(getprop ro.product.model)
    if [ -z "$device_name" ]; then
        device_name=$(getprop ro.product.device)
    fi
    if [ -z "$device_name" ]; then
        device_name="Android Device"
    fi
    device_name=$(safe_string "$device_name")
    
    # 电池信息
    local battery_info=$(get_battery_info)
    local battery_level=$(echo "$battery_info" | awk '{print $1}')
    local is_charging=$(echo "$battery_info" | awk '{print $2}')
    
    # 网络信息
    local network_info=$(get_network_info)
    local wifi_connected=$(echo "$network_info" | awk '{print $1}')
    local cellular_connected=$(echo "$network_info" | awk '{print $2}')
    local network_type=$(echo "$network_info" | awk '{print $3}')
    network_type=$(safe_string "$network_type")
    
    # 位置信息
    local location="♡这个不能告诉你们✿"
    location=$(safe_string "$location")
    
    # 应用信息
    local current_app=$(get_foreground_app)
    if [ -z "$current_app" ]; then
        current_app="未知应用"
    fi
    current_app=$(safe_string "$current_app")
    
    # 生成JSON - 严格格式
    printf '{"deviceId":"%s","deviceName":"%s","batteryLevel":%s,"isCharging":%s,"wifiConnected":%s,"cellularConnected":%s,"networkType":"%s","location":"%s","currentApp":"%s"}' \
        "$DEVICE_ID" \
        "$device_name" \
        "$battery_level" \
        "$is_charging" \
        "$wifi_connected" \
        "$cellular_connected" \
        "$network_type" \
        "$location" \
        "$current_app"
}

# 发送JSON数据
send_json_data() {
    local json_data="$1"
    local report_type="$2"
    
    if command -v curl > /dev/null; then
        local response=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "$json_data" \
            -w "HTTP_CODE:%{http_code}" \
            "$SERVER_URL" 2>/dev/null)
        
        local http_code=$(echo "$response" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)
        
        if [ "$http_code" = "200" ]; then
            log "$report_type 上报成功"
            return 0
        else
            log "$report_type 上报失败 - HTTP代码: $http_code"
            return 1
        fi
    else
        echo "$json_data" > /tmp/status.json
        if wget -q --post-file=/tmp/status.json --header="Content-Type: application/json" -O - "$SERVER_URL" > /dev/null 2>&1; then
            log "$report_type 上报成功"
            rm -f /tmp/status.json
            return 0
        else
            log "$report_type 上报失败"
            rm -f /tmp/status.json
            return 1
        fi
    fi
}

# 发送状态到服务器
send_status() {
    local status_json=$(generate_status)
    
    # 验证JSON格式
    if ! echo "$status_json" | grep -q '{.*}'; then
        log "错误: 生成的JSON格式无效"
        return 1
    fi
    
    send_json_data "$status_json" "设备状态"
}

# 屏幕状态监控循环
screen_monitor_loop() {
    local screen_off_reported=0
    
    while true; do
        local screen_state=$(is_screen_on)
        
        if [ "$screen_state" = "1" ]; then
            # 屏幕亮着
            if [ "$screen_off_reported" = "1" ]; then
                log "屏幕已亮，恢复状态上报"
                screen_off_reported=0
            fi
            
            # 正常上报状态
            send_status
            sleep $INTERVAL
            
        else
            # 屏幕关闭
            if [ "$screen_off_reported" = "0" ]; then
                log "屏幕已关闭，上报息屏状态"
                report_screen_off
                screen_off_reported=1
            fi
            
            # 等待屏幕亮起
            log "等待屏幕亮起..."
            local wait_count=0
            while [ "$(is_screen_on)" = "0" ] && [ $wait_count -lt 600 ]; do
                sleep 1
                wait_count=$((wait_count + 1))
                
                # 每30秒检查一次是否需要重新上报息屏状态
                if [ $((wait_count % 30)) -eq 0 ]; then
                    report_screen_off
                    log "息屏状态保持中..."
                fi
            done
        fi
    done
}

# 主循环
main() {
    log "手机状态监控客户端启动"
    log "设备ID: $DEVICE_ID"
    log "服务器: $SERVER_URL"
    log "支持息屏检测和实时推送"
    
    # 初始上报
    send_status
    
    # 进入屏幕监控循环
    screen_monitor_loop
}

# 信号处理
trap "log '客户端停止'; exit 0" INT TERM

# 运行
main