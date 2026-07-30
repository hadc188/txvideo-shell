# 腾讯视频轻量客户端（第三方套壳）

一个基于 Electron 的腾讯视频轻量桌面外壳，整页承载官方网页版 `v.qq.com`，解决官方 PC 客户端臃肿的问题。**仅供个人学习与技术研究。**

## 特性

- **原生外壳**：无边框深色窗口 + 自定义标题栏（后退/前进/首页/刷新、最小化/最大化/关闭）、拖拽移动、启动无白屏、Win11 原生圆角与阴影
- **界面精简**：激活官方客户端精简模式（`electron_harmony_page`）自动隐藏推广元素；另隐藏广告位、游戏推广、下载引导、VIP 推广弹层、页脚、客服/反馈入口
- **观影优化**：跳过片头贴片广告、移除播放器右上角 LOGO 水印
- **桌面集成**：系统托盘、关闭最小化到托盘、全局快捷键 `Ctrl+Alt+V` 显示/隐藏、可选开机自启
- **登录持久化**：独立持久化分区，扫码登录一次长期保留

## 技术实现

- Electron 43，纯 JavaScript，无构建步骤
- `BrowserWindow(frame:false)` 的根页面作为标题栏，单个 `WebContentsView` 承载 `v.qq.com`
- 窗口控制与导航通过 IPC（`contextBridge` 暴露，不开 `nodeIntegration`）
- 页面定制通过 preload 注入 CSS

**不做任何逆向**：不逆向接口签名、不抓取视频流、不绕过 DRM。VIP 内容走官方登录与官方播放器解密，能播的内容与官方网页版完全一致。

## 开发

```bash
npm install
npm start
```

Windows 上 Electron 二进制建议用镜像下载：

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

> 重启前先清理残留进程，否则新实例会因单实例锁与缓存占用而立即退出：
> `taskkill //F //IM electron.exe`

## 打包

```bash
npm run dist
```

产物在 `dist/`：`TXVideo-Setup-*.exe`（安装版）、`TXVideo-Portable-*.exe`（免安装版）。

二进制依赖建议走镜像：

```bash
ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ npm run dist
```

## 自定义

- 优化项开关：`src/preload.js` 顶部的 `OPT`（弹幕隐藏、水印移除、片头广告跳过等）
- 隐藏更多元素：在 `src/preload.js` 的 CSS 清单里追加选择器
- 图标：`txv.ico`（exe/快捷方式，需 ≥256×256）、`src/tx.ico`（托盘与窗口）

## 致谢

- 界面优化选择器清单参考 [geoisam/FuckScripts](https://github.com/geoisam/FuckScripts) 的「腾讯视频优化助手」
- 项目结构思路参考 [hoowhoami/EchoMusic](https://github.com/hoowhoami/EchoMusic)

## 免责声明

- 本项目是基于官方网页版的第三方外壳，仅供个人学习和技术研究使用
- 不存储、不传播、不解密任何音视频内容；所有内容由官方网页播放器加载与播放
- 视频内容版权归腾讯及各版权方所有，「腾讯视频」名称与图标为腾讯所有，本项目与腾讯无任何关联
- 禁止用于任何商业用途；请勿对外分发
- 使用本项目产生的任何后果由使用者自行承担
