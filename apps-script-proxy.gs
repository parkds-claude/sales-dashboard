/**
 * Sales Dashboard - Apps Script Proxy (구글 시트 바인딩 + Google ID Token 인증)
 *
 * 설정 방법:
 * 1. 해당 구글 시트 열기
 * 2. 확장 프로그램 > Apps Script 클릭
 * 3. 이 코드를 붙여넣기 (Code.gs)
 * 4. 배포 > 배포 관리 > 연필 아이콘 > 새 버전 > 배포
 */

// ── 설정 ──
var GOOGLE_CLIENT_ID = '967431235654-j1gti0uls5bsf6tjfa9hhavq2658dflo.apps.googleusercontent.com';
var ALLOWED_DOMAIN = 'sangx2.com';
var ALLOWED_GIDS = ['135095325', '901376231'];

// ── Rate Limiting 설정 ──
var RATE_LIMIT_WINDOW_MS = 300000; // 5분
var RATE_LIMIT_MAX_FAIL = 20;      // 5분당 최대 인증 실패 허용
var RATE_LIMIT_MAX_REQ = 120;      // 5분당 최대 전체 요청 허용 (다중 사용자 대비)

function checkRateLimit(type) {
  var props = PropertiesService.getScriptProperties();
  var key = 'rl_' + type;
  var now = Date.now();
  var max = (type === 'fail') ? RATE_LIMIT_MAX_FAIL : RATE_LIMIT_MAX_REQ;

  var raw = props.getProperty(key);
  var data = raw ? JSON.parse(raw) : { start: now, count: 0 };

  if (now - data.start > RATE_LIMIT_WINDOW_MS) {
    data = { start: now, count: 0 };
  }

  if (data.count >= max) {
    return true;
  }

  data.count++;
  props.setProperty(key, JSON.stringify(data));
  return false;
}

/**
 * Google ID 토큰 검증 (tokeninfo 엔드포인트)
 * 반환: { ok: true, email: '...' } 또는 { ok: false, reason: '...' }
 */
function verifyIdToken(token) {
  if (!token) return { ok: false, reason: 'unauthorized' };

  // 짧은 캐시 (5분) — 같은 토큰 반복 검증 비용 절감
  var cache = CacheService.getScriptCache();
  var cacheKey = 'tok_' + Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)
    .map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('').slice(0, 32);

  var cached = cache.get(cacheKey);
  if (cached) {
    var c = JSON.parse(cached);
    if (c.exp && c.exp * 1000 > Date.now()) {
      return { ok: true, email: c.email };
    }
  }

  try {
    var url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token);
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = res.getResponseCode();
    if (code !== 200) {
      return { ok: false, reason: 'token_expired' };
    }
    var info = JSON.parse(res.getContentText());

    if (info.aud !== GOOGLE_CLIENT_ID) {
      Logger.log('aud mismatch: got=' + info.aud);
      return { ok: false, reason: 'unauthorized' };
    }

    if (!info.exp || parseInt(info.exp) * 1000 < Date.now()) {
      return { ok: false, reason: 'token_expired' };
    }

    if (info.email_verified !== 'true' && info.email_verified !== true) {
      return { ok: false, reason: 'unauthorized' };
    }

    var email = String(info.email || '').toLowerCase();

    if (!email.endsWith('@' + ALLOWED_DOMAIN)) {
      Logger.log('forbidden_domain: ' + email);
      return { ok: false, reason: 'forbidden_domain' };
    }

    var ttl = Math.min(300, Math.max(10, parseInt(info.exp) - Math.floor(Date.now() / 1000)));
    cache.put(cacheKey, JSON.stringify({ email: email, exp: parseInt(info.exp) }), ttl);

    return { ok: true, email: email };
  } catch (e) {
    Logger.log('verifyIdToken exception: ' + (e && e.message ? e.message : e));
    return { ok: false, reason: 'unauthorized' };
  }
}

// 권한 트리거용 — 처음 실행 시 UrlFetchApp 권한 요청을 띄우기 위해 추가
function requestPermissions() {
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=test',
    { muteHttpExceptions: true });
  Logger.log('permission test http=' + res.getResponseCode());
  return 'OK — UrlFetchApp 권한 정상';
}

function processRequest(token, gid) {
  if (checkRateLimit('req')) {
    return ContentService.createTextOutput('rate_limited').setMimeType(ContentService.MimeType.TEXT);
  }

  var auth = verifyIdToken(token);
  if (!auth.ok) {
    checkRateLimit('fail');
    return ContentService.createTextOutput(auth.reason).setMimeType(ContentService.MimeType.TEXT);
  }

  if (ALLOWED_GIDS.indexOf(gid) === -1) {
    return ContentService.createTextOutput('invalid_gid').setMimeType(ContentService.MimeType.TEXT);
  }

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
    var token = e.parameter.token || '';
    var gid = e.parameter.gid || '';
    return processRequest(token, gid);
  } catch (err) {
    return ContentService.createTextOutput('error').setMimeType(ContentService.MimeType.TEXT);
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    return processRequest(data.token || '', data.gid || '');
  } catch (err) {
    return ContentService.createTextOutput('error').setMimeType(ContentService.MimeType.TEXT);
  }
}
