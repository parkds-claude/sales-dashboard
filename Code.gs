// ─── 비밀번호 (SHA-256 해시) ───
var PW_HASH = '543442f2d39bbc8a46e9c1b3dee668f587c20bae7770aac57bc75fd98c739d65';
var SHEET_ID = '1KyoxPb7pfPPxfn-msNWwBTxlINDzYZIPuX_kRG8cBYY';

// ─── HTML 서빙 (Apps Script 호스팅용) ───
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('2026 영업과표 대시보드');
}

// ─── CSV 프록시 (GitHub Pages용, POST) ───
function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var pw = (body.pw || '').trim();
  var gid = body.gid || '0';

  // 서버 측 rate limiting
  var cache = CacheService.getScriptCache();
  var cacheKey = 'fail_' + sha256(pw).substring(0, 10);
  var failCount = parseInt(cache.get(cacheKey) || '0');

  if (failCount >= 5) {
    return ContentService.createTextOutput(
      JSON.stringify({error: 'rate_limited'})
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // 비밀번호 검증
  var hash = sha256(pw);
  if (hash !== PW_HASH) {
    cache.put(cacheKey, String(failCount + 1), 300);
    return ContentService.createTextOutput(
      JSON.stringify({error: 'unauthorized'})
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // 성공 시 실패 카운트 초기화
  cache.remove(cacheKey);

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheets = ss.getSheets();
  var sheet = null;

  for (var i = 0; i < sheets.length; i++) {
    if (String(sheets[i].getSheetId()) === gid) {
      sheet = sheets[i];
      break;
    }
  }
  if (!sheet) sheet = sheets[0];

  var data = sheet.getDataRange().getValues();
  var csv = data.map(function(row) {
    return row.map(function(cell) {
      var s = String(cell === null || cell === undefined ? '' : cell);
      if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(',');
  }).join('\n');

  return ContentService.createTextOutput(csv)
    .setMimeType(ContentService.MimeType.TEXT);
}

// ─── getSheetData (Apps Script 호스팅용) ───
function getSheetData() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();

  var headerRow = -1;
  for (var i = 0; i < data.length; i++) {
    for (var j = 0; j < data[i].length; j++) {
      if (String(data[i][j]).indexOf('담당부서') >= 0) {
        headerRow = i;
        break;
      }
    }
    if (headerRow >= 0) break;
  }

  if (headerRow < 0) {
    return JSON.stringify({projects: [], failedProjects: [], error: '헤더를 찾을 수 없음'});
  }

  var headers = data[headerRow];
  var colDept = -1, colName = -1, colBudget = -1, colPM = -1;
  var monthCols = [];

  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c]).trim();
    if (h === '담당부서') colDept = c;
    else if (h === '사업명') colName = c;
    else if (h.indexOf('사업금액') >= 0 || h.indexOf('예산') >= 0) colBudget = c;
    else if (h.indexOf('담당PM') >= 0 || h.indexOf('PM') >= 0) colPM = c;
    else if (h.match(/^\d{1,2}월$/)) {
      monthCols.push({idx: c, label: h});
    }
  }

  monthCols.sort(function(a, b) {
    return parseInt(a.label) - parseInt(b.label);
  });

  var projects = [];
  var failedProjects = [];
  var isFailed = false;

  for (var r = headerRow + 1; r < data.length; r++) {
    var row = data[r];
    var dept = String(row[colDept] || '').trim();
    var name = String(row[colName] || '').trim();

    if (dept === '입찰실패' || name === '입찰실패') {
      isFailed = true;
      continue;
    }

    if (!dept || !name) continue;

    var months = [];
    for (var mi = 0; mi < monthCols.length; mi++) {
      months.push(String(row[monthCols[mi].idx] || '').trim());
    }
    while (months.length < 12) months.push('');

    var budget = colBudget >= 0 ? row[colBudget] : 0;
    var budgetNum = 0;
    if (typeof budget === 'number') {
      budgetNum = budget;
    } else {
      budgetNum = parseInt(String(budget || '').replace(/[^0-9]/g, '')) || 0;
    }

    var pm = colPM >= 0 ? String(row[colPM] || '').trim() : '';

    var project = {
      dept: dept,
      name: name,
      months: months,
      budget: budgetNum,
      pm: pm
    };

    if (isFailed) {
      failedProjects.push(project);
    } else {
      projects.push(project);
    }
  }

  return JSON.stringify({
    projects: projects,
    failedProjects: failedProjects
  });
}

// ─── SHA-256 ───
function sha256(text) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return raw.map(function(b) {
    return ('0' + ((b + 256) % 256).toString(16)).slice(-2);
  }).join('');
}
