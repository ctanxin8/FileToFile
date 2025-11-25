# 快速文件传输系统
## 项目地址
https://github.com/ctanxin8/FileToFile
一个基于原生 JavaScript、CSS、HTML 和 PHP 的快速文件传输与文字分享系统，采用 CC-BY-NC 开源协议。
## 🎈在线体验
### Vue写法
https://shenyuzi.com/filetofile
### 原生写法
https://shenyuzi.com/file

## 📋 项目简介

这是一个简单高效的文件共享和文字聊天系统，允许用户通过自定义房间号创建隔离的共享空间，安全地传输文件和进行文字交流。

## ⚡ 主要功能

### 🏠 房间管理
- 自定义4位数字房间号
- 房间间完全隔离，确保数据安全
- 实时显示房间存储使用情况

### 📁 文件传输
- 多文件同时上传（最大1024MB/文件）
- 文件加密存储，下载时自动解密
- 支持拖拽上传
- 实时上传进度显示
- 文件类型安全检查（排除可执行文件）
- 文件列表实时更新
- 文件删除功能

### 💬 文字聊天
- 实时文字消息分享
- 消息时间戳显示
- 支持长文本消息
- 消息自动保存和加载

### 🔒 安全特性
- 文件服务器端加密存储
- 自动清理24小时前的文件和消息
- 文件类型安全检查
- 房间间数据隔离
- 防止XSS攻击

## 🛠️ 技术栈

### 前端
- **HTML5** - 页面结构
- **CSS3** - 样式和布局（渐变、阴影、动画）
- **原生 JavaScript** - 交互逻辑和AJAX通信

### 后端
- **PHP** - 服务器端逻辑
- **文件加密** - AES-256-CBC加密算法
- **JSON存储** - 数据和元信息存储

## 📁 项目结构
```bash
filetofile/
├── index.html # 主页面
├── css/
│ └── style.css # 样式文件
├── js/
│ └── script.js # 前端逻辑
└── php/
└── backend.php # 后端API
└── storage/ # 数据存储目录
└── rooms/ # 房间数据
└── room_id/
	─ files/ # 加密文件存储
    ─ messages/ # 消息存储
```


## 🚀 部署指南

### 环境要求
- PHP 7.0+
- Linux 服务器（推荐）或 Windows 本地开发环境
- 支持文件上传的 Web 服务器

### 部署步骤

1. **上传文件**
   ```bash
   	# 将项目文件上传到Web服务器
	# 进入项目目录
	cd /var/www/html/project
	# 创建存储目录并设置权限
	mkdir -p php/storage/rooms
	chmod 777 php/backend.php
	chmod -R 777 php/storage/
	```
## 配置调整

	如需在 Windows 本地开发，修改 backend.php 中的存储目录路径

	调整 MAX_FILE_SIZE 和 MAX_ROOM_SIZE 以适应服务器配置

	访问系统

	通过浏览器访问 http://yourserver/project/

## 本地开发

	修改 backend.php 中的存储目录配置：

		```php
		// Windows 系统调整
		define('STORAGE_DIR', __DIR__ . '\\storage\\');
		define('ROOMS_DIR', STORAGE_DIR . 'rooms\\');
		```
## 📖 使用说明
### 创建/加入房间
 - 在房间号输入框中输入4位数字

 - 点击"加入房间"按钮

 - 系统自动创建或加入现有房间

### 上传文件
 - 点击上传：点击上传区域选择文件

 - 拖拽上传：直接将文件拖拽到上传区域

 - 多文件选择：支持同时选择多个文件

### 文件管理
 - 下载文件：点击文件旁的下载按钮

 - 删除文件：点击文件旁的删除按钮

 - 查看进度：实时显示上传进度和速度

### 文字聊天
 - 在聊天输入框中输入消息

 - 按 Enter 键或点击"发送"按钮

 - 消息实时显示在聊天区域

⚙️ 配置参数
PHP 配置 (backend.php)
```php
// 文件大小限制
define('MAX_FILE_SIZE', 100 * 1024 * 1024); // 100MB
define('MAX_ROOM_SIZE', 1024 * 1024 * 1024); // 1GB

// 加密密钥（建议修改）
define('ENCRYPTION_KEY', 'your-secure-encryption-key-2025');

// 存储目录
define('STORAGE_DIR', __DIR__ . '/storage/');
```

## 前端配置 (script.js)
```javascript
// 房间存储限制
let roomStorage = {
    used: 0,
    max: 1024 * 1024 * 1024 // 1 GB
};
```
## 🔧 安全注意事项
###文件安全
 - 禁止上传可执行文件（.exe, .php, .sh等）

 - 所有文件加密存储

 - 自动清理24小时前的文件

###数据隔离
 - 房间间数据完全隔离

 - 每个房间有独立的存储空间

### 输入验证
 - 房间号格式验证（4位数字）

 - 文件类型安全检查

 - 消息内容HTML!转义

##🐛 故障排除
###常见问题
 - 文件上传失败

 - 检查 php/storage/ 目录权限

 - 验证 PHP 内存限制和执行时间

 - 检查文件大小是否超过限制

 - 房间数据不显示

 - 确认 backend.php 权限为 777

 - 检查存储目录是否可写

 - 查看浏览器控制台错误信息

 - 加密/解密错误

 - 验证加密密钥一致性

 - 检查 PHP OpenSSL 扩展是否启用

###日志检查
 - 查看服务器错误日志定位问题：

```bash
# Apache
tail -f /var/log/apache2/error.log

# Nginx
tail -f /var/log/nginx/error.log
📄 开源协议
本项目采用 CC-BY-NC 4.0 协议：
```
署名 - 必须给出适当的署名，提供指向本许可协议的链接，同时标明是否对原始内容作了修改

非商业性使用 - 不得将本材料用于商业目的

完整协议内容：https://creativecommons.org/licenses/by-nc/4.0/

##⚠️ 免责声明
本系统仅供学习和研究使用，作者不对因使用本系统而产生的任何直接或间接损失负责。在生产环境使用前，请进行充分的安全测试和评估。

##🤝 贡献
欢迎提交 Issue 和 Pull Request 来改进这个项目。

##📞 支持
如有问题或建议，请通过以下方式联系：

提交 GitHub Issue

查看项目文档
##🎈在线体验
### Vue写法
https://shenyuzi.com/filetofile
### 原生写法
https://shenyuzi.com/file

最后更新：2025年11月
作者：莘羽子
*协议：CC-BY-NC 4.0*