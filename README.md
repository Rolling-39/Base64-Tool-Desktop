# Base64 Tool (Desktop)

Tauri v2 桌面版 Base64 编解码工具。Rust 流式引擎 + 毛玻璃 UI，大文件 GB 级稳定编码。

[![Rust](https://img.shields.io/badge/Rust-1.77+-orange)](https://rust-lang.org)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue)](https://v2.tauri.app)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 功能

- **加密** — 文本/文件模式切换，流式编码直存（不经过内存），大文件不卡顿
- **解密** — 文本/文件模式切换，自动 30+ 种格式检测（图片/文档/音视频/压缩包），保留原名
- **批量** — 文件夹批量加密/解密，进度条 + 成功/失败/跳过统计，支持取消
- **日志** — 内置调试日志面板，一键复制

## 性能

| 场景 | Tauri (Rust) |
|------|-------------|
| 小文件 | < 1ms |
| 100MB 编码 | < 1s，内存 <10MB |
| 1GB 编码 | ~10s，内存 <10MB |
| GB 级文件 | 稳定，无 OOM |

## 运行

```bash
# 安装 Rust: https://rustup.rs
# 安装 Node.js >= 18

cd Base64-Tool-Desktop
npm install
npm run dev        # 开发模式
npm run build      # 构建 .exe
```

## 技术栈

- **后端**: Rust + `tauri 2` + `base64 0.22` 流式编解码
- **前端**: Vanilla HTML/CSS/JS + Vite, Material 3 毛玻璃主题
- **插件**: tauri-plugin-dialog / fs / clipboard-manager
- **文件识别**: 魔数检测 30+ 格式 (PNG/JPEG/PDF/ZIP/MP3/MP4/EXE/...)

## 项目结构

```
src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── capabilities/default.json
└── src/main.rs            # 13 个 Tauri 命令

src/
├── index.html             # 左栏毛玻璃导航 + 右内容区
├── styles.css             # 毛玻璃 + 深色模式 + 全屏适配
├── main.js                # 三面板交互逻辑
└── polyfill.js            # Tauri v2 API 桥接
```

---

© Rolling
