// 标题栏交互：按钮 → IPC；渲染导航态 / 最大化态。window.shell 由 preload 暴露。
const $ = (id) => document.getElementById(id)
const back = $('back'), fwd = $('forward'), home = $('home'), reload = $('reload')
const min = $('min'), max = $('max'), close = $('close')
const titleEl = $('title')
const bar = document.querySelector('.titlebar')

// 导航
back.onclick = () => shell.back()
fwd.onclick = () => shell.forward()
home.onclick = () => shell.home()
reload.onclick = () => shell.reload()

// 窗口控制
min.onclick = () => shell.minimize()
max.onclick = () => shell.toggleMaximize()
close.onclick = () => shell.close()

// 导航态由主进程算好下发，这里只渲染
shell.onNavState((s) => {
  back.disabled = !s.canGoBack
  fwd.disabled = !s.canGoForward
  titleEl.textContent = s.title || '腾讯视频'
  bar.classList.toggle('loading', !!s.loading)
})

// 最大化↔还原 图标切换
shell.onMaximizeChange((v) => bar.classList.toggle('is-max', v))
shell.isMaximized().then((v) => bar.classList.toggle('is-max', v))
