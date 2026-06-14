chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
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

function navigateToSkill(skill, sendResponse) {
  var tabName = getSkillTabName(skill)
  clickTab(tabName)

  waitForEl('.link-to-text', function (link) {
    if (!link) { sendResponse({ ok: false, error: 'No link found' }); return }

    var isFluency = skill.indexOf('fluency/') === 0
    if (isFluency) {
      link.click()
      var subSkill = skill.split('/')[1]
      waitForEl('.accordion-sub-item', function () {
        var links = document.querySelectorAll('.accordion-sub-item a, .accordion-sub-item')
        var clicked = false
        links.forEach(function (item) {
          var nameEl = item.querySelector('.accordion-sub-item__title-large')
          if (nameEl && nameEl.textContent.trim().toLowerCase() === subSkill) {
            if (item.tagName === 'A') item.click()
            else { var a = item.closest('a'); if (a) a.click() }
            clicked = true
          }
        })
        if (!clicked) { sendResponse({ ok: false, error: 'Sub-skill not found: ' + subSkill }); return }
        waitForEl('.gauge-chart__text-wrapper, .recording-detail-score', function () {
          sendResponse({ ok: true })
        }, 15000)
      }, 10000)
    } else {
      link.click()
      waitForEl('.recording-detail-score', function () {
        sendResponse({ ok: true })
      }, 15000)
    }
  }, 5000)
}

function navigateBack(sendResponse) {
  history.back()
  waitForEl('.wrapper-tabs', function (el) {
    sendResponse({ ok: true })
  }, 15000)
}
