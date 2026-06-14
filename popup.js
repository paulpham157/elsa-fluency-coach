var state = {
  tabId: null,
  url: '',
  settings: {
    includeTranscript: true,
    includeComparison: true,
    includeSkillDetails: true,
    skillDetailTabs: ['pronunciation', 'intonation', 'fluency/pace', 'fluency/pausing', 'fluency/hesitations', 'grammar', 'vocabulary'],
  },
}

document.addEventListener('DOMContentLoaded', function () {
  loadSettings()
  setupEventListeners()
  checkCurrentTab()
  restoreLastReport()
})

function loadSettings() {
  chrome.storage.local.get(
    { includeTranscript: true, includeComparison: true, includeSkillDetails: true, skillDetailTabs: ['pronunciation', 'intonation', 'fluency/pace', 'fluency/pausing', 'fluency/hesitations', 'grammar', 'vocabulary'] },
    function (items) {
      state.settings = items
      document.getElementById('includeTranscript').checked = items.includeTranscript
      document.getElementById('includeComparison').checked = items.includeComparison
      document.getElementById('includeSkillDetails').checked = items.includeSkillDetails
      toggleSkillOptions(items.includeSkillDetails)
    }
  )
}

function saveSettings() {
  var settings = {
    includeTranscript: document.getElementById('includeTranscript').checked,
    includeComparison: document.getElementById('includeComparison').checked,
    includeSkillDetails: document.getElementById('includeSkillDetails').checked,
    skillDetailTabs: getCheckedSkills(),
  }
  chrome.storage.local.set(settings)
  state.settings = settings
}

function getCheckedSkills() {
  var checks = document.querySelectorAll('#skillDetailOptions input[type="checkbox"]:checked')
  return Array.from(checks).map(function (c) { return c.value })
}

function toggleSkillOptions(show) {
  document.getElementById('skillDetailOptions').classList.toggle('hidden', !show)
}

function setupEventListeners() {
  document.getElementById('includeTranscript').addEventListener('change', saveSettings)
  document.getElementById('includeComparison').addEventListener('change', saveSettings)
  document.getElementById('includeSkillDetails').addEventListener('change', function () {
    toggleSkillOptions(this.checked)
    saveSettings()
  })
  document.querySelectorAll('#skillDetailOptions input').forEach(function (cb) {
    cb.addEventListener('change', saveSettings)
  })
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
  saveSettings()
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
    includeTranscript: state.settings.includeTranscript,
    includeComparison: state.settings.includeComparison,
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

    var skillTabs = state.settings.skillDetailTabs
    if (state.settings.includeSkillDetails && skillTabs.length > 0) {
      extractSkillDetails(skillTabs, tab, allResults)
    } else {
      finishExtract(allResults, tab)
    }
  })
}

function extractSkillDetails(skills, tab, results) {
  var baseUrl = tab.url.replace(/\/+$/, '')
  var i = 0

  function next() {
    if (i >= skills.length) {
      finishExtract(results, tab)
      return
    }
    var skill = skills[i++]
    chrome.tabs.create({ url: baseUrl + '/' + skill, active: true }, function (newTab) {
      chrome.tabs.update(tab.id, { active: true })
      waitForContentScript(newTab.id, skill, function (data) {
        results.push(data)
        chrome.tabs.remove(newTab.id)
        next()
      })
    })
  }

  next()
}

function waitForContentScript(tabId, skill, callback) {
  var attempts = 0
  var partialData = null

  function poll() {
    if (attempts > 40) {
      console.log('FC: timeout for', skill, 'partialData keys:', partialData ? Object.keys(partialData) : 'null')
      callback(partialData || { skill: skill, error: 'timeout' })
      return
    }
    attempts++
    chrome.tabs.sendMessage(tabId, { type: 'EXTRACT', options: {} }, function (response) {
      if (chrome.runtime.lastError) {
        if (attempts % 10 === 0) console.log('FC: lastError for', skill, 'attempt', attempts)
        setTimeout(poll, 500)
        return
      }
      var data = response && response.ok ? response.data : null
      if (!data) {
        console.log('FC: no data for', skill)
        callback({ skill: skill, error: 'no response' })
        return
      }
      if (!partialData) {
        partialData = data
        console.log('FC: partialData for', skill, 'keys:', Object.keys(data), 'hasScore:', !!data.overall || 'fluency' in data)
      }
      console.log('FC: success for', skill, 'attempt', attempts, 'subSkills:', data.subSkills && data.subSkills.length, 'topErrors:', data.topErrors && data.topErrors.length, 'tutorials:', data.tutorials && data.tutorials.length, 'fluencySubScores:', data.fluencySubScores && data.fluencySubScores.length)
      callback(data)
    })
  }

  setTimeout(poll, 3000)
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
