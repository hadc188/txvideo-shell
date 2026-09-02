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
  skipVideoAd: true,           // 跳过片头贴片广告
  vipParser: true              // VIP 解析：播放器工具栏加皇冠按钮，点击后用第三方解析站(jx.xmflv.com)原地替换官方播放器
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

// —— VIP 解析（内联自 Tampermonkey 脚本「Tencent VIP」v0.3，适配套壳环境）——
// 适配点：
//  1) sandbox preload 无 alert() → 改 console.warn
//  2) MUTE_SITE_MEDIA_ON_LOAD 改为 false：普通内容仍走官方播放器，
//     不能一进页面就强制静音；仅在点击按钮进入解析模式后静音官方媒体
//  3) 广告/高 z-index 浮层清理仅在解析模式激活后运行：
//     官方扫码登录浮层与历史面板同为高 z-index 浮层，无条件清理会误删它们
//  4) 油猴是 document-idle 注入，这里由 DOMContentLoaded 启动（时序更早，等价可用）
function startVipParser () {
  const PARSER_BASE_URL = 'https://jx.xmflv.com/?url='
  const MUTE_SITE_MEDIA_ON_LOAD = false
  const DESTROY_SITE_MEDIA_ON_REPLACE = false
  const TOOLBAR_SELECTOR = '.mod_player_action, .player_action, .txp_btn'
  const MORE_BUTTON_SELECTOR = '.txp_btn_more, .player_btn_more'
  const PLAYER_SELECTOR_CANDIDATES = [
    '#mod_player',
    '.mod_player',
    '.txp_wrapper',
    '#player_container',
    '.player_container',
    '[class*="player_container"]'
  ]
  const OVERLAY_SELECTORS = [
    '.txp_vip_cover',
    '.vip_cover',
    '#vip_cover',
    '.txp_cover',
    '.player_cover',
    '[class*="vip_cover"]',
    '[class*="txp_cover"]'
  ].join(',')
  const TRIAL_TIP_SELECTORS = [
    '.txp_tips',
    '.player_tips',
    '.vip_tips',
    '[class*="trial_tips"]',
    '[class*="vip_tips"]'
  ].join(',')
  const TRIAL_TIP_TEXT_FRAGMENTS = [
    '试看',
    '后结束',
    '开通VIP',
    'VIP会员'
  ]
  const AD_SELECTORS = [
    '#adv_wrap_hh',
    '[id*="adv_wrap"]',
    '[id*="ad_wrap"]',
    '#hmhrefurl',
    '#img-random-hm',
    '[class*="ad_"]',
    '[class*="advertisement"]',
    '[id*="ad_"]',
    '[id*="advertisement"]',
    '[style*="z-index: 1000000"]'
  ].join(',')

  const BUTTON_ID = 'custom_vip_more_btn'
  const LEGACY_BUTTON_ID = 'custom_vip_jiexi_btn'
  const BUTTON_LABEL = 'VIP'
  const BUTTON_MARKER = 'data-vip-custom-btn'
  const IFRAME_ID = 'custom_vip_jiexi_iframe'
  const IFRAME_WRAPPER_ID = 'custom_vip_jiexi_wrapper'
  const HIDDEN_NODE_ATTR = 'data-vip-hidden'
  const HOTKEYS_TO_BLOCK = new Set(['Space', 'ArrowLeft', 'ArrowRight'])
  const CROWN_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">',
    '<path fill="white" d="M5 16 3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5Zm0 2h14v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-1Z"/>',
    '</svg>'
  ].join('')

  let isJiexiMode = false
  let lastUrl = location.href
  let initTimer = 0
  const managedMedia = new WeakSet()

  document.addEventListener('keydown', interceptHotkeys, true)

  function interceptHotkeys (event) {
    if (!isJiexiMode) {
      return
    }

    const activeElement = document.activeElement
    if (activeElement && /^(INPUT|TEXTAREA)$/.test(activeElement.tagName)) {
      return
    }

    if (!HOTKEYS_TO_BLOCK.has(event.code)) {
      return
    }

    event.stopPropagation()
    event.stopImmediatePropagation()
  }

  function removeLegacyButton () {
    document.getElementById(LEGACY_BUTTON_ID)?.remove()
  }

  function getPlayerContainer () {
    for (const selector of PLAYER_SELECTOR_CANDIDATES) {
      const container = document.querySelector(selector)
      if (container) {
        return container
      }
    }

    const media = document.querySelector('video, audio')
    if (media) {
      return media.closest('#mod_player, .mod_player, .txp_wrapper, [class*="player_container"]')
    }

    return null
  }

  function removeVipOverlays () {
    document.querySelectorAll(OVERLAY_SELECTORS).forEach((node) => node.remove())
  }

  function removeTrialTips () {
    document.querySelectorAll(TRIAL_TIP_SELECTORS).forEach((node) => node.remove())

    const visited = new Set()
    const allElements = document.querySelectorAll('div, span')
    for (const element of allElements) {
      const text = (element.textContent || '').trim()
      if (!text || !TRIAL_TIP_TEXT_FRAGMENTS.some((fragment) => text.includes(fragment))) {
        continue
      }

      const container = element.closest(TRIAL_TIP_SELECTORS)
      if (container && !visited.has(container)) {
        visited.add(container)
        container.remove()
      }
    }
  }

  function removeAds () {
    document.querySelectorAll(AD_SELECTORS).forEach((node) => node.remove())

    const highZindexElements = document.querySelectorAll('div, a, img')
    highZindexElements.forEach((el) => {
      const style = window.getComputedStyle(el)
      const zIndex = parseInt(style.zIndex)
      if (zIndex >= 1000000) {
        el.remove()
      }
    })
  }

  function removeBlockingUi () {
    removeVipOverlays()
    removeTrialTips()
    removeAds()
  }

  function muteMediaElement (media) {
    if (!(media instanceof HTMLMediaElement)) {
      return
    }

    media.defaultMuted = true
    media.muted = true
    media.volume = 0
    media.setAttribute('muted', '')

    if (managedMedia.has(media)) {
      return
    }

    const enforceMute = () => {
      media.defaultMuted = true
      media.muted = true
      if (media.volume !== 0) {
        media.volume = 0
      }
    }

    media.addEventListener('play', enforceMute, true)
    media.addEventListener('volumechange', enforceMute, true)
    media.addEventListener('loadedmetadata', enforceMute, true)
    managedMedia.add(media)
  }

  function mutePageMedia () {
    document.querySelectorAll('video, audio').forEach(muteMediaElement)
  }

  function destroyMediaElement (media) {
    muteMediaElement(media)

    try {
      media.pause?.()
    } catch (error) {
      console.debug('pause failed', error)
    }

    media.removeAttribute('src')
    media.src = ''

    try {
      media.load?.()
    } catch (error) {
      console.debug('load failed', error)
    }
  }

  function destroyPageMedia () {
    document.querySelectorAll('video, audio').forEach(destroyMediaElement)
  }

  function hideOriginalPlayerUi (playerContainer) {
    playerContainer.style.position = 'relative'
    playerContainer.style.backgroundColor = '#000'

    const hideTargets = [...playerContainer.children].filter((child) => child.id !== IFRAME_WRAPPER_ID)
    hideTargets.forEach((child) => {
      if (child.id === IFRAME_WRAPPER_ID) {
        return
      }

      child.setAttribute(HIDDEN_NODE_ATTR, 'true')
      child.style.visibility = 'hidden'
      child.style.pointerEvents = 'none'
    })
  }

  function restoreOriginalPlayerUi () {
    document.getElementById(IFRAME_WRAPPER_ID)?.remove()
    document.querySelectorAll(`[${HIDDEN_NODE_ATTR}="true"]`).forEach((node) => {
      node.style.visibility = ''
      node.style.pointerEvents = ''
      node.removeAttribute(HIDDEN_NODE_ATTR)
    })
  }

  function preparePlayerContainer () {
    const playerContainer = getPlayerContainer()
    if (!playerContainer) {
      console.warn('[txv-shell][vip] player container not found, refresh and retry')
      return null
    }

    mutePageMedia()
    if (DESTROY_SITE_MEDIA_ON_REPLACE) {
      destroyPageMedia()
    }
    hideOriginalPlayerUi(playerContainer)
    removeBlockingUi()

    return playerContainer
  }

  function buildFallbackButton () {
    const button = document.createElement('div')
    button.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:4px;cursor:pointer;transition:transform 0.2s;'

    const icon = document.createElement('div')
    icon.style.cssText = 'width:20px;height:20px;'
    icon.innerHTML = CROWN_SVG

    button.appendChild(icon)
    return button
  }

  function styleButtonIcon (button) {
    const icons = button.querySelectorAll('svg')
    if (icons.length === 0) {
      const div = document.createElement('div')
      div.style.cssText = 'width:18px;height:18px;'
      div.innerHTML = CROWN_SVG
      button.innerHTML = ''
      button.appendChild(div)
    } else {
      icons.forEach(svg => {
        const path = svg.querySelector('path')
        if (path) {
          path.setAttribute('fill', '#f7d774')
        }
      })
    }
  }

  function createButton (templateButton) {
    const button = templateButton ? templateButton.cloneNode(true) : buildFallbackButton()

    button.id = BUTTON_ID
    button.setAttribute(BUTTON_MARKER, 'true')
    button.setAttribute('title', BUTTON_LABEL)
    button.setAttribute('aria-label', BUTTON_LABEL)
    button.dataset.aiEntity = BUTTON_LABEL
    button.dataset.aiIntent = 'Open the VIP parser in place of the current Tencent Video player.'
    button.style.cursor = 'pointer'

    button.querySelectorAll('span').forEach((node) => node.remove())
    styleButtonIcon(button)

    button.onmouseenter = () => {
      button.style.transform = 'scale(1.05)'
    }
    button.onmouseleave = () => {
      button.style.transform = ''
    }
    button.onclick = (event) => {
      event.preventDefault()
      event.stopPropagation()
      replacePlayer()
    }

    return button
  }

  function blockIframeAds (iframe) {
    try {
      const observer = new MutationObserver(() => {
        try {
          if (iframe.contentDocument) {
            const adSelectors = [
              '#adv_wrap_hh',
              '[id*="adv_wrap"]',
              '[id*="ad_wrap"]',
              '#hmhrefurl',
              '#img-random-hm',
              '[class*="ad_"]',
              '[class*="advertisement"]',
              '[id*="ad_"]',
              '[style*="z-index: 1000000"]',
              'a[href*="evewan.com"]',
              'img[src*="sogowan.com"]'
            ].join(',')

            iframe.contentDocument.querySelectorAll(adSelectors).forEach(el => el.remove())

            const allElements = iframe.contentDocument.querySelectorAll('*')
            allElements.forEach(el => {
              const style = window.getComputedStyle(el)
              const zIndex = parseInt(style.zIndex)
              if (zIndex >= 1000000) {
                el.remove()
              }
            })
          }
        } catch (e) {
        }
      })

      iframe.onload = () => {
        try {
          if (iframe.contentDocument) {
            observer.observe(iframe.contentDocument.documentElement, {
              childList: true,
              subtree: true
            })
          }
        } catch (e) {
        }
      }
    } catch (e) {
    }
  }

  // 退出官方播放器全屏（真全屏 + 网页伪全屏）。
  // 解析模式下官方控制栏已被隐藏，若不主动退出，用户将没有任何入口退出全屏。
  function exitOfficialFullscreen () {
    // 真全屏：Fullscreen API 直接退出
    try {
      if (document.fullscreenElement) document.exitFullscreen()
    } catch (e) {
    }

    // 网页伪全屏：播放器/body 挂 *fullscreen* class 铺满视口，逐元素摘除该类 token
    document.querySelectorAll('html, body, [class*="fullscreen"], [class*="full_screen"], [class*="full-screen"]').forEach((el) => {
      if (!el.classList?.length) return
      const kept = [...el.classList].filter((name) => !/full[-_ ]?screen/i.test(name))
      if (kept.length !== el.classList.length) el.className = kept.join(' ')
    })

    // 伪全屏通常伴随页面锁滚动，一并恢复
    try {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    } catch (e) {
    }
  }

  function replacePlayer () {
    const playerContainer = preparePlayerContainer()
    if (!playerContainer) {
      return
    }

    isJiexiMode = true
    exitOfficialFullscreen()
    console.log('[txv-shell][vip] parser on:', `${PARSER_BASE_URL}${encodeURIComponent(location.href)}`)
    document.getElementById(IFRAME_WRAPPER_ID)?.remove()

    const wrapper = document.createElement('div')
    wrapper.id = IFRAME_WRAPPER_ID
    wrapper.style.position = 'absolute'
    wrapper.style.inset = '0'
    wrapper.style.zIndex = '9999'
    wrapper.style.background = '#000'
    wrapper.style.pointerEvents = 'auto'

    const iframe = document.createElement('iframe')
    iframe.id = IFRAME_ID
    iframe.src = `${PARSER_BASE_URL}${encodeURIComponent(location.href)}`
    iframe.allow = 'autoplay; fullscreen; encrypted-media'
    iframe.allowFullscreen = true
    iframe.referrerPolicy = 'no-referrer-when-downgrade'
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock'
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = '0'
    iframe.style.display = 'block'
    iframe.style.background = '#000'

    blockIframeAds(iframe)

    wrapper.appendChild(iframe)
    playerContainer.appendChild(wrapper)
    removeBlockingUi()
  }

  function replaceMoreButton () {
    removeLegacyButton()

    const existingButton = document.getElementById(BUTTON_ID)
    if (existingButton?.isConnected) {
      return true
    }

    const moreButton = document.querySelector(MORE_BUTTON_SELECTOR)
    if (moreButton) {
      moreButton.replaceWith(createButton(moreButton))
      return true
    }

    const toolbar = document.querySelector(TOOLBAR_SELECTOR)
    if (toolbar) {
      toolbar.appendChild(createButton(null))
      return true
    }

    const player = getPlayerContainer()
    if (player) {
      const floatingBtn = document.createElement('div')
      floatingBtn.id = BUTTON_ID
      floatingBtn.setAttribute(BUTTON_MARKER, 'true')
      floatingBtn.style.cssText = 'position:absolute;top:10px;right:10px;z-index:1000;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:linear-gradient(180deg, #f7d774 0%, #d5a84a 100%);cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);'
      floatingBtn.innerHTML = CROWN_SVG
      floatingBtn.onclick = (e) => {
        e.preventDefault()
        e.stopPropagation()
        replacePlayer()
      }
      player.style.position = 'relative'
      player.appendChild(floatingBtn)
      return true
    }

    return false
  }

  function handleUrlChange () {
    if (location.href === lastUrl) {
      return
    }

    lastUrl = location.href
    isJiexiMode = false
    restoreOriginalPlayerUi()
  }

  function init () {
    handleUrlChange()
    replaceMoreButton()
    if (isJiexiMode) {
      mutePageMedia()
      removeBlockingUi()
    }
  }

  function scheduleInit () {
    if (initTimer) {
      return
    }

    initTimer = window.setTimeout(() => {
      initTimer = 0
      init()
    }, 100)
  }

  new MutationObserver(() => {
    handleUrlChange()

    if (isJiexiMode) {
      mutePageMedia()
      removeBlockingUi()
    }

    scheduleInit()
  }).observe(document.documentElement, { childList: true, subtree: true })

  setInterval(init, 1000)
  setInterval(() => {
    if (isJiexiMode) {
      mutePageMedia()
      removeAds()
    }
  }, 300)
  init()
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
  if (OPT.vipParser) startVipParser()

  // 自检日志（便于验证，可后续移除）
  setTimeout(() => {
    const els = document.querySelectorAll('.electron_harmony_hide')
    let hidden = 0
    els.forEach(e => { if (getComputedStyle(e).display === 'none') hidden++ })
    console.log(`[txv-shell] enhance on | harmony_hide ${hidden}/${els.length}`)
  }, 3000)
})
