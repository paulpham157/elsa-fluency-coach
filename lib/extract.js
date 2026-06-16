function extractFromDom(document, options) {
  return {
    metadata: extractMetadata(document),
    skills: extractSkills(document),
    comparison: options.includeComparison ? extractComparison(document) : null,
    transcript: options.includeTranscript ? extractTranscript(document) : null,
  }
}

function extractMetadata(doc) {
  const titleInput = doc.querySelector('.recording-title__input')
  const titleText = doc.querySelector('.recording-title__text')
  const detailEls = doc.querySelectorAll('.recording-title__body-text')
  var title = ''
  if (titleInput && titleInput.value) title = titleInput.value
  else if (titleText) title = titleText.textContent.trim()
  return {
    title: title,
    date: detailEls[0] ? detailEls[0].textContent.trim() : '',
    duration: detailEls[1] ? detailEls[1].textContent.replace(/^Duration:\s*/i, '').trim() : '',
    speakingTime: detailEls[2] ? detailEls[2].textContent.replace(/^Speaking Time:\s*/i, '').trim() : '',
  }
}

function extractSkills(doc) {
  const items = doc.querySelectorAll('.text-tab')
  const scores = []
  items.forEach(function (item) {
    const nameEl = item.querySelector('.text-tab__skill')
    const scoreEl = item.querySelector('.text-tab__percent')
    if (nameEl && scoreEl) {
      var raw = scoreEl.textContent.trim()
      scores.push({
        name: nameEl.textContent.trim(),
        score: raw === 'N/A' ? null : parseFloat(raw),
        raw: raw,
      })
    }
  })
  return scores
}

function extractComparison(doc) {
  const section = doc.querySelector('.overall-score__compare') || doc.querySelector('.overall-comparison')
  if (!section) return []
  const items = section.querySelectorAll('.comparison-item')
  const results = []
  items.forEach(function (item) {
    const img = item.querySelector('.comparison-item__icon')
    const scoreEl = item.querySelector('.comparison-item__score')
    const labelEl = item.querySelector('.comparison-item__label')
    var maxEl = item.querySelector('.comparison-item__max-score') || item.querySelector('.comparison-item__max')
    if (!maxEl) {
      var wrapper = item.querySelector('.comparison-item__wrapper')
      if (wrapper) {
        var spans = wrapper.querySelectorAll('span')
        for (var i = 0; i < spans.length; i++) {
          if (spans[i].textContent.trim().indexOf('/') === 0) {
            maxEl = spans[i]
            break
          }
        }
      }
    }
    var name = ''
    if (img && img.src) {
      var match = img.src.match(/compare-(\w+)/)
      if (match) name = match[1].toUpperCase()
    }
    results.push({
      name: name || (img ? img.alt : ''),
      score: scoreEl ? scoreEl.textContent.trim() : '',
      label: labelEl ? labelEl.textContent.trim() : '',
      max: maxEl ? maxEl.textContent.trim().replace(/^\//, '') : '',
    })
  })
  return results
}

function extractTranscript(doc) {
  const list = doc.querySelector('.transcript__list')
  if (!list) return ''
  return list.textContent.trim()
}

function extractMainSkillDetail(doc, skill) {
  var scoreEl = doc.querySelector('.recording-detail-score .apexcharts-datalabel-value')
  var levelEl = doc.querySelector('.recording-detail-score .apexcharts-datalabel-label')
  var score = scoreEl ? scoreEl.textContent.trim() : ''
  var level = levelEl ? levelEl.textContent.trim() : ''

  var descEls = doc.querySelectorAll('.recording-detail-score__body p')
  var description = ''
  if (descEls.length) {
    var parts = []
    descEls.forEach(function (p) { parts.push(p.textContent.trim()) })
    description = parts.join(' ')
  }

  var noResult = null
  if (description && description.toLowerCase().indexOf('too short') !== -1) {
    noResult = description
    description = ''
  }

  var result = {
    skill: skill,
    overall: { score: score || 'N/A', level: level || 'Not Available' },
    noResult: noResult,
    description: description,
    pitchOverview: null,
    subSkills: [],
    topErrors: [],
    tutorials: [],
  }

  if (skill === 'pronunciation') {
    var skillItems = doc.querySelectorAll('.skills__wrapper .skill-item')
    if (skillItems.length) {
      result.subSkills = Array.from(skillItems).map(function (item) {
        var nameEl = item.querySelector('.skill-item__title')
        var levelEl = item.querySelector('.skill-item__level')
        return {
          name: nameEl ? nameEl.textContent.trim() : '',
          level: levelEl ? levelEl.textContent.trim() : '',
        }
      })
    }

    var errors = doc.querySelectorAll('.top-error .error-item')
    if (errors.length) {
      result.topErrors = Array.from(errors).map(function (item) {
        var header = item.querySelector('.error-item__header')
        var mistakes = Array.from(item.querySelectorAll('.mistake-item__text')).map(function (m) { return m.textContent.trim() }).join(', ')
        return { sound: header ? header.textContent.trim() : '', mistakes: mistakes }
      })
    }

    var videos = doc.querySelectorAll('.skill-item__video-wrapper')
    if (videos.length) {
      result.tutorials = Array.from(videos).map(function (v) {
        var titleEl = v.querySelector('.video-item__title')
        var thumbEl = v.querySelector('.video-item__bg')
        var title = titleEl ? titleEl.textContent.trim() : ''
        var url = ''
        if (thumbEl) {
          var src = thumbEl.getAttribute('src') || ''
          var match = src.match(/\/vi\/([^/]+)\//)
          if (match) url = 'https://www.youtube.com/watch?v=' + match[1]
        }
        return { title: title, url: url }
      }).filter(function (t) { return t.title })
    }
  }

  if (skill === 'intonation') {
    var pitchDesc = doc.querySelector('.pitch-overview__desc')
    if (pitchDesc) {
      result.pitchOverview = { description: pitchDesc.textContent.trim() }
    }
  }

  return result
}

function extractFluencySubPage(doc, skill) {
  var gaugeName = doc.querySelector('.gauge-chart__name')
  var gaugeLabel = doc.querySelector('.gauge-chart__label')

  var subScores = []
  var items = doc.querySelectorAll('.accordion-sub-item')
  items.forEach(function (item) {
    var nameEl = item.querySelector('.accordion-sub-item__title-large')
    var labelEl = item.querySelector('.accordion-sub-item__title-small')
    var valueEl = item.querySelector('.accordion-sub-item__score-value')
    if (nameEl) {
      subScores.push({
        name: nameEl.textContent.trim(),
        value: valueEl ? valueEl.textContent.trim() : '',
        label: labelEl ? labelEl.textContent.trim() : '',
      })
    }
  })

  return {
    skill: skill,
    fluencySubScores: subScores,
    gauge: {
      value: gaugeName ? gaugeName.textContent.trim() : '',
      label: gaugeLabel ? gaugeLabel.textContent.trim() : '',
    },
  }
}
