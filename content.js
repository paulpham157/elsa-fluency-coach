chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  console.log('[FC] msg:', message.type, message.skill || '', 'path:', window.location.pathname)
  if (message.type === 'EXTRACT') {
    const url = window.location.pathname.replace(/\/+$/, '')
    const options = message.options || {}

    if (url === '/recordings' || url.match(/^\/recordings\/[a-f0-9-]+$/)) {
      const data = extractFromDom(document, options)
      sendResponse({ ok: true, page: 'overall', data: data })
    } else if (url.match(/^\/recordings\/[a-f0-9-]+\/(pronunciation|intonation|grammar|vocabulary)$/)) {
      const skill = url.split('/').pop()
      const data = extractMainSkillDetail(document, skill)
      sendResponse({ ok: true, page: 'skill', skill: skill, data: data })
    } else if (url.match(/^\/recordings\/[a-f0-9-]+\/fluency\/(pace|pausing|hesitations)$/)) {
      const skill = url.split('/').pop()
      const data = extractFluencySubPage(document, skill)
      sendResponse({ ok: true, page: 'skill', skill: skill, data: data })
    } else {
      sendResponse({ ok: false, error: 'Unrecognized page' })
    }
  } else if (message.type === 'NAVIGATE_SKILL') {
    navigateToSkill(message.skill, sendResponse)
    return true
  } else if (message.type === 'NAVIGATE_BACK') {
    navigateBack(sendResponse)
    return true
  }
  return true
})

function waitForEl(selector, callback, timeout) {
  var el = document.querySelector(selector)
  if (el) { callback(el); return }
  var observer = new MutationObserver(function () {
    var el = document.querySelector(selector)
    if (el) { observer.disconnect(); callback(el) }
  })
  observer.observe(document.body, { childList: true, subtree: true, attributes: true })
  if (timeout) {
    setTimeout(function () { observer.disconnect(); callback(null) }, timeout)
  }
}

function waitForUrl(urlPattern, callback, timeout) {
  var timer = timeout ? setTimeout(function () { callback(false) }, timeout) : null
  function poll() {
    if (window.location.pathname.match(urlPattern)) {
      if (timer) clearTimeout(timer)
      callback(true)
    } else {
      setTimeout(poll, 100)
    }
  }
  poll()
}

function getSkillTabName(skill) {
  var map = {
    pronunciation: 'Pronunciation',
    intonation: 'Intonation',
    grammar: 'Grammar',
    vocabulary: 'Vocabulary',
    fluency: 'Fluency',
  }
  var base = skill.split('/')[0]
  return map[base] || base
}

function clickTab(tabName) {
  var tabs = document.querySelectorAll('.wrapper-tabs__tab-item')
  var found = null
  tabs.forEach(function (tab) {
    var nameEl = tab.querySelector('.text-tab__skill')
    if (nameEl && nameEl.textContent.trim() === tabName) {
      found = tab
    }
  })
  if (found) found.click()
  return found
}

function clickFluencySubSkill(skill, sendResponse) {
  var subSkill = skill.split('/')[1]
  waitForEl('.accordion-sub-item__title-large', function (el) {
    if (!el) { sendResponse({ ok: false, error: 'Sub-skill list not found' }); return }
    var items = document.querySelectorAll('.accordion-sub-item')
    var clicked = false
    items.forEach(function (item) {
      var nameEl = item.querySelector('.accordion-sub-item__title-large')
      if (nameEl && nameEl.textContent.trim().toLowerCase() === subSkill) {
        item.click()
        clicked = true
      }
    })
    if (!clicked) { sendResponse({ ok: false, error: 'Sub-skill not found: ' + subSkill }); return }
    waitForUrl('/' + subSkill + '$', function (matched) {
      sendResponse({ ok: matched })
    }, 15000)
  }, 10000)
}

function navigateToSkill(skill, sendResponse) {
  console.log('[FC] navigateToSkill:', skill, 'path:', window.location.pathname)
  var tabName = getSkillTabName(skill)
  var skillBase = skill.split('/')[0]
  var isFluency = skill.indexOf('fluency/') === 0
  var onFluencySubPage = !!window.location.pathname.match(/\/fluency\/(pace|pausing|hesitations)$/)

  if (onFluencySubPage && isFluency) {
    clickFluencySubSkill(skill, sendResponse)
    return
  }

  clickTab(tabName)
  waitForEl('.' + skillBase + '-tab .link-to-text', function (link) {
    if (!link) { sendResponse({ ok: false, error: 'No link found' }); return }
    link.click()
    if (isFluency) {
      clickFluencySubSkill(skill, sendResponse)
    } else {
      waitForUrl('/' + skillBase + '$', function (matched) {
        sendResponse({ ok: matched })
      }, 15000)
    }
  }, 10000)
}

function navigateBack(sendResponse) {
  console.log('[FC] navigateBack path:', window.location.pathname)
  var backBtn = document.querySelector('.recording-overall__back')
  if (!backBtn) {
    sendResponse({ ok: false, error: 'No back button found' })
    return
  }
  backBtn.click()
  waitForEl('.wrapper-tabs', function (el) {
    sendResponse({ ok: !!el })
  }, 15000)
}
