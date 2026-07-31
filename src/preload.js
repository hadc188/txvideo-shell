// preload：整页套壳 v.qq.com 的定制注入点。
// 1) 官方精简开关 electron_harmony_page（隐藏官方标记的推广/下载引导）
// 2) 深色暗底（配合主进程消白屏）
// 3) 界面优化：广告/推广/游戏/下载/弹幕隐藏 + 水印移除 + 片头广告跳过
//    选择器清单参考社区脚本 geoisam/FuckScripts「腾讯视频优化助手」v2.0.6，适配套壳环境。
//    注：sandbox 限制 preload 不能 require 本地模块，故内联于本文件。

// 优化开关（如需关闭某项，改这里即可）
const OPT = {
  navOnlyHistoryMessage: true, // 左侧导航精简（隐藏 客户端/创作/快捷访问/VIP 入口）
  hideBarrage: false,          // 隐藏弹幕相关内容（用户要看弹幕，已关闭此项）
  removeWatermark: true,       // 移除视频右上角 LOGO 水印
  skipVideoAd: true            // 跳过片头贴片广告
}

// 广告/推广/游戏浮层/下载引导/VIP 推广/播放器冗余 —— 静态隐藏清单
const ADBLOCK_CSS = `
.link_vip.__open_vip_tv, .playlist-vip-section__vip,
[id^="ad_"], [class$="-ad"], [class$="_ad"],
[id^="iwan-game"], #iwan-game, #iwan-game-pendant, #iwan-game-recommends,
#iwan-gamependant-page, #iwan-gamesearchrank-page,
a[href*="qqgame."], a[href*="iwan."],
.video-banner:has([data-ckey*="qqgame.qq.com"]),
.video-banner:has([data-ckey*="iwan.qq.com"]),
.video-card-wrap:has(.ad-flag),
.focus-list__item:has(.poster-ad),
.focus-title-wrap:has([class*="ad-"]),
.video-card-module [dt-params*="ad_"],
.client_download, .client-title, .tip_download, .fixed_box, .vip_act,
#ad_pc-index-vip-tips, #channel-vip-popup, #video-search-ad,
#ad_container, #ad_m-site, .game-switch-ad, .banner-ad, .txp_ad,
.player-comment-btn, .preview-mini-player, iframe[data-src*="mall."],
[class*="txp_full_screen_pause"], [data-role*="creative-player-pause"],
.open-app.old-open, .vip-adv-wrapper, .bottom-wrapper,
.at-app-banner, .quick_games, .quick_app { display: none !important; }
`

function buildCSS () {
  let css = `
    /* 官方精简兜底 + 深色暗底 + 页脚 + 深色滚动条 */
    .electron_harmony_page .electron_harmony_hide { display: none !important; }
    html { background: #141414; }
    .footer-menu { display: none !important; }
    /* 右下角悬浮工具：隐藏 问题反馈(第2项) 与 客服，保留 小窗播放/回到顶部 */
    #shortcut .shortcut-item:nth-child(2),
    #shortcut .shortcut-item:has(a[href*="kf.qq.com"]) { display: none !important; }
    /* 左侧导航底部：隐藏 客服（保留反馈等其它项） */
    .policy-txv-item:has(a[href*="kf.qq.com"]) { display: none !important; }

    /* 播放页精简：游戏广告、相关短视频、VIP 开通横幅
       （相关短视频必须用 id 前缀匹配，.episode-module-container 也用于剧集列表，不可整类隐藏） */
    .game-module-container,
    [id^="module-related_short_video"],
    .vip-container:has(.banner-content) { display: none !important; }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.18); border-radius: 5px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.28); }
  ` + ADBLOCK_CSS
  if (OPT.navOnlyHistoryMessage) css += `.quick_client,.quick_create,.quick_access,.quick_vip{display:none!important;}`
  if (OPT.hideBarrage) css += `[class*="-barrage"],[class*="barrage-"]{display:none!important;}iframe[src*="vfiles.gtimg.cn/tvideo/libcocos-frame"]{display:none!important;}`
  return css
}

// 纯 CSS 盖不掉的部分：水印移除 + 片头广告跳过
function applyDynamic () {
  if (OPT.removeWatermark) {
    const sel = '[id*="watermark"],[id*="WaterMark"],[id*="Watermark"],[class*="watermark"],[class*="WaterMark"],[class*="Watermark"]'
    const t = setInterval(() => document.querySelectorAll(sel).forEach(el => el.remove()), 1000)
    setTimeout(() => clearInterval(t), 15000) // 首屏 15s 内清理，之后停表省电
  }
  if (OPT.skipVideoAd) {
    setInterval(() => {
      document.querySelectorAll('.txp_ad video').forEach(ad => {
        try { if (ad.duration !== ad.currentTime) { ad.setAttribute('src', ''); ad.style.display = 'none' } } catch (e) {}
      })
      document.querySelectorAll('.txp_ad_control').forEach(el => { el.style.display = 'none' })
    }, 200)
  }
}

// 尽早执行：激活官方精简 + 页面暗底（减少首屏白闪）
try { document.documentElement.classList.add('electron_harmony_page') } catch (e) {}
try {
  const s0 = document.createElement('style')
  s0.textContent = 'html{background:#141414}'
  ;(document.head || document.documentElement).appendChild(s0)
} catch (e) {}

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('electron_harmony_page')
  const style = document.createElement('style')
  style.setAttribute('data-from', 'txv-shell')
  style.textContent = buildCSS()
  document.documentElement.appendChild(style)
  applyDynamic()

  // 自检日志（便于验证，可后续移除）
  setTimeout(() => {
    const els = document.querySelectorAll('.electron_harmony_hide')
    let hidden = 0
    els.forEach(e => { if (getComputedStyle(e).display === 'none') hidden++ })
    console.log(`[txv-shell] enhance on | harmony_hide ${hidden}/${els.length}`)
  }, 3000)
})
