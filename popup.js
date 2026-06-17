var state = {
  tabId: null,
  url: '',
}

var SKILL_TABS = ['pronunciation', 'intonation', 'fluency/pace', 'fluency/pausing', 'fluency/hesitations', 'grammar', 'vocabulary']

document.addEventListener('DOMContentLoaded', function () {
  setupEventListeners()
  checkCurrentTab()
  restoreLastReport()
})

function setupEventListeners() {
  document.getElementById('extractBtn').addEventListener('click', handleExtract)
  document.getElementById('copyBtn').addEventListener('click', handleCopy)
}

function checkCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs.length === 0) return
    state.tabId = tabs[0].id
    state.url = tabs[0].url || ''
  })
}

function showStatus(msg, isError) {
  var el = document.getElementById('status')
  el.textContent = msg
  el.className = 'status' + (isError ? ' error' : '')
  el.classList.remove('hidden')
}

function hideStatus() {
  document.getElementById('status').classList.add('hidden')
}

function handleExtract() {
  hideStatus()
  chrome.storage.local.remove('lastReport')
  document.getElementById('output').style.display = 'none'
  document.getElementById('outputActions').classList.add('hidden')
  document.getElementById('extractBtn').disabled = true
  document.getElementById('extractBtn').textContent = 'Extracting...'

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs.length || !tabs[0].url || !tabs[0].url.includes('speechanalyzer.elsaspeak.com')) {
      showStatus('Open a recording page on ELSA Speech Analyzer first.', true)
      document.getElementById('extractBtn').disabled = false
      document.getElementById('extractBtn').textContent = 'Extract Data'
      return
    }

    askOverall(tabs[0])
  })
}

function askOverall(tab) {
  var options = {
    includeTranscript: true,
    includeComparison: true,
  }

  chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT', options: options }, function (response) {
    if (chrome.runtime.lastError) {
      showStatus('Cannot reach the page. Try reloading it.', true)
      document.getElementById('extractBtn').disabled = false
      document.getElementById('extractBtn').textContent = 'Extract Data'
      return
    }

    if (!response || !response.ok) {
      showStatus('Failed to extract data: ' + (response ? response.error : 'unknown'), true)
      document.getElementById('extractBtn').disabled = false
      document.getElementById('extractBtn').textContent = 'Extract Data'
      return
    }

    var allResults = [response.data]
    extractSkillDetails(SKILL_TABS, tab, allResults)
  })
}

function extractSkillDetails(skills, tab, results) {
  var i = 0

  function next() {
    if (i >= skills.length) {
      finishExtract(results, tab)
      return
    }
    var skill = skills[i++]

    chrome.tabs.sendMessage(tab.id, { type: 'NAVIGATE_SKILL', skill: skill }, function (response) {
      if (chrome.runtime.lastError || !response || !response.ok) {
        results.push({ skill: skill, error: response ? response.error : 'nav failed' })
        next()
        return
      }

      chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT', options: {} }, function (extractResponse) {
        var data = extractResponse && extractResponse.ok ? extractResponse.data : null
        results.push(data || { skill: skill, error: 'extract failed' })
        goBack()
      })
    })

    function goBack() {
      var isFluency = skill.indexOf('fluency/') === 0
      var nextSkill = i < skills.length ? skills[i] : null
      var nextIsFluency = nextSkill && nextSkill.indexOf('fluency/') === 0

      if (isFluency && nextIsFluency) {
        next()
        return
      }

      function done() { next() }

      if (isFluency) {
        chrome.tabs.sendMessage(tab.id, { type: 'NAVIGATE_BACK' }, function () {
          chrome.tabs.sendMessage(tab.id, { type: 'NAVIGATE_BACK' }, done)
        })
      } else {
        chrome.tabs.sendMessage(tab.id, { type: 'NAVIGATE_BACK' }, done)
      }
    }
  }

  next()
}

function finishExtract(results, tab) {
  var report = renderReport(results)
  document.getElementById('output').textContent = report
  document.getElementById('output').style.display = 'block'
  document.getElementById('outputActions').classList.remove('hidden')
  document.getElementById('extractBtn').disabled = false
  document.getElementById('extractBtn').textContent = 'Extract Data'
  hideStatus()
  chrome.storage.local.set({ lastReport: report })
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function tag(name, attrs, content) {
  var a = ''
  if (attrs) {
    for (var k in attrs) {
      if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== '') {
        a += ' ' + k + '="' + esc(String(attrs[k])) + '"'
      }
    }
  }
  if (content === undefined || content === null || content === '') {
    return '<' + name + a + ' />'
  }
  return '<' + name + a + '>' + content + '</' + name + '>'
}

