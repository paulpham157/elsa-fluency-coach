chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === 'EXTRACT') {
    const url = window.location.pathname
    const options = message.options || {}

    if (url === '/recordings' || url.match(/^\/recordings\/[a-f0-9-]+$/)) {
      sendResponse({ ok: true, page: 'overall', data: extractFromDom(document, options) })
    } else if (url.match(/^\/recordings\/[a-f0-9-]+\/(pronunciation|intonation|grammar|vocabulary)$/)) {
      const skill = url.split('/').pop()
      sendResponse({ ok: true, page: 'skill', skill: skill, data: extractMainSkillDetail(document, skill) })
    } else if (url.match(/^\/recordings\/[a-f0-9-]+\/fluency\/(pace|pausing|hesitations)$/)) {
      const skill = url.split('/').pop()
      sendResponse({ ok: true, page: 'skill', skill: skill, data: extractFluencySubPage(document, skill) })
    } else {
      sendResponse({ ok: false, error: 'Unrecognized page' })
    }
  }
  return true
})

function extractMainSkillDetail(doc, skill) {
  var scoreEl = doc.querySelector('.recording-detail-score .apexcharts-datalabel-value')
  var levelEl = doc.querySelector('.recording-detail-score .apexcharts-datalabel-label')

  if (!scoreEl && !levelEl) {
    var noResultEl = doc.querySelector('.overall-score__speak-sub-title')
    return {
      skill: skill,
      overall: { score: '', level: '' },
      noResult: noResultEl ? noResultEl.textContent.trim() : null,
      subSkills: [],
      topErrors: [],
      tutorials: [],
    }
  }

  var subSkills = []
  doc.querySelectorAll('.skills__wrapper .skill-item').forEach(function (item) {
    var titleEl = item.querySelector('.skill-item__title')
    var levelEl = item.querySelector('.skill-item__level')
    if (titleEl) {
      subSkills.push({
        name: titleEl.textContent.trim(),
        level: levelEl ? levelEl.textContent.trim() : '',
      })
    }
  })

  var topErrors = []
  doc.querySelectorAll('.top-error .error-item').forEach(function (item) {
    var soundEl = item.querySelector('.error-item__header')
    var mistakesEl = item.querySelector('.error-item__mistakes')
    if (soundEl) {
      topErrors.push({
        sound: soundEl.textContent.trim(),
        mistakes: mistakesEl ? mistakesEl.textContent.trim() : '',
      })
    }
  })

  var tutorials = []
  doc.querySelectorAll('.skill-item__video-wrapper .video-item').forEach(function (item) {
    var titleEl = item.querySelector('.video-item__title')
    var imgEl = item.querySelector('.video-item__bg')
    if (titleEl) {
      tutorials.push({
        title: titleEl.textContent.trim(),
        url: imgEl ? imgEl.src : '',
      })
    }
  })

  return {
    skill: skill,
    overall: {
      score: scoreEl ? scoreEl.textContent.trim() : '',
      level: levelEl ? levelEl.textContent.trim() : '',
    },
    noResult: null,
    subSkills: subSkills,
    topErrors: topErrors,
    tutorials: tutorials,
  }
}

function extractFluencySubPage(doc, skill) {
  var fluencySubScores = []
  doc.querySelectorAll('.accordion-sub-item').forEach(function (item) {
    var nameEl = item.querySelector('.accordion-sub-item__title-large')
    var valueEl = item.querySelector('.accordion-sub-item__score-value')
    var labelEl = item.querySelector('.accordion-sub-item__title-small')
    if (nameEl) {
      fluencySubScores.push({
        name: nameEl.textContent.trim(),
        value: valueEl ? valueEl.textContent.trim() : '',
        label: labelEl ? labelEl.textContent.trim() : '',
      })
    }
  })

  var gaugeEl = doc.querySelector('.gauge-chart__text-wrapper')
  var gaugeValue = gaugeEl ? gaugeEl.querySelector('.gauge-chart__name') : null
  var gaugeLabel = gaugeEl ? gaugeEl.querySelector('.gauge-chart__label') : null

  return {
    skill: skill,
    fluencySubScores: fluencySubScores,
    gauge: {
      value: gaugeValue ? gaugeValue.textContent.trim() : '',
      label: gaugeLabel ? gaugeLabel.textContent.trim() : '',
    },
  }
}
