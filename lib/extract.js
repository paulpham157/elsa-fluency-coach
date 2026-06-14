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
