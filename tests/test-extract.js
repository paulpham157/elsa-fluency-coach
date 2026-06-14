QUnit.module('extractFromDom — Overall page', function () {
  QUnit.test('extract skill scores from tab list', function (assert) {
    var doc = createDomFromHtml(
      '<div class="wrapper-tabs">' +
        '<ul class="wrapper-tabs__tab-list">' +
          '<li class="wrapper-tabs__tab-item wrapper-tabs__tab-item--active">' +
            '<div class="text-tab text-tab--active">' +
              '<div class="text-tab__wrap-info">' +
                '<div class="text-tab__info">' +
                  '<div class="text-tab__skill">Pronunciation</div>' +
                '</div>' +
                '<div class="text-tab__percent score-red">82</div>' +
              '</div>' +
            '</div>' +
          '</li>' +
          '<li class="wrapper-tabs__tab-item">' +
            '<div class="text-tab">' +
              '<div class="text-tab__wrap-info">' +
                '<div class="text-tab__info">' +
                  '<div class="text-tab__skill">Intonation</div>' +
                '</div>' +
                '<div class="text-tab__percent score-red">78</div>' +
              '</div>' +
            '</div>' +
          '</li>' +
          '<li class="wrapper-tabs__tab-item">' +
            '<div class="text-tab">' +
              '<div class="text-tab__wrap-info">' +
                '<div class="text-tab__info">' +
                  '<div class="text-tab__skill">Fluency</div>' +
                '</div>' +
                '<div class="text-tab__percent score-red">90</div>' +
              '</div>' +
            '</div>' +
          '</li>' +
          '<li class="wrapper-tabs__tab-item">' +
            '<div class="text-tab">' +
              '<div class="text-tab__wrap-info">' +
                '<div class="text-tab__info">' +
                  '<div class="text-tab__skill">Grammar</div>' +
                '</div>' +
                '<div class="text-tab__percent score-red">75</div>' +
              '</div>' +
            '</div>' +
          '</li>' +
          '<li class="wrapper-tabs__tab-item">' +
            '<div class="text-tab">' +
              '<div class="text-tab__wrap-info">' +
                '<div class="text-tab__info">' +
                  '<div class="text-tab__skill">Vocabulary</div>' +
                '</div>' +
                '<div class="text-tab__percent score-red">80</div>' +
              '</div>' +
            '</div>' +
          '</li>' +
        '</ul>' +
      '</div>'
    )

    var result = extractFromDom(doc, { includeTranscript: false, includeComparison: false })
    assert.equal(result.skills.length, 5, '5 skills extracted')
    assert.equal(result.skills[0].name, 'Pronunciation')
    assert.equal(result.skills[0].score, 82)
    assert.equal(result.skills[1].name, 'Intonation')
    assert.equal(result.skills[1].score, 78)
    assert.equal(result.skills[2].name, 'Fluency')
    assert.equal(result.skills[2].score, 90)
    assert.equal(result.skills[3].name, 'Grammar')
    assert.equal(result.skills[3].score, 75)
    assert.equal(result.skills[4].name, 'Vocabulary')
    assert.equal(result.skills[4].score, 80)
  })

  QUnit.test('handles N/A scores for short recordings', function (assert) {
    var doc = createDomFromHtml(
      '<div class="wrapper-tabs">' +
        '<ul class="wrapper-tabs__tab-list">' +
          '<li class="wrapper-tabs__tab-item">' +
            '<div class="text-tab">' +
              '<div class="text-tab__wrap-info">' +
                '<div class="text-tab__info">' +
                  '<div class="text-tab__skill">Pronunciation</div>' +
                '</div>' +
                '<div class="text-tab__percent score-red">N/A</div>' +
              '</div>' +
            '</div>' +
          '</li>' +
        '</ul>' +
      '</div>'
    )

    var result = extractFromDom(doc, { includeTranscript: false, includeComparison: false })
    assert.equal(result.skills.length, 1)
    assert.strictEqual(result.skills[0].score, null, 'null when N/A')
    assert.equal(result.skills[0].raw, 'N/A')
  })

  QUnit.test('extract recording metadata', function (assert) {
    var doc = createDomFromHtml(
      '<div class="recording-title">' +
        '<div class="recording-title__heading">' +
          '<input class="recording-title__input" type="text" value="New Recording 06-10-2026-10-45">' +
        '</div>' +
        '<div class="recording-title__body">' +
          '<div class="recording-title__body-wrapper">' +
            '<span class="recording-title__body-text">Wed, Jun 10th, 2026 - 10:46 pm</span>' +
          '</div>' +
          '<div class="recording-title__body-wrapper">' +
            '<span class="recording-title__body-text">Duration: 00:01:23</span>' +
          '</div>' +
          '<div class="recording-title__body-wrapper">' +
            '<span class="recording-title__body-text">Speaking Time: 00:00:45</span>' +
          '</div>' +
        '</div>' +
      '</div>'
    )

    var result = extractFromDom(doc, { includeTranscript: false, includeComparison: false })
    assert.equal(result.metadata.title, 'New Recording 06-10-2026-10-45')
    assert.equal(result.metadata.date, 'Wed, Jun 10th, 2026 - 10:46 pm')
    assert.equal(result.metadata.duration, '00:01:23')
    assert.equal(result.metadata.speakingTime, '00:00:45')
  })

  QUnit.test('extract comparison scores', function (assert) {
    var doc = createDomFromHtml(
      '<div class="overall-comparison">' +
        '<div class="comparison-item">' +
          '<div class="comparison-item__header"><img class="comparison-item__icon" alt="IELTS"></div>' +
          '<div class="comparison-item__wrapper">' +
            '<span class="comparison-item__score" style="color: rgb(199, 0, 43);">6.5</span>' +
            '<span class="comparison-item__max-score">/9</span>' +
            '<span class="comparison-item__label">B2</span>' +
          '</div>' +
        '</div>' +
        '<div class="comparison-item">' +
          '<div class="comparison-item__header"><img class="comparison-item__icon" alt="TOEFL"></div>' +
          '<div class="comparison-item__wrapper">' +
            '<span class="comparison-item__score" style="color: rgb(14, 104, 109);">22</span>' +
            '<span class="comparison-item__max-score">/30</span>' +
          '</div>' +
        '</div>' +
      '</div>'
    )

    var result = extractFromDom(doc, { includeTranscript: false, includeComparison: true })
    assert.equal(result.comparison.length, 2)
    assert.equal(result.comparison[0].name, 'IELTS')
    assert.equal(result.comparison[0].score, '6.5')
    assert.equal(result.comparison[0].max, '9')
    assert.equal(result.comparison[1].name, 'TOEFL')
    assert.equal(result.comparison[1].score, '22')
  })

  QUnit.test('transcript extraction', function (assert) {
    var doc = createDomFromHtml(
      '<div class="transcript__list">' +
        'Hello, this is a test transcript. I am practicing my English speaking skills.' +
      '</div>'
    )

    var result = extractFromDom(doc, { includeTranscript: true, includeComparison: false })
    assert.equal(result.transcript, 'Hello, this is a test transcript. I am practicing my English speaking skills.')
  })

  QUnit.test('transcript omitted when option is false', function (assert) {
    var doc = createDomFromHtml(
      '<div class="transcript__list">Some text</div>'
    )

    var result = extractFromDom(doc, { includeTranscript: false, includeComparison: false })
    assert.strictEqual(result.transcript, null, 'transcript is null when not requested')
  })

  QUnit.test('comparison omitted when option is false', function (assert) {
    var doc = createDomFromHtml(
      '<div class="comparison-item">' +
        '<div class="comparison-item__header"><img class="comparison-item__icon" alt="IELTS"></div>' +
        '<div class="comparison-item__wrapper"><span class="comparison-item__score">6.5</span></div>' +
      '</div>'
    )

    var result = extractFromDom(doc, { includeTranscript: false, includeComparison: false })
    assert.strictEqual(result.comparison, null, 'comparison is null when not requested')
  })
})

QUnit.module('extractFromDom — empty/missing DOM', function () {
  QUnit.test('no skill tabs returns empty array', function (assert) {
    var doc = document.implementation.createHTMLDocument('test')
    var result = extractFromDom(doc, { includeTranscript: false, includeComparison: false })
    assert.deepEqual(result.skills, [])
  })

  QUnit.test('no metadata returns empty strings', function (assert) {
    var doc = document.implementation.createHTMLDocument('test')
    var result = extractFromDom(doc, { includeTranscript: false, includeComparison: false })
    assert.equal(result.metadata.title, '')
    assert.equal(result.metadata.date, '')
    assert.equal(result.metadata.duration, '')
    assert.equal(result.metadata.speakingTime, '')
  })
})

function createDomFromHtml(html) {
  var doc = document.implementation.createHTMLDocument('test')
  var div = doc.createElement('div')
  div.innerHTML = html
  doc.body.appendChild(div)
  return doc
}
