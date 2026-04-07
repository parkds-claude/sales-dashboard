# Sales Dashboard 보안 점검 보고서

**점검일:** 2026-03-26
**대상:** parkds-claude.github.io/sales-dashboard
**점검자:** Claude Opus 4.6 (시니어 보안 코딩 전문가)
**대상 파일:** index.html, apps-script-proxy.gs

---

## 1. 요약

| 등급 | 건수 |
|------|------|
| CRITICAL (즉시 조치) | 2건 |
| HIGH (조치 권장) | 3건 |
| MEDIUM (개선 권장) | 3건 |
| LOW / 참고 | 2건 |

---

## 2. CRITICAL (즉시 조치 필요)

### C-1. GET 쿼리스트링으로 비밀번호 전송

- **위치:** index.html L427, L515, L519
- **현상:** `fetch(API_BASE + '?pw=' + encodeURIComponent(pw) + '&gid=...')` 형태로 비밀번호가 URL에 노출됨
- **위험:**
  - 브라우저 히스토리에 비밀번호 기록
  - 서버(Google) 액세스 로그에 평문 비밀번호 기록
  - Referrer 헤더를 통해 외부 유출 가능 (no-referrer 설정으로 부분 완화됨)
  - 네트워크 모니터링 도구에서 URL 노출
- **권장 조치:** POST 방식으로 전환. Apps Script의 POST 리다이렉트 body 손실 문제는 doPost에서 URL parameter로 변환하는 방식으로 우회 가능:
  ```javascript
  // 클라이언트: POST body로 전송
  fetch(API_BASE, {method:'POST', body: JSON.stringify({pw, gid})})

  // Apps Script: doPost에서 처리
  function doPost(e) {
    var data = JSON.parse(e.postData.contents);
    return processRequest(data.pw, data.gid);
  }
  ```
  단, Apps Script POST 리다이렉트 제한으로 인해 현재 GET 사용 중. 대안으로 비밀번호 대신 **1회용 토큰(세션 토큰)** 방식 검토 필요.

### C-2. sessionStorage에 평문 비밀번호 저장

- **위치:** index.html L433, L457
- **현상:** `sessionStorage.setItem('dashboard_pw', pw)` — 비밀번호 원문 저장
- **위험:**
  - 동일 탭의 JavaScript에서 `sessionStorage.getItem('dashboard_pw')`로 접근 가능
  - XSS 취약점 발생 시 비밀번호 즉시 탈취
  - 브라우저 개발자도구에서 누구나 확인 가능
- **권장 조치:** 비밀번호 대신 서버 발급 세션 토큰 저장, 또는 최소한 해시값만 저장

---

## 3. HIGH (조치 권장)

### H-1. 구글 스프레드시트 원본 URL 노출

- **위치:** index.html L340
- **현상:** `https://docs.google.com/spreadsheets/d/1KyoxPb7pfPPxfn-msNWwBTxlINDzYZIPuX_kRG8cBYY/edit` 링크가 HTML에 하드코딩
- **위험:**
  - 스프레드시트 ID가 공개 소스코드(GitHub)에 노출
  - 시트 공유 설정에 따라 직접 접근 가능
  - Apps Script 프록시 보안을 우회하는 경로
- **권장 조치:**
  - 스프레드시트 공유 설정을 "링크가 있는 사용자 → 뷰어"에서 "특정 사용자만"으로 변경
  - 원본파일 링크를 로그인 후에만 동적 생성하거나, Apps Script 프록시를 통해 제공

### H-2. CSP에 'unsafe-inline' 허용

- **위치:** index.html L7
- **현상:** `script-src 'unsafe-inline'`, `style-src 'unsafe-inline'` 설정
- **위험:**
  - CSP의 XSS 방어 효과 대부분 무력화
  - 인라인 스크립트 주입 공격에 취약
- **현실적 판단:** 단일 HTML 파일 구조상 인라인 스크립트/스타일 제거가 어려움
- **권장 조치:** 장기적으로 외부 JS/CSS 파일 분리 후 nonce 또는 hash 기반 CSP 적용

### H-3. 클라이언트 측 brute-force 방어만 존재

- **위치:** index.html L410-411, L443-448
- **현상:** `loginAttempts`, `lockoutUntil` 변수가 클라이언트에서만 관리됨
- **위험:**
  - 페이지 새로고침으로 잠금 초기화 가능
  - curl/스크립트로 직접 API 호출 시 제한 없음
  - Apps Script 측에 rate limiting 없음
