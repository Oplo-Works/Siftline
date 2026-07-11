# Agent Workflow — AI Council

> AI coding agent(Claude Code 등)가 이 프로젝트에서 지켜야 할 작업 규칙입니다.
> 핵심 원칙: **먼저 생각하고, 작게 만들고, 반드시 테스트하고, 기록한다.**

---

## 기본 전제

AI Council은 이미 완성·동작 중인 앱입니다. 따라서 이 프로젝트의 작업은 대부분
**"새 프로젝트 시작"이 아니라 "기존 동작을 보존한 채로의 기능 추가/수정"** 입니다.

```text
AI가 만든 결과물은 검토, 빌드, 테스트, 기록 전까지 초안이다.
```

## Workflow

큰 기능 / 사용자 flow가 바뀌는 작업:

```text
/blueprint → /spec → /plan → /build → /test → /review → /log
```

간단한 수정 / 버그 픽스:

```text
/spec → /plan → /build → /test → /review → /log
```

각 단계의 상세 정의는 원본 매뉴얼
(`D:\#AI Coding Agent Workflow Manual\AI_Coding_Agent_Workflow_Manual.md`) 참고.

### 단계 요약

| 단계 | 하는 일 |
|---|---|
| `/blueprint` | 새 기능의 제품 방향·사용자·범위 정의. 코드 작성 금지 |
| `/spec` | user / goal / 영향받는 화면·데이터 / 외부서비스 / edge case / 보안 / 완료기준 / out of scope |
| `/plan` | 작은 vertical slice로 분해. slice당 파일 3~5개 이하. rollback 계획 포함 |
| `/build` | slice 하나만 구현. 기존 demo flow 보존. broad rewrite 금지 |
| `/test` | `npx tsc --noEmit` → `npm run build`(Windows) → 수동 동작 체크리스트 확인 |
| `/review` | scope creep / 기존기능 파손 / hardcoding / 보안 점검 |
| `/log` | `docs/DEV_LOG.md` 업데이트 |

## 이 프로젝트 고유 규칙

1. **항상 main 브랜치, 메인 레포 경로에서 작업** —
   `C:\Users\Sales01\Documents\AI-Council-Chat\`. 워크트리 경로에 편집 금지.
   커밋 전 `git status`로 브랜치 확인.
2. **`docs/PROJECT_SCOPE.md`의 "Must Preserve" 목록을 깨지 않는다.**
   변경이 그 목록에 영향을 주면 반드시 사전 확인.
3. **빌드/실행 검증**: `npx tsc --noEmit` → `npm run build` → `build-and-run.bat` 순서.
   sandbox에서는 tsc 통과 후 Windows에서 build 확인. test/lint 스크립트 없음.
4. **파일 편집 주의**: agent가 파일을 편집할 때 **100줄 이상 교체가 필요한 경우**
   Edit 도구 대신 Write 또는 python으로 직접 작성. Edit 도구는 대형 교체 시
   파일 끝이 truncate될 수 있음 (Field Test #1에서 확인).
5. **selector 작업 주의**: AI 사이트 DOM 자동화는 `electron/selectors.json`에 집중되어
   있다. selector를 코드에 하드코딩하지 말 것.
6. **비밀정보 금지**: API 키·Telegram 토큰을 코드/로그/git에 넣지 않는다.
   `electron-store` 사용.
7. **Later Phase 기능은 명시 요청 없이 구현하지 않는다** (PROJECT_SCOPE 참고).

## 공통 규칙 (요약)

- spec 없이 큰 기능 코딩 시작 금지
- 구현 전 반드시 plan
- 작은 vertical slice 선호, slice당 3~5파일 이하
- 동작하는 코드를 명확한 이유 없이 재작성 금지
- 기존 demo/working flow 보존
- demo 코드에 실제 사용자 데이터 금지
- 마무리 전 build 실행
- 의미 있는 변경 후 `docs/DEV_LOG.md` 업데이트
- 미완성 기능은 placeholder/mock/demo/future로 명확히 표시
- 빌드·테스트되지 않은 기능을 "완료"라고 주장하지 않는다
- 결제·보안·개인정보·권한 관련은 추가 review 전 자동화 금지
- loading / empty / error 상태 포함
