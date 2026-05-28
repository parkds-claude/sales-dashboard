# AGENTS.md

> 이 파일은 에이전트(Claude Code, Codex, Cursor, Aider 등)가 이 리포지터리에서 "다음에 어디를 봐야 하는지" 안내하는 **목차(map)** 입니다.
> 백과사전이 아닙니다. 100줄 이내로 유지하세요.
> 본문 규칙·운영 정책은 `CLAUDE.md` 와 `docs/` 아래에 있습니다.

## 0. 시작 지점

1. 본 프로젝트의 작업 규칙은 → `CLAUDE.md`
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
- 검사: `python3 ~/dev-standards/lint/layer_check.py`

## 4. 에이전트 작업 절차

1. `CLAUDE.md` 의 "개발 규칙" 섹션을 먼저 읽는다.
2. 오늘 자 `docs/daily/{TODAY}/claude.md` 확인 (없으면 생성).
3. 비단순 변경이면 `docs/exec-plans/<slug>.md`를 먼저 작성한다.
4. 코드 변경 후 `python3 ~/dev-standards/lint/layer_check.py` 통과 확인.
5. 작업 결과를 `docs/daily/{TODAY}/claude.md`에 추가.

## 5. 자주 묻는 위치

- 비밀키·환경변수 → `.env`, `secrets/` (커밋 금지)
- 공통 모듈 → `~/bot-shared/`
- 봇 등록·실행 → `~/bot-dashboard/`
- 일괄 표준 갱신 → `~/dev-standards/`

> 이 파일을 더 길게 만들지 마세요. 내용이 늘면 `docs/`로 옮기고 여기는 링크만 남기세요.
