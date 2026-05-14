# Product Blueprint — AI Council

> 이 문서는 AI Council이 **이미 완성된 제품**임을 전제로, 제품의 방향·사용자·범위를
> 사후 정리한 기록입니다. 앞으로의 기능 추가는 이 방향을 기준으로 판단합니다.

---

## App name

AI Council (`ai-council`) — 현재 버전 v1.0.8

## Target users

- 여러 LLM의 답변을 한 곳에서 교차 검증하고 싶은 개인 사용자
- AI 답변의 정확도·관점 다양성이 중요한 리서치/기획/글쓰기 작업자
- 데스크톱 앱을 켜둔 채 스마트폰(Telegram)으로도 AI에 질문하고 싶은 사용자

## User personas

- **리서처/기획자** — 하나의 질문을 여러 AI에 던지고 합의점과 이견을 빠르게 보고 싶다
- **빌더/개발자** — 코드·설계 답변을 여러 모델로 교차 검증하고 최종안을 뽑아내고 싶다
- **이동 중 사용자** — PC 앞에 없을 때 Telegram으로 같은 워크플로를 쓰고 싶다

## Pain points

- AI마다 답이 달라서 어느 것을 믿어야 할지 판단이 어렵다
- 같은 질문을 7개 사이트에 일일이 복사·붙여넣기 하기 번거롭다
- API 비용 없이 기존 로그인 세션(웹 구독)을 그대로 활용하고 싶다
- 답변 비교·병합·기록 과정이 흩어져 있어 정리가 안 된다

## Value proposition

7개 주요 LLM(Gemini, Claude, ChatGPT, DeepSeek, Perplexity, Grok, Kimi)을
**웹 세션 기반(API 키 불필요)** 으로 한 화면에 띄우고, 구조화된 3단계 교차검증
워크플로와 자유 토론(Council Chat)을 한 앱에서 제공한다. 추가로 Telegram 연동으로
모바일에서도 동일 워크플로를 제어할 수 있다.

## 완성된 기능 (현재 v1.0.8 = 사실상 완료된 MVP + v1)

- 7개 AI를 Electron BrowserView로 임베드, 세션 영속화
- Workflow 모드: Primary draft → Reviewer 피드백 → 최종 수정 (수동 3단계)
- AI별 차별화된 Reviewer 역할
- Council Chat 모드: `@AI` / `@all` 자유 토론, 버블 UI
- Saved Sessions(스냅샷): 즐겨찾기·라벨·노트·아카이브·export/import·복제
- AI Moderator: 합의 요약 / 다음 발언자 / 후속 프롬프트 제안
- Candidate Pinning & Compare, Merged Draft
- Workflow ↔ Council Chat 핸드오프
- 파일 첨부(PDF/DOCX/XLSX/TXT/MD/CSV/이미지), CDP 업로드
- AI Recommendation Engine (API 키 기반 + 키워드 fallback)
- 응답 언어 자동 감지
- Telegram 연동: 메시지·@mention·파일 전송·슬래시 커맨드, 암호화 토큰 저장
- Windows/macOS 빌드 및 배포 패키징

## Later / 확장 후보 (지금 구현하지 않음)

- 자동(무인) 워크플로 진행 — 현재는 의도적으로 수동
- 새로운 AI provider 추가 (8번째 패널)
- 클라우드 동기화 / 다중 기기 세션 공유
- 답변 품질 자동 채점·랭킹
- 모바일 네이티브 앱

## Risks

- **Tech risk** — AI 사이트의 DOM 구조 변경 시 selector 깨짐
  (완화책: `electron/selectors.json` 외부 설정으로 재빌드 없이 수정 가능)
- **Tech risk** — 비공식 UI 자동화 방식이라 사이트 정책·레이아웃 변화에 취약
- **UX risk** — 7개 패널 동시 구동 시 리소스 부담 / 로그인 만료 혼란
- **Business risk** — 각 AI 서비스의 약관상 자동화 제약 가능성 (개인 사용 전제)

## Out of scope

- API 키 없이도 동작하는 것이 핵심 가치이므로 API 전용 모드로의 전환은 하지 않음
- 실제 사용자 데이터·민감정보를 demo/기본값에 넣지 않음