function renderReport(results) {
  var overall = results[0]
  var lines = []

  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<fluency-coach-report>')

  if (overall && overall.metadata) {
    var meta = overall.metadata
    var recAttrs = { title: meta.title, date: meta.date }
    if (meta.duration && meta.duration !== '00:00:00') recAttrs.duration = meta.duration
    if (meta.speakingTime && meta.speakingTime !== '00:00:00') recAttrs['speaking-time'] = meta.speakingTime
    lines.push('')
    lines.push('  ' + tag('recording', recAttrs, ''))

    if (overall.skills && overall.skills.length) {
      lines.push('    <skill-scores>')
      overall.skills.forEach(function (s) {
        lines.push('      ' + tag('skill', { name: s.name, score: s.score !== null ? s.score + '%' : s.raw }))
      })
      lines.push('    </skill-scores>')
    }

    if (overall.comparison && overall.comparison.length) {
      lines.push('    <test-predictors>')
      overall.comparison.forEach(function (c) {
        if (c.score) {
          var label = c.label && c.label !== 'Level Not Provided' ? c.label : undefined
          lines.push('      ' + tag('test', { name: c.name, score: c.score, max: c.max, label: label }))
        }
      })
      lines.push('    </test-predictors>')
    }

    var skillDetails = results.slice(1).filter(function (r) { return r && r.skill })
    if (skillDetails.length) {
      lines.push('    <skill-details>')
      skillDetails.forEach(function (d) {
        if (d.noResult) {
          lines.push('      <skill name="' + esc(d.skill) + '" no-result="' + esc(d.noResult) + '" />')
          return
        }

        lines.push('      <skill' + attrs(d) + '>')

        if (d.description) {
          lines.push('        <description>' + esc(d.description) + '</description>')
        }

        if (d.pitchOverview && d.pitchOverview.description) {
          lines.push('        <pitch-variation>' + esc(d.pitchOverview.description) + '</pitch-variation>')
        }

        if (d.subSkills && d.subSkills.length) {
          lines.push('        <sub-skills>')
          d.subSkills.forEach(function (s) {
            lines.push('          ' + tag('item', { name: s.name, level: s.level }))
          })
          lines.push('        </sub-skills>')
        }

        if (d.topErrors && d.topErrors.length) {
          lines.push('        <top-errors>')
          d.topErrors.forEach(function (e) {
            lines.push('          ' + tag('error', { sound: e.sound, mistakes: e.mistakes || undefined }))
          })
          lines.push('        </top-errors>')
        }

        if (d.tutorials && d.tutorials.length) {
          lines.push('        <tutorials>')
          d.tutorials.forEach(function (t) {
            lines.push('          ' + tag('tutorial', { title: t.title, url: t.url || undefined }))
          })
          lines.push('        </tutorials>')
        }

        if (d.fluencySubScores && d.fluencySubScores.length) {
          lines.push('        <fluency-breakdown>')
          d.fluencySubScores.forEach(function (s) {
            lines.push('          ' + tag('metric', { name: s.name, value: s.value, label: s.label }))
          })
          lines.push('        </fluency-breakdown>')
        }

        if (d.gauge && d.gauge.value) {
          lines.push('        ' + tag('gauge', { value: d.gauge.value, label: d.gauge.label || undefined }))
        }

        lines.push('      </skill>')
      })
      lines.push('    </skill-details>')
    }

    if (overall.transcript) {
      lines.push('    <transcript>')
      lines.push('      <![CDATA[')
      lines.push(overall.transcript)
      lines.push('      ]]>')
      lines.push('    </transcript>')
    }

    lines.push('  </recording>')
  }

  lines.push('  <agent-instructions>')
  lines.push('    <purpose>')
  lines.push('      You are an English-speaking coach analyzing an ELSA Speech Analyzer report.')
  lines.push('      Your goal: help the user improve their spoken English, with strong emphasis on fluency.')
  lines.push('      Respond in Vietnamese when giving explanations and guidance.')
  lines.push('    </purpose>')
  lines.push('    <approach>')
  lines.push('      - Prioritize Fluency (pace, pausing, hesitations) above other skills — it most affects natural speech.')
  lines.push('      - Use transcript to find specific phrases the user struggled with (pauses, filler words, slow passages).')
  lines.push('      - Provide concrete, actionable exercises — not generic advice.')
  lines.push('      - Reference tutorials when available.')
  lines.push('      - Track progress by comparing scores across sessions.')
  lines.push('    </approach>')
  lines.push('    <focus-areas>')
  lines.push('      <area name="Fluency" priority="high">')
  lines.push('        Analyze pace (wpm), pause frequency/duration, and hesitations.')
  lines.push('        Suggest: chunking practice, timed repetition, shadowing, filler-word reduction drills.')
  lines.push('      </area>')
  lines.push('      <area name="Pronunciation" priority="high">')
  lines.push('        Target specific problem sounds from top errors. Recommend: minimal pairs, tongue-position drills, mirror practice.')
  lines.push('      </area>')
  lines.push('      <area name="Intonation" priority="medium">')
  lines.push('        Address pitch range and sentence stress. Recommend: thought-group drills, shadowing with intonation marking.')
  lines.push('      </area>')
  lines.push('      <area name="Grammar" priority="medium">')
  lines.push('        Identify recurring grammar patterns from the transcript. Suggest targeted exercises.')
  lines.push('      </area>')
  lines.push('      <area name="Vocabulary" priority="medium">')
  lines.push('        Highlight academic/advanced word alternatives for commonly used simple words.')
  lines.push('      </area>')
  lines.push('    </focus-areas>')
  lines.push('  </agent-instructions>')
  lines.push('</fluency-coach-report>')
  return lines.join('\n')

  function attrs(d) {
    var a = ' name="' + esc(d.skill) + '"'
    if (d.overall) {
      if (d.overall.score) a += ' score="' + esc(d.overall.score) + '"'
      if (d.overall.level) a += ' level="' + esc(d.overall.level) + '"'
    }
    return a
  }
}

function handleCopy() {
  var text = document.getElementById('output').textContent
  navigator.clipboard.writeText(text).then(function () {
    showStatus('Copied to clipboard!')
    setTimeout(hideStatus, 2000)
  })
}

function restoreLastReport() {
  chrome.storage.local.get('lastReport', function (items) {
    if (!items.lastReport) return
    if (items.lastReport.indexOf('<fluency-coach-report>') === -1) return
    document.getElementById('output').textContent = items.lastReport
    document.getElementById('output').style.display = 'block'
    document.getElementById('outputActions').classList.remove('hidden')
    showStatus('Previous report restored. Click Extract to generate a new one.')
  })
}