- **권장 조치:** apps-script-proxy.gs에 PropertiesService 기반 서버 측 rate limiting 추가 (IP 기반은 불가하므로 전역 요청 횟수 제한)

---

## 4. MEDIUM (개선 권장)

### M-1. Apps Script 프록시 URL 공개 노출

- **위치:** index.html L407
- **현상:** Apps Script 엔드포인트 URL이 GitHub Pages 소스코드에 노출
- **위험:** 누구나 이 URL에 직접 요청 가능 (비밀번호 brute-force 시도 가능)
- **완화 요소:** 비밀번호 검증이 서버(Apps Script) 측에서 수행됨
- **권장 조치:** 서버 측 rate limiting 추가로 brute-force 방어

### M-2. 에러 메시지에 내부 정보 노출

- **위치:** index.html L528, apps-script-proxy.gs L71
- **현상:** `alert('데이터 로딩 실패: ' + e.message)`, `'error: ' + err.message`
- **위험:** 스택 트레이스, 내부 함수명 등이 사용자에게 노출될 수 있음
- **권장 조치:** 프로덕션에서는 일반적인 에러 메시지만 표시, 상세 내용은 console.error로 제한

### M-3. CSRF 보호 없음

- **현상:** GET 요청으로 데이터 조회 — CSRF 토큰 없음
- **위험:** 악성 사이트에서 `<img src="API_BASE?pw=...">` 등으로 요청 유도 가능
- **완화 요소:** 읽기 전용 작업이며 비밀번호 필요. `no-referrer` 설정으로 referrer 유출 방지
- **현실적 판단:** 현재 구조에서 실질적 위험도는 낮음

---

## 5. LOW / 참고

### L-1. SRI 해시 불일치 (해결 완료)

- **위치:** index.html L9
- **현상:** Chart.js integrity 해시가 실제 파일과 불일치하여 라이브러리 로드 실패
- **조치 완료:** 올바른 해시로 수정됨 (`sha384-9nhczxUqK...`)

### L-2. 단일 공유 비밀번호

- **현상:** 모든 사용자가 동일한 비밀번호(`sangsang2026`) 사용
- **위험:** 비밀번호 유출 시 전체 접근 노출, 개별 사용자 추적 불가
- **현실적 판단:** 내부 소규모 팀 대시보드로 현재 수준 적절
- **향후 고려:** 사용자별 인증 필요 시 Google OAuth 연동 검토

---

## 6. 양호 항목

| 항목 | 상태 | 비고 |
|------|------|------|
| XSS 방어 (esc 함수) | 양호 | `&`, `<`, `>`, `"`, `'` 모두 이스케이프 처리 |
| SRI (Subresource Integrity) | 양호 | Chart.js에 integrity 해시 적용 |
| Referrer 정책 | 양호 | `no-referrer` 설정으로 URL 유출 방지 |
| frame-ancestors | 양호 | `'self'`로 클릭재킹 방어 |
| GID 화이트리스트 | 양호 | 허용된 시트 ID만 접근 가능 |
| HTTPS | 양호 | GitHub Pages 기본 HTTPS 적용 |
| 서버 측 비밀번호 검증 | 양호 | SHA-256 해시 비교가 Apps Script에서 수행 |

---

## 7. 우선순위별 조치 로드맵

### 즉시 (이번 세션)
1. **에러 메시지 일반화** — 디버깅 완료 후 상세 에러 제거
2. **서버 측 rate limiting 추가** — apps-script-proxy.gs에 구현

### 단기 (1주 내)
3. **GET→POST 전환 재시도** — Apps Script doPost 리다이렉트 문제 해결 방안 조사
4. **sessionStorage 비밀번호 저장 방식 개선** — 해시값 또는 세션 토큰으로 변경

### 중기 (필요 시)
5. **CSP unsafe-inline 제거** — JS/CSS 외부 파일 분리
6. **Google OAuth 연동** — 개별 사용자 인증/감사 로그 필요 시

---

## 8. 총평

현재 대시보드는 **내부 소규모 팀 용도**로서 기본적인 보안 체계(서버 측 비밀번호 검증, XSS 방어, CSP, SRI, HTTPS)를 갖추고 있습니다.

주요 우려 사항은 **GET 쿼리스트링 비밀번호 전송**과 **sessionStorage 평문 저장**이며, 이는 Apps Script 플랫폼 제약에서 비롯된 부분입니다. 데이터가 영업 현황 수준의 내부 자료이고, 접근자가 제한적인 점을 고려하면 현재 리스크는 **수용 가능한 수준**이나, 서버 측 rate limiting 추가는 즉시 적용을 권장합니다.
