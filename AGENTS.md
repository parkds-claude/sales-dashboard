# AGENTS.md

> 이 파일은 에이전트(Claude Code, Codex, Cursor, Aider 등)가 이 리포지터리에서 "다음에 어디를 봐야 하는지" 안내하는 **목차(map)** 입니다.
> 백과사전이 아닙니다. 100줄 이내로 유지하세요.
> 본문 규칙·운영 정책은 `CLAUDE.md` 와 `docs/` 아래에 있습니다.

## 0. 시작 지점

1. 본 프로젝트의 작업 규칙은 → `CLAUDE.md` (이 폴더에는 CLAUDE.md가 없음 — 아래 '프로젝트 컨텍스트' 섹션 참조)
2. 홈 공통 규칙은 → `~/CLAUDE.md`
3. 오늘의 작업 누적은 → `docs/daily/{TODAY}/claude.md`

## 1. 핵심 디렉터리

| 위치 | 용도 |
|---|---|
| `CLAUDE.md` | 본문 운영 규칙·아키텍처·정책 |
| `docs/exec-plans/` | 실행 계획(1급 아티팩트) — `_template.md` 복제 |
| `docs/daily/YYYY-MM-DD/claude.md` | 일자별 작업 기록 |
| `docs/design/README.md` | 공통 디자인 규칙 |
| `docs/glossary/README.md` | 용어 사전 |
| `docs/analysis/` | 코드 구조 분석 문서 |
| `.layer-check.toml` | 레이어 위반 린터 설정 (있으면 단방향 의존 강제) |

## 2. 실행 계획(Execution Plans) 운영

- 단일 PR/단일 변경: 인라인 또는 `docs/daily/`에 짧게
- 다단계·1주 이상 작업: `docs/exec-plans/<slug>.md` 생성 (템플릿: `_template.md`)
- 완료된 계획은 `docs/exec-plans/_archive/`로 이동
- 자세한 포맷·운영은 `docs/exec-plans/README.md`

## 3. 레이어 규칙

기본 단방향 의존 (좌→우):

```
Types → Config → Repo → Service → Runtime → UI
```

- 역방향 import 금지. 위반 시 CI 실패.
- 프로젝트별 매핑은 `.layer-check.toml`
- 검사: `python3 ~/dev-standards/lint/layer_check.py` (Python 3.11+ 필요 — 미충족 시 안내 후 정상 종료)

## 4. 에이전트 작업 절차

1. `CLAUDE.md` 의 "개발 규칙" 섹션을 먼저 읽는다.
2. 오늘 자 `docs/daily/{TODAY}/claude.md` 확인 (없으면 생성).
3. 비단순 변경이면 `docs/exec-plans/<slug>.md`를 먼저 작성한다.
4. 코드 변경 후 `python3 ~/dev-standards/lint/layer_check.py` 통과 확인. (`.layer-check.toml` 없는 프로젝트는 스킵)
5. 작업 결과를 `docs/daily/{TODAY}/claude.md`에 추가.

## 5. 자주 묻는 위치

- 비밀키·환경변수 → `.env`, `secrets/` (커밋 금지)
- 공통 모듈 → `~/bot-shared/` (맥미니 전용 — 맥북엔 없음)
- 봇 등록·실행 → `~/bot-dashboard/` (맥미니 전용, Bot Dashboard :5055)
- 일괄 표준 갱신 → `~/dev-standards/` (양 기기 존재, 2026-07-04 맥북 동기화)

> 이 파일을 더 길게 만들지 마세요. 내용이 늘면 `docs/`로 옮기고 여기는 링크만 남기세요.

## 프로젝트 컨텍스트 (인라인 — 이 폴더에 CLAUDE.md 없음)

- 무엇: "2026 영업과표 대시보드" — Google Sheets 데이터를 Chart.js로 보여주는 단일 index.html + Google Apps Script 백엔드(Code.gs: HTML 서빙·CSV 프록시·비밀번호 검증, apps-script-proxy.gs)
- 실행: 로컬 서버 없음 — 정적 index.html + Apps Script 웹앱(doGet/doPost). Code.gs/apps-script-proxy.gs 수정은 이 폴더 저장만으로 반영 안 됨(Apps Script 측 갱신·재배포 필요)
- 테스트: 미확인
- 포트/배포: 로컬 포트 없음. GitHub Pages `parkds-claude.github.io/sales-dashboard` + Apps Script 호스팅 (SECURITY_AUDIT_20260326.md 기준)
- 주의: Code.gs에 비밀번호 SHA-256 해시(PW_HASH)·SHEET_ID 하드코딩 — 평문 비밀번호는 어디에도 기록 금지. 서버측 rate limit(5회 실패 시 차단) 로직 유지할 것. 보안 관련 변경 전 SECURITY_AUDIT_20260326.md 확인
