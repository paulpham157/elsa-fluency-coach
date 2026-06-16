# Fluency Coach

Chrome extension trích xuất dữ liệu phân tích giọng nói từ [ELSA Speech Analyzer](https://speechanalyzer.elsaspeak.com) và xuất ra báo cáo XML có cấu trúc để dán vào Claude AI (hoặc bất kỳ AI assistant nào).

## Cài đặt

1. Mở `chrome://extensions`
2. Bật **Developer mode** (góc trên bên phải)
3. Click **Load unpacked**
4. Chọn thư mục chứa extension này

Không cần build — đây là extension Manifest V3 thuần, không bundler, không package.json.

> ⚠️ **Quan trọng:** Sau khi cài, **không được xoá thư mục extension**. Nếu xoá, extension sẽ bị vô hiệu hoá. Giải nén ra thư mục cố định, không giải nén tạm rồi xoá.

## Cách dùng

1. Truy cập [ELSA Speech Analyzer](https://speechanalyzer.elsaspeak.com) và mở một recording bất kỳ
2. Click icon **Fluency Coach** trên thanh toolbar Chrome
3. Click nút **Extract Data**
4. Extension sẽ tự động:
   - Trích xuất thông tin tổng quan (điểm số, transcript, test predictors)
   - Điều hướng qua từng skill detail page (Pronunciation, Intonation, Fluency, Grammar, Vocabulary)
   - Fluency được phân tích chi tiết theo 3 sub-page: Pace, Pausing, Hesitations
   - Gom tất cả vào báo cáo XML
5. Click **Copy to Clipboard** — prompt phân tích và cải thiện đã được đính kèm sẵn trong báo cáo
6. Dán vào AI bất kỳ (Claude, ChatGPT, Gemini...)

### Ghi chú

- Extension chỉ hoạt động trên `speechanalyzer.elsaspeak.com/*`
- Báo cáo cũ được tự động khôi phục khi mở lại popup (lưu trong `chrome.storage.local`)
- Extension tự động điều hướng SPA — không cần thao tác tay

## Cấu trúc project

```
elsa-extension/
├── manifest.json          # Cấu hình extension (Manifest V3)
├── popup.html             # Giao diện popup
├── popup.js               # Logic popup (gửi message, render báo cáo)
├── content.js             # Content script (nhận message, điều hướng SPA, trích xuất DOM)
├── lib/
│   └── extract.js         # Pure functions trích xuất dữ liệu từ DOM
├── icons/                 # Icon 16/32/48/128px
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── tests/                 # QUnit tests cho extraction functions
│   ├── index.html
│   ├── test-extract.js
│   └── test-render.js
├── AGENTS.md              # Hướng dẫn cho AI agent khi làm việc với codebase
├── PRD.md                 # Product Requirements Document
└── README.md              # File này
```

## Output format

Báo cáo xuất ra định dạng XML với cấu trúc:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<fluency-coach-report>
  <agent-instructions>
    <!-- Hướng dẫn AI phân tích báo cáo -->
  </agent-instructions>
  <recording title="..." date="..." duration="..." speaking-time="...">
    <skill-scores>
      <skill name="Pronunciation" score="34%" />
      <skill name="Fluency" score="47%" />
      ...
    </skill-scores>
    <test-predictors>
      <test name="IELTS" score="3.5" max="9" label="Limited" />
      ...
    </test-predictors>
    <skill-details>
      <skill name="pronunciation" score="34%" level="Beginner">
        <sub-skills>...</sub-skills>
        <top-errors>...</top-errors>
        <tutorials>...</tutorials>
      </skill>
      ...
    </skill-details>
    <transcript>
      <![CDATA[...]]>
    </transcript>
  </recording>
</fluency-coach-report>
```

## Chạy tests

Mở `tests/index.html` trong trình duyệt (không cần server). Tests dùng QUnit.

## Kiến trúc

- **Popup** (`popup.js`): Gửi message qua `chrome.tabs.sendMessage`, render báo cáo, quản lý state
- **Content script** (`content.js`): Nhận message từ popup, tương tác với DOM của SPA, điều hướng Vue Router
- **Extract layer** (`lib/extract.js`): Pure functions, không side-effect, dễ test

Permissions: `activeTab`, `tabs`, `storage` — không cần host permissions nhờ `activeTab`.

## Navigation

SPA dùng Vue Router history mode. Extension tương tác bằng cách:
1. Click tab (`.wrapper-tabs__tab-item`)
2. Click link-to-text (`.link-to-text`) để vào skill detail
3. Click accordion sub-item cho fluency sub-pages
4. Click nút back (`.recording-overall__back`) để quay lại tổng quan

Xem `AGENTS.md` để biết chi tiết về navigation architecture và các edge cases.
