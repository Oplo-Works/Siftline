# Verification — AI Council

> 마무리 전 반드시 통과시켜야 하는 검증 명령과 수동 체크리스트.
> 모든 명령은 메인 레포 루트 `C:\Users\Minkyu\Documents\AI-Council-Chat\`에서 실행.

---

## 명령 (package.json 기준)

| 명령 | 용도 | 마무리 전 필수? |
|---|---|---|
| `npx tsc --noEmit` | TypeScript 타입 에러 사전 검출 | **YES** (빠름, sandbox에서도 가능) |
| `npm run build` | Vite 프로덕션 빌드 | **YES** (Windows에서 실행) |
| `build-and-run.bat` | 빌드+실행 일괄 (권장) | **YES** (최종 확인) |
| `npm start` | dev 모드 (hot reload) | 필요 시 |
| `npx electron .` | 빌드된 결과로 프로덕션 실행 확인 | 권장 |
| `npm run preview` | Vite preview 서버 | 선택 |
| `npm run package` | Windows portable 패키징 | 릴리스 직전 |
| `npm run package:installer` | Windows NSIS 설치 파일 | 릴리스 직전 |
| `npm run package:mac` | macOS dmg 패키징 | 릴리스 직전 |

> 별도 `test` / `lint` 스크립트는 없음. 검증 순서: `npx tsc --noEmit` → `npm run build` → 수동 체크리스트.
>
> **sandbox/CI 환경에서는** rollup native 모듈 호환 문제로 `npm run build`가 실패할 수 있음.
> 이 경우 `npx tsc --noEmit` 통과를 확인하고, Windows에서 `build-and-run.bat`으로 최종 검증.

## 수동 동작 체크리스트 (변경 후 최소 점검)

1. 앱 실행 (`build-and-run.bat`) → 메인 윈도우, 7개 BrowserView 패널 모두 표시
2. TitleBar의 🔑 Accounts / 📋 History / 📊 Logs 진입 정상
3. Workflow 모드: ▶ Start → ▶▶ Next → ✓ Continue 3단계 정상 진행
4. Council Chat 모드: `@AI` / `@all` 라우팅, 버블 UI 정상
5. Saved Sessions: 저장 → 자동저장 → 즐겨찾기 → export/import 1회씩
6. AI Moderator: 합의 / 다음 발언자 / 후속 프롬프트 1회 호출
7. Candidate Pin/Compare, Merged Draft 1회
8. 파일 첨부: PDF/이미지 1개씩 (Workflow / Council Chat / Telegram 진입점)
9. Telegram 연동: 메시지·@mention·슬래시 커맨드 각 1회
10. `electron/selectors.json` 변경이 있었다면 영향받은 AI 패널 자동화 재확인

## 검증 결과 기록

- 의미 있는 변경 후 결과를 `DEV_LOG.md`의 "Build / Test Log" 표에 추가
- 동시에 Field Test 중이라면 `PROJECT_ENGINEERING_OS_FIELD_TEST_LOG.md`에도 반영

## 빌드 실패 시 우선순위

1. TypeScript 컴파일 에러 (`tsconfig.json`, `tsconfig.node.json`)
2. Vite 빌드 에러 (`vite.config.ts`)
3. Electron main / preload 빌드 에러 (`dist-electron/`)
4. 의존성/lock 파일 불일치 (`package.json` vs `package-lock.json`)

## 보안/데이터 검증

- API 키·Telegram 토큰이 코드/로그/git diff에 노출되지 않았는지 확인
- demo / 기본값에 실제 사용자 데이터가 들어가지 않았는지 확인
- `git diff --check` (whitespace / merge marker 점검) 마무리 전 1회
