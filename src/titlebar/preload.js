// 标题栏 preload：仅向标题栏页面暴露"窗口控制 + 导航"通道，与内容页 preload 完全隔离。
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('shell', {
  // 窗口控制（命令用 send；状态用推送 + 初值 invoke）
  minimize: () => ipcRenderer.send('win:minimize'),
  toggleMaximize: () => ipcRenderer.send('win:toggle-maximize'),
  close: () => ipcRenderer.send('win:close'),
  isMaximized: () => ipcRenderer.invoke('win:is-maximized'),
  onMaximizeChange: (cb) => ipcRenderer.on('win:maximized', (_e, v) => cb(v)),

  // 导航
  back: () => ipcRenderer.send('nav:back'),
  forward: () => ipcRenderer.send('nav:forward'),
  reload: () => ipcRenderer.send('nav:reload'),
  home: () => ipcRenderer.send('nav:home'),
  onNavState: (cb) => ipcRenderer.on('nav:state', (_e, s) => cb(s)),
})
