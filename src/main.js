const path = require('path')
const { app, BrowserWindow, WebContentsView, ipcMain, shell, Tray, Menu, nativeImage, globalShortcut } = require('electron')

// 单实例锁：避免多开
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

const HOME_URL = 'https://v.qq.com/'
const PARTITION = 'persist:txvideo' // 持久化分区：登录态 / Cookie 重启保留
const TITLEBAR_H = 40               // 标题栏高度（DIP）
const BG = '#141414'               // 深色底，与 v.qq.com 内容一致
const TOGGLE_HOTKEY = 'CmdOrCtrl+Alt+V' // 全局快捷键：显示/隐藏主窗口

let win = null      // BrowserWindow：根页 = 标题栏
let content = null  // WebContentsView：v.qq.com 内容
let tray = null
let isQuitting = false // true 时才真正退出（否则关闭 = 最小化到托盘）
let isFullscreen = false
const appIcon = nativeImage.createFromPath(path.join(__dirname, 'tx.ico'))

function createWindow () {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false,          // 无边框
    show: false,           // 等 ready-to-show 再显示，消白屏
    backgroundColor: BG,   // 视图渲染前窗口即深色
    hasShadow: true,       // 配合默认 roundedCorners → Win11 原生圆角+阴影
    icon: appIcon,
    title: '腾讯视频',
    webPreferences: {
      preload: path.join(__dirname, 'titlebar', 'preload.js')
    }
  })
  win.loadFile(path.join(__dirname, 'titlebar', 'index.html')) // 根页 = 标题栏

  // 内容视图：v.qq.com
  content = new WebContentsView({
    webPreferences: {
      partition: PARTITION,
      preload: path.join(__dirname, 'preload.js')
    }
  })
  content.setBackgroundColor(BG)
  win.contentView.addChildView(content)

  const cwc = content.webContents

  // UA 清洗：去掉 Electron / 应用名标识，避免风控
  cwc.setUserAgent(cwc.getUserAgent().replace(/ (Electron|txvideo-shell)\/[\d.]+/g, ''))

  layout()
  win.on('resize', layout)
  win.on('maximize', () => { layout(); pushMax() })
  win.on('unmaximize', () => { layout(); pushMax() })
  win.on('enter-full-screen', () => { isFullscreen = true; layout(); pushMax() })
  win.on('leave-full-screen', () => { isFullscreen = false; layout(); pushMax() })

  // 关闭 → 最小化到托盘（而非退出）；仅 isQuitting 时真正关闭
  win.on('close', (e) => {
    if (!isQuitting) { e.preventDefault(); win.hide() }
  })

  // 外链分流：站内 qq.com 同窗导航，外部走系统浏览器
  cwc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\/([\w-]+\.)*qq\.com(\/|$)/i.test(url)) cwc.loadURL(url)
    else shell.openExternal(url)
    return { action: 'deny' }
  })

  // 常用快捷键（作用于内容视图）
  cwc.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    const nav = cwc.navigationHistory
    if (input.key === 'F5') cwc.reload()
    else if (input.alt && input.key === 'ArrowLeft') { if (nav.canGoBack()) nav.goBack() }
    else if (input.alt && input.key === 'ArrowRight') { if (nav.canGoForward()) nav.goForward() }
    else if (input.key === 'F11') win.setFullScreen(!win.isFullScreen())
    else if (input.control && input.shift && input.key.toLowerCase() === 'i') cwc.toggleDevTools()
  })

  // 关键路径可观测：主框架加载失败输出日志（-3 为主动中断，忽略）
  cwc.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3) console.error(`[load-fail] code=${code} ${desc} ${url}`)
  })

  // 导航态推送给标题栏（SPA 内部路由必听 did-navigate-in-page）
  for (const ev of ['did-navigate', 'did-navigate-in-page', 'did-start-loading', 'did-stop-loading', 'page-title-updated']) {
    cwc.on(ev, pushNavState)
  }

  // 消白屏：窗口就绪再显示；内容视图先藏，等站点加载完再露（+兜底）
  win.once('ready-to-show', () => win.show())
  content.setVisible(false)
  const reveal = () => { if (content) content.setVisible(true) }
  cwc.once('did-stop-loading', reveal)
  setTimeout(reveal, 8000)

  // 标题栏首帧就绪后推一次初值（早于此的 send 会丢）
  win.webContents.once('did-finish-load', () => { pushNavState(); pushMax() })

  cwc.loadURL(HOME_URL)
}

// 内容视图铺满标题栏之下；全屏时铺满整窗，用内容盖住标题栏
function layout () {
  if (!win || !content) return
  const { width, height } = win.getContentBounds()
  const top = isFullscreen ? 0 : TITLEBAR_H
  content.setBounds({ x: 0, y: top, width, height: height - top })
}

// —— 状态推送 ——
function pushNavState () {
  if (!win || win.isDestroyed() || !content) return
  const nav = content.webContents.navigationHistory
  win.webContents.send('nav:state', {
    canGoBack: nav.canGoBack(),
    canGoForward: nav.canGoForward(),
    title: content.webContents.getTitle(),
    loading: content.webContents.isLoading()
  })
}
function pushMax () {
  if (!win || win.isDestroyed()) return
  win.webContents.send('win:maximized', win.isMaximized())
}

// 显示并聚焦窗口（托盘/全局快捷键/二次启动用）
function showWindow () {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

// 系统托盘
function createTray () {
  tray = new Tray(appIcon)
  tray.setToolTip('腾讯视频')
  const menu = Menu.buildFromTemplate([
    { label: '显示主界面', click: showWindow },
    { type: 'separator' },
    {
      label: '开机自启',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
    },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit() } }
  ])
  tray.setContextMenu(menu)
  tray.on('click', showWindow)
  tray.on('double-click', showWindow)
}

// —— IPC：窗口控制 ——
ipcMain.on('win:minimize', () => win && win.minimize())
ipcMain.on('win:toggle-maximize', () => { if (win) win.isMaximized() ? win.unmaximize() : win.maximize() })
ipcMain.on('win:close', () => win && win.close()) // → close 事件拦截 → 最小化到托盘
ipcMain.handle('win:is-maximized', () => !!win && win.isMaximized())

// —— IPC：导航（作用于内容视图）——
ipcMain.on('nav:back', () => { const n = content && content.webContents.navigationHistory; if (n && n.canGoBack()) n.goBack() })
ipcMain.on('nav:forward', () => { const n = content && content.webContents.navigationHistory; if (n && n.canGoForward()) n.goForward() })
ipcMain.on('nav:reload', () => content && content.webContents.reload())
ipcMain.on('nav:home', () => content && content.webContents.loadURL(HOME_URL))

app.on('second-instance', showWindow)

app.whenReady().then(() => {
  createWindow()
  createTray()
  // 全局快捷键：显示 ↔ 隐藏主窗口
  globalShortcut.register(TOGGLE_HOTKEY, () => {
    if (win && win.isVisible() && !win.isMinimized()) win.hide()
    else showWindow()
  })
})

app.on('before-quit', () => { isQuitting = true })
app.on('will-quit', () => globalShortcut.unregisterAll())

// 关闭到托盘后后台驻留；仅在明确退出时结束
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) app.quit()
})
app.on('activate', () => { if (win === null) createWindow() })
