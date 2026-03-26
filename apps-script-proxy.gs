/**
 * Sales Dashboard - Apps Script Proxy (구글 시트 바인딩 버전)
 *
 * 설정 방법:
 * 1. 해당 구글 시트 열기
 * 2. 확장 프로그램 > Apps Script 클릭
 * 3. 이 코드를 붙여넣기 (Code.gs)
 * 4. 배포 > 새 배포 > 웹 앱 선택
 *    - 실행 주체: 본인
 *    - 액세스 권한: 모든 사용자
 * 5. 배포 후 받은 URL을 index.html의 API_BASE에 설정
 */

// ── 설정 ──
var PASSWORD_HASH = '543442f2d39bbc8a46e9c1b3dee668f587c20bae7770aac57bc75fd98c739d65';
var ALLOWED_GIDS = ['135095325', '901376231'];

function doGet(e) {
  try {
    var pw = e.parameter.pw || '';
    var gid = e.parameter.gid || '';

    // 비밀번호 검증 (SHA-256)
    var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw)
      .map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); })
      .join('');

    if (hash !== PASSWORD_HASH) {
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

  } catch (err) {
    return ContentService.createTextOutput('error: ' + err.message).setMimeType(ContentService.MimeType.TEXT);
  }
}

function doPost(e) {
  // POST도 doGet과 동일하게 처리 (브라우저 호환)
  return doGet({parameter: JSON.parse(e.postData.contents)});
}
