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
  }
  return true
})

console.log('Fluency Coach content script loaded on', window.location.pathname)

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
      var thumbUrl = imgEl ? imgEl.src : ''
      var videoUrl = ''
      var match = thumbUrl.match(/\/vi\/([^/]+)\//)
      if (match) videoUrl = 'https://www.youtube.com/watch?v=' + match[1]
      tutorials.push({
        title: titleEl.textContent.trim(),
        url: videoUrl,
      })
    }
  })

  var description = ''
  var body = doc.querySelector('.recording-detail-score__body')
  if (body) {
    var paragraphs = body.querySelectorAll('p')
    var descParts = []
    paragraphs.forEach(function (p) { descParts.push(p.textContent.trim()) })
    description = descParts.filter(function (s) { return s }).join(' ')
  }

  var pitchOverview = null
  var pitchEl = doc.querySelector('.pitch-overview__desc')
  if (pitchEl) {
    pitchOverview = {
      description: pitchEl.textContent.trim(),
    }
  }

  return {
    skill: skill,
    overall: {
      score: scoreEl ? scoreEl.textContent.trim() : '',
      level: levelEl ? levelEl.textContent.trim() : '',
    },
    noResult: null,
    description: description,
    pitchOverview: pitchOverview,
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
