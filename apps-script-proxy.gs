/**
 * Sales Dashboard - Apps Script Proxy (구글 시트 바인딩 버전)
 *
 * 설정 방법:
 * 1. 해당 구글 시트 열기
 * 2. 확장 프로그램 > Apps Script 클릭
 * 3. 이 코드를 붙여넣기 (Code.gs)
 * 4. 배포 > 배포 관리 > 연필 아이콘 > 새 버전 > 배포
 */

// ── 설정 ──
var PASSWORD_HASH = '543442f2d39bbc8a46e9c1b3dee668f587c20bae7770aac57bc75fd98c739d65';
var ALLOWED_GIDS = ['135095325', '901376231'];

// ── Rate Limiting 설정 ──
var RATE_LIMIT_WINDOW_MS = 300000; // 5분
var RATE_LIMIT_MAX_FAIL = 10;      // 5분당 최대 인증 실패 허용
var RATE_LIMIT_MAX_REQ = 60;       // 5분당 최대 전체 요청 허용

function checkRateLimit(type) {
  var props = PropertiesService.getScriptProperties();
  var key = 'rl_' + type;
  var now = Date.now();
  var max = (type === 'fail') ? RATE_LIMIT_MAX_FAIL : RATE_LIMIT_MAX_REQ;

  var raw = props.getProperty(key);
  var data = raw ? JSON.parse(raw) : { start: now, count: 0 };

  // 윈도우 초과 시 리셋
  if (now - data.start > RATE_LIMIT_WINDOW_MS) {
    data = { start: now, count: 0 };
  }

  if (data.count >= max) {
    return true; // rate limited
  }

  data.count++;
  props.setProperty(key, JSON.stringify(data));
  return false;
}

function processRequest(pw, gid) {
  // 전체 요청 rate limit
  if (checkRateLimit('req')) {
    return ContentService.createTextOutput('rate_limited').setMimeType(ContentService.MimeType.TEXT);
  }

  // 비밀번호 검증 (SHA-256)
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw)
    .map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); })
    .join('');

  if (hash !== PASSWORD_HASH) {
    // 인증 실패 rate limit
    checkRateLimit('fail');
    return ContentService.createTextOutput('unauthorized').setMimeType(ContentService.MimeType.TEXT);
  }

  // GID 검증
  if (ALLOWED_GIDS.indexOf(gid) === -1) {
    return ContentService.createTextOutput('invalid_gid').setMimeType(ContentService.MimeType.TEXT);
  }

  // 바인딩된 스프레드시트에서 시트 찾기
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = null;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (String(sheets[i].getSheetId()) === gid) {
      sheet = sheets[i];
      break;
    }
  }

  if (!sheet) {
    return ContentService.createTextOutput('sheet_not_found').setMimeType(ContentService.MimeType.TEXT);
  }

  // 시트 데이터를 CSV로 변환
  var values = sheet.getDataRange().getValues();
  var csv = values.map(function(row) {
    return row.map(function(cell) {
      if (cell instanceof Date) {
        return Utilities.formatDate(cell, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      var s = String(cell);
      if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(',');
  }).join('\n');

  return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  try {
    var pw = e.parameter.pw || '';
    var gid = e.parameter.gid || '';
    return processRequest(pw, gid);
  } catch (err) {
    return ContentService.createTextOutput('error').setMimeType(ContentService.MimeType.TEXT);
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    return processRequest(data.pw || '', data.gid || '');
  } catch (err) {
    return ContentService.createTextOutput('error').setMimeType(ContentService.MimeType.TEXT);
  }
}
