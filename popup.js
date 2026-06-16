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
  var lines = []
  lines.push('# Fluency Coach Report')
  lines.push('')

  var overall = results[0]
  if (overall && overall.metadata) {
    var meta = overall.metadata
    lines.push('**Recording**: ' + (meta.title || 'Untitled'))
    if (meta.date) lines.push('**Date**: ' + meta.date)
    if (meta.duration && meta.duration !== '00:00:00') lines.push('**Duration**: ' + meta.duration)
    if (meta.speakingTime && meta.speakingTime !== '00:00:00') lines.push('**Speaking Time**: ' + meta.speakingTime)
    lines.push('')
  }

  if (overall && overall.skills && overall.skills.length) {
    lines.push('## Skill Scores')
    lines.push('')
    overall.skills.forEach(function (s) {
      lines.push('- **' + s.name + '**: ' + (s.score !== null ? s.score + '%' : s.raw))
    })
    lines.push('')
  }

  if (overall && overall.comparison && overall.comparison.length) {
    lines.push('## Test Score Predictors')
    lines.push('')
    overall.comparison.forEach(function (c) {
      if (c.score) {
        lines.push('- **' + c.name + '**: ' + c.score + '/' + c.max + (c.label && c.label !== 'Level Not Provided' ? ' (' + c.label + ')' : ''))
      }
    })
    lines.push('')
  }

  var skillDetails = results.slice(1).filter(function (r) { return r && r.skill })
  if (skillDetails.length) {
    lines.push('## Skill Details')
    lines.push('')
    skillDetails.forEach(function (d) {
      var label = formatSkillLabel(d.skill)
      lines.push('### ' + label)
      if (d.noResult) {
        lines.push('- ' + d.noResult)
      }
      if (d.overall) {
        if (d.overall.score) lines.push('- Score: ' + d.overall.score)
        if (d.overall.level) lines.push('- Level: ' + d.overall.level)
      }
      if (d.description) {
        lines.push('')
        lines.push('  ' + d.description)
      }
      if (d.pitchOverview) {
        if (d.pitchOverview.description) {
          lines.push('')
          lines.push('  **Pitch Variation**: ' + d.pitchOverview.description)
        }
      }
      if (d.subSkills && d.subSkills.length) {
        lines.push('')
        lines.push('  **Sub-skills**')
        d.subSkills.forEach(function (s) {
          lines.push('  - ' + s.name + (s.level ? ' — ' + s.level : ''))
        })
      }
      if (d.topErrors && d.topErrors.length) {
        lines.push('')
        lines.push('  **Top Errors**')
        d.topErrors.forEach(function (e) {
          lines.push('  - ' + e.sound + (e.mistakes ? ': ' + e.mistakes : ''))
        })
      }
      if (d.tutorials && d.tutorials.length) {
        lines.push('')
        lines.push('  **Tutorials**')
        d.tutorials.forEach(function (t) {
          if (t.url) {
            lines.push('  - [' + t.title + '](' + t.url + ')')
          } else {
            lines.push('  - ' + t.title)
          }
        })
      }
      if (d.fluencySubScores && d.fluencySubScores.length) {
        lines.push('')
        lines.push('  **Fluency Breakdown**')
        d.fluencySubScores.forEach(function (s) {
          lines.push('  - ' + s.name + ': ' + s.value + ' (' + s.label + ')')
        })
      }
      if (d.gauge && d.gauge.value) {
        if (!d.fluencySubScores || !d.fluencySubScores.length) lines.push('')
        lines.push('  - **Current**: ' + d.gauge.value + (d.gauge.label ? ' (' + d.gauge.label + ')' : ''))
      }
      lines.push('')
    })
  }

  function formatSkillLabel(skill) {
    var parts = skill.split('/')
    var last = parts[parts.length - 1]
    return last.charAt(0).toUpperCase() + last.slice(1)
  }

  if (overall && overall.transcript) {
    lines.push('## Transcript')
    lines.push('')
    lines.push(overall.transcript)
    lines.push('')
  }

  return lines.join('\n')
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
    if (items.lastReport.indexOf('- Score:') === -1) return
    document.getElementById('output').textContent = items.lastReport
    document.getElementById('output').style.display = 'block'
    document.getElementById('outputActions').classList.remove('hidden')
    showStatus('Previous report restored. Click Extract to generate a new one.')
  })
}
