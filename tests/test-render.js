QUnit.module('renderReport', function () {
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
            lines.push('  - ' + t.title)
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

  QUnit.test('full report with all data', function (assert) {
    var results = [{
      metadata: { title: 'My Recording', date: 'Jun 10, 2026', duration: '00:01:23', speakingTime: '00:00:45' },
      skills: [
        { name: 'Pronunciation', score: 82, raw: '82' },
        { name: 'Intonation', score: 78, raw: '78' },
        { name: 'Fluency', score: 90, raw: '90' },
        { name: 'Grammar', score: 75, raw: '75' },
        { name: 'Vocabulary', score: 80, raw: '80' },
      ],
      comparison: [
        { name: 'IELTS', score: '6.5', max: '9', label: 'B2' },
        { name: 'TOEFL', score: '22', max: '30', label: '' },
      ],
      transcript: 'Hello, this is my speech.',
    }]

    var report = renderReport(results)
    assert.ok(report.includes('# Fluency Coach Report'))
    assert.ok(report.includes('**Recording**: My Recording'))
    assert.ok(report.includes('**Duration**: 00:01:23'))
    assert.ok(report.includes('## Skill Scores'))
    assert.ok(report.includes('Pronunciation**: 82%'))
    assert.ok(report.includes('Fluency**: 90%'))
    assert.ok(report.includes('## Test Score Predictors'))
    assert.ok(report.includes('IELTS**: 6.5/9 (B2)'))
    assert.ok(report.includes('TOEFL**: 22/30'))
    assert.ok(report.includes('## Transcript'))
    assert.ok(report.includes('Hello, this is my speech.'))
  })

  QUnit.test('minimal report with N/A scores', function (assert) {
    var results = [{
      metadata: { title: '', date: '', duration: '', speakingTime: '' },
      skills: [{ name: 'Pronunciation', score: null, raw: 'N/A' }],
      comparison: [],
      transcript: '',
    }]

    var report = renderReport(results)
    assert.ok(report.includes('Pronunciation**: N/A'))
    assert.notOk(report.includes('## Test Score Predictors'))
    assert.notOk(report.includes('## Transcript'))
  })

  QUnit.test('skill detail with subSkills, topErrors, tutorials', function (assert) {
    var results = [
      { metadata: { title: 'Test', date: '', duration: '', speakingTime: '' }, skills: [], comparison: [], transcript: '' },
      {
        skill: 'pronunciation',
        overall: { score: '75%', level: 'Intermediate' },
        noResult: null,
        subSkills: [
          { name: 'TH Sounds: /θ/, /ð/', level: 'Needs Improvement' },
        ],
        topErrors: [
          { sound: '/t/', mistakes: 'thought, three' },
        ],
        tutorials: [
          { title: 'Tutorial for TH Sounds', url: 'https://www.youtube.com/watch?v=abc123' },
        ],
      },
    ]

    var report = renderReport(results)
    assert.ok(report.includes('## Skill Details'))
    assert.ok(report.includes('### Pronunciation'))
    assert.ok(report.includes('Score: 75%'))
    assert.ok(report.includes('Level: Intermediate'))
    assert.ok(report.includes('**Sub-skills**'))
    assert.ok(report.includes('/θ/, /ð/'))
    assert.ok(report.includes('**Top Errors**'))
    assert.ok(report.includes('/t/'))
    assert.ok(report.includes('**Tutorials**'))
    assert.ok(report.includes('[Tutorial for TH Sounds](https://www.youtube.com/watch?v=abc123)'))
  })

  QUnit.test('fluency sub-page with subScores and gauge', function (assert) {
    var results = [
      { metadata: { title: 'Test', date: '', duration: '', speakingTime: '' }, skills: [], comparison: [], transcript: '' },
      {
        skill: 'pace',
        fluencySubScores: [
          { name: 'Pace', value: '69 wpm', label: 'Natural' },
          { name: 'Pausing', value: '56%', label: 'Acceptable' },
          { name: 'Hesitations', value: '12', label: 'Few' },
        ],
        gauge: { value: '69 wpm', label: 'Natural' },
      },
      {
        skill: 'pausing',
        fluencySubScores: [
          { name: 'Pace', value: '69 wpm', label: 'Natural' },
          { name: 'Pausing', value: '56%', label: 'Acceptable' },
          { name: 'Hesitations', value: '12', label: 'Few' },
        ],
        gauge: { value: '56%', label: 'Acceptable' },
      },
    ]

    var report = renderReport(results)
    assert.ok(report.includes('### Pace'))
    assert.ok(report.includes('### Pausing'))
    assert.ok(report.includes('**Fluency Breakdown**'))
    assert.ok(report.includes('Pace: 69 wpm (Natural)'))
    assert.ok(report.includes('Pausing: 56% (Acceptable)'))
    assert.ok(report.includes('**Current**: 69 wpm (Natural)'))
    assert.ok(report.includes('**Current**: 56% (Acceptable)'))
  })

  QUnit.test('skill detail with description and pitchOverview', function (assert) {
    var results = [
      { metadata: { title: 'Test', date: '', duration: '', speakingTime: '' }, skills: [], comparison: [], transcript: '' },
      {
        skill: 'intonation',
        overall: { score: '24%', level: 'Beginner' },
        noResult: null,
        description: 'Your intonation level is Beginner. Keep working at it! Make your voice louder and higher for important words!',
        pitchOverview: { description: 'Keep your Pitch Variation within the target range shown in green below.' },
        subSkills: [],
        topErrors: [],
        tutorials: [],
      },
    ]

    var report = renderReport(results)
    assert.ok(report.includes('### Intonation'))
    assert.ok(report.includes('Your intonation level is Beginner'))
    assert.ok(report.includes('**Pitch Variation**'))
    assert.ok(report.includes('target range shown in green'))
  })

  QUnit.test('noResult shown for short recording', function (assert) {
    var results = [
      { metadata: { title: 'Test', date: '', duration: '', speakingTime: '' }, skills: [], comparison: [], transcript: '' },
      {
        skill: 'pronunciation',
        overall: { score: 'N/A', level: 'Not Available' },
        noResult: 'Sorry! This recording was too short.',
        subSkills: [],
        topErrors: [],
        tutorials: [],
      },
    ]

    var report = renderReport(results)
    assert.ok(report.includes('### Pronunciation'))
    assert.ok(report.includes('Score: N/A'))
    assert.ok(report.includes('Sorry! This recording was too short.'))
    assert.notOk(report.includes('**Sub-skills**'))
  })
})
