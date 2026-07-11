# Project Scope — AI Council

> AI Council은 이미 완성·동작 중인 앱입니다. 이 문서는 "현재 잘 되는 기능"을
> 명시적으로 못 박아, 앞으로의 작업이 이 기능들을 깨지 않도록 보호하는 안전장치입니다.

---

## Current Status

v1.0.8 출시 상태. 아래 "Must Preserve" 목록의 모든 기능이 정상 동작 중.
신규 작업은 기존 동작을 보존하는 전제 하에서만 진행한다.

## Must Preserve — 절대 깨지면 안 되는 동작

### 핵심 화면 / 진입점
- 7개 AI BrowserView 패널 임베드 및 세션 영속화
- TitleBar(🔑 Accounts / 📋 History / 📊 Logs), Toolbar(모드 토글·Primary 선택·쿼리 입력),
  StatusBar(진행 표시 + Telegram 인디케이터), PanelGrid, FinalResultPanel
- AccountsPanel: Accounts 탭(로그인/로그아웃) + API Keys 탭(키 저장·우선순위 정렬)

### 핵심 기능
- **Workflow 모드** 수동 3단계: ▶ Start → ▶▶ Next → ✓ Continue
- Pause 지점에서 Primary AI 재지정
- AI별 Reviewer 역할 주입
- **Council Chat 모드**: `@AI` / `@all` 메시지 라우팅, 버블 UI, 미리보기/펼치기
- Saved Sessions 전체 라이프사이클 (저장·자동저장·즐겨찾기·라벨·노트·아카이브·
  export/import·복제·bulk delete)
- AI Moderator (합의/다음발언자/후속프롬프트)
- Candidate Pinning & Compare, Merged Draft
- Workflow ↔ Council Chat 핸드오프
- 파일 첨부 + CDP 업로드 (Workflow / Council Chat / Telegram 3개 진입점)
- AI Recommendation Engine (API + 키워드 fallback)
- 응답 언어 자동 감지
- Telegram 연동 전체 (메시지·@mention·파일·슬래시커맨드·암호화 토큰 저장)
- Windows portable/installer, macOS dmg 빌드 파이프라인

## Not Included in MVP — 나중 Phase (명시 요청 없이는 구현 안 함)

- 자동(무인) 워크플로 진행
- 8번째 이후 AI provider 추가
- 클라우드 동기화 / 다중 기기 세션 공유
- 답변 자동 채점·랭킹
- 모바일 네이티브 앱

## Core Users

- AI 답변 교차 검증이 필요한 개인 리서처·기획자·빌더
- 모바일(Telegram)에서 워크플로를 제어하려는 사용자

## Core Workflows

1. 로그인 → Active AI 선택 → Workflow 3단계 교차검증 → Final Result 확인
2. Council Chat에서 자유 토론 → Candidate Pin/Merge → Workflow로 핸드오프
3. Telegram에서 메시지/파일 전송 → 데스크톱 세션이 처리 → 답변 회신

## Data / Security Rules

- API 키·Telegram 토큰은 `electron-store`에 저장하며 로그·git에 노출 금지
- Telegram은 설정된 Chat ID 외 메시지는 silently reject
- demo/기본값에 실제 사용자 데이터·민감정보를 넣지 않음
- 세션 쿠키는 Electron `persist:` 파티션에만 저장

## Build / Test Commands

```bash
npm run build          # Vite 빌드 (필수 — 마무리 전 반드시 통과)
npx electron .         # 프로덕션 모드 실행 확인
npm start              # dev 모드 (hot reload)
build-and-run.bat      # 메인 레포 루트에서 빌드+실행 (권장)
```

> 별도 test/lint 스크립트는 없음. 최소한 `npm run build` 통과 + 수동 동작 확인 필수.

## Future Expansion

- 자동 워크플로 모드 (옵션 토글로)
- provider 추가를 위한 selector/패널 일반화
