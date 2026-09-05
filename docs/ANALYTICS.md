# ANALYTICS — MinJob 이용 측정 (GA4)

> **이 파일은 "무엇을 어떻게 세는가"** — 콘솔 상태 · 이벤트 계약 · 세지 않는 것 · 읽는 법 · 이 숫자로 내릴 결정. 코드 규칙은 [`CLAUDE.md`](../CLAUDE.md)(클라이언트 전용·운영자 제외), 화면은 [`SPEC.md`](./SPEC.md), 작업은 [`ROADMAP.md`](./ROADMAP.md).
>
> **왜 재나**: 유료 노출의 값·자리를 다시 볼 근거가 0이었다(SNAPSHOT 2026-09-02 — "측정 인프라 0이라 성과형은 후보가 아님"). 코드 정본은 `src/lib/analytics.ts`의 `AnalyticsEvent` — 이 문서의 표와 어긋나면 코드가 맞고 문서를 고친다.

## 1. 콘솔 상태 (2026-09-06 설정 · 운영자)

| 항목 | 값 |
|---|---|
| 속성 · 측정 ID | 민잡 (GA4) · **`G-R2MZEZK912`** — 공개 값이다(HTML에 그대로 들어간다) |
| 웹 스트림 | `minjob.co.kr` · 스트림 ID `15724926217` · `https://www.minjob.co.kr` |
| 향상된 측정 | 7개 전부 ON — 페이지 조회 · 스크롤 · 이탈 클릭 · 사이트 검색 · 양식 상호작용 · 동영상 · 파일 다운로드 |
| 데이터 보관 | 이벤트·사용자 **14개월**(최대) |
| 맞춤 측정기준 | 이벤트 범위 **8개** — 아래 표. 매개변수 이름과 1:1 |
| 환경 변수 | `NEXT_PUBLIC_GA_ID` — Vercel **Production에만**. 로컬·프리뷰는 비워 두어 스크립트가 붙지 않는다(README) |

⬜ **남은 콘솔 작업 하나**: `source_click`을 **주요 이벤트**로 표시 — 배포 뒤 첫 클릭이 들어와 이벤트 목록(관리 > 데이터 표시 > 이벤트)에 나타나면 이름 옆 ★. `purchase`는 GA가 자동으로 주요 이벤트로 둔다. Vercel Production 환경 변수는 넣었다(2026-09-06). **내부 트래픽(운영자 IP) 제외는 하지 않는다**(운영자 결정 2026-09-06) — 운영자 방문에 대한 방어는 코드의 `/admin` 제외만이다.

| 표시 이름 | 매개변수 | 쓰는 이벤트 · 값 |
|---|---|---|
| 공고 ID | `job_id` | job_view · source_click · bookmark_add · purchase |
| 공고 종류 | `job_kind` | job_view · source_click — `MINISTRY` / `GENERAL` / `MINISTRY+GENERAL` |
| 지역 | `region` | job_view · source_click — `REGIONS` 키. 미상이면 보내지 않는다 |
| 직분 | `position` | job_view · source_click — `POSITIONS` 키를 `+`로 이음. 일반직은 없음 |
| 링크 종류 | `label` | source_click — `source`(원문) / `homepage`(교회 홈페이지) · pricing_preview_open — `basic` / `plus` / `special` |
| 채널 | `channel` | church_link_click — `CHURCH_CHANNELS` 키 |
| 등록 경로 | `via` | job_post — `form`(새 등록) / `claim`(가져오기) |
| 노출 등급 | `tier` | purchase — `EXPOSURE_PRODUCTS` 키 |

⚠️ 측정기준은 **등록한 시점부터** 잡힌다(과거분 채움 없음). 매개변수 이름을 바꾸면 콘솔도 함께 — GA는 모르는 매개변수를 조용히 버린다. 값은 전부 **영어 키**다(도메인 enum 규칙과 같다) — 보고서에서 한글 라벨을 보려면 탐색에서 직접 이름 붙인다.

## 2. 이벤트 계약 (9개)

| 이벤트 | 뜻 | 매개변수 | 보내는 곳 |
|---|---|---|---|
| `job_view` | 공고 상세를 열었다 | job_id · job_kind · region · position | `(public)/jobs/[id]/page.tsx` — `<TrackEvent>` |
| **`source_click`** ★ | 원문 공고·교회 홈페이지로 **나갔다 = 지원하러 갔다** | 위 넷 + label | `jobs/[id]/job-detail-view.tsx` SummaryAside — `<TrackedLink>` |
| `bookmark_add` | 공고를 저장했다 — **서버가 확정한 뒤**, 해제는 안 셈 | job_id | `components/job/bookmark-provider.tsx` `toggle` (저장 버튼 3곳 공통) |
| `share` | 링크를 복사했다 (GA4 권장 이벤트 이름) | method=`copy` · content_type=`job` · item_id | `components/job/job-actions.tsx` |
| `church_link_click` | 교회 채널(홈페이지·유튜브…)로 나갔다 | channel | `components/church/church-channels.tsx` (공고 상세 · 교회 상세) |
| `pricing_preview_open` | 요금 페이지에서 노출 미리보기를 열었다 | label | `components/pricing/exposure-preview.tsx` |
| `verify_submit` | 교회 인증 신청이 **접수됐다**(서버 성공) | — | `mypage/verify/verify-form.tsx` |
| `job_post` | 교회가 공고를 올렸다 — 수정은 아님 | via | `jobs/job-form.tsx`(form) · `jobs/new/claim-panel.tsx`(claim) |
| `purchase` | 노출 결제가 적용됐다 (GA4 표준 전자상거래) | transaction_id=결제번호 · value=**정가** · currency=KRW · items · tier · job_id | `mypage/church/promote/promote-outcome.tsx` — `<TrackEvent>` (PC·모바일 복귀 합류점) |

★ = 사이트의 핵심 지표. 연락처 클릭을 세지 않으므로(§3) "지원으로 이어졌나"는 이 이벤트가 대답한다.
그 밖의 `page_view` · `scroll` · `click`(이탈) · `form_submit` · `view_search_results`(`/jobs?q=`)는 향상된 측정이 자동으로 보낸다 — `job_view`는 `page_view`와 겹치지만 **공고 축(지역·직분)으로 나누기 위해** 따로 둔다.

### 코드 규칙
- **전부 클라이언트에서 보낸다.** 공개 페이지는 `'use cache'`로 모든 방문자가 같은 HTML을 받아 서버가 "누가 봤다"를 셀 수 없고, 서버 이벤트는 봇·크롤러도 센다. 심는 자리는 셋 — `<TrackEvent>`(그려질 때) · `<TrackedLink>`(클릭) · 성공 콜백 안의 `track()`. 로더는 루트 레이아웃의 `<GoogleAnalytics>` 하나 — **초기화 세 줄(dataLayer·gtag·config)은 HTML에 박힌 동기 `<script>`**, 라이브러리(gtag.js)만 `next/script` `afterInteractive`. 초기화까지 afterInteractive로 두면 정적 트리의 `<TrackEvent>` effect가 먼저 돌아 이벤트가 조용히 유실된다(2026-09-06 실측 전에 잡음).
- **운영자 화면(`/admin/**`)은 세지 않는다** — 첫 로드에서 `config`를 건너뛰고, `track()`도 `ADMIN_PREFIX`를 본다. 검수 미리보기가 공개 상세와 같은 컴포넌트를 그려서, 막지 않으면 운영자의 원문 확인 클릭이 ★에 섞인다.
- **등록 폼의 미리보기(`JobPreview`)는 세지 않는다** — `preview`가 `<TrackedLink event={null}>` · `trackClicks={false}`로 내려간다. `job_view`는 page.tsx에 있어 미리보기가 원래 거치지 않는다.
- **성공 뒤에 센다** — 낙관 갱신·제출 시도가 아니라 서버가 확정한 뒤. 그래서 등록·수정·인증 신청 액션은 `redirect` 대신 결과를 돌려준다(2026-09-06 · CLAUDE Styling "성공을 redirect로 알릴 수 없다").
- **매개변수 값에 개인정보를 넣지 않는다** — 공고 id·enum 키·금액만. 사용자 id(User-ID)도 넘기지 않는다(방침 §3 "회원 정보와 연결하지 않는다"의 근거).
- 이벤트를 더할 때: ① `AnalyticsEvent`에 멤버 ② 새 매개변수면 콘솔 맞춤 측정기준 등록 ③ 이 표 ④ 방침 §3의 수집 항목에 새 종류가 생기면 개정.

## 3. 세지 않는 것 — 그리고 왜
- **연락처 클릭(이메일·전화)** — 지원 동선의 나머지 절반이지만, 연락처는 교회 담당자의 개인정보(가드레일 #3)라 "누가 어느 연락처를 눌렀나"를 어디에도 남기지 않는다. `source_click`이 갈음한다.
- **검색어·필터 조합** — `/jobs` 필터는 100% 클라이언트 상태라 서버가 모르고, GA에는 `?q=`만 `view_search_results`로 자동 온다. 축별 수요는 랜딩 28개의 `page_view`와 `job_view × region/position`이 답한다.
- **서버 카운터(DB 조회수 칸)** — 캐시된 페이지라 셀 수 없고, 셀 수 있어도 봇을 거를 수 없다.
- **세션 녹화(Clarity 등)** — 화면에 연락처가 그려지므로 녹화 자체가 개인정보 수집이 된다.
- **광고 기능(Google 신호·광고 개인 최적화)** — 켜지 않는다. 방침 §3 "광고 목적으로 이용하지 않는다".

## 4. 읽는 법
- **지금 들어오나** — 실시간 보고서(최근 30분). 이벤트 하나씩 확인은 **DebugView**(관리 > DebugView) — 우리 코드는 `debug_mode`를 넣지 않으므로 Chrome 확장 **Google Analytics Debugger**를 켠 탭만 거기 잡힌다.
- **표준 보고서는 24–48시간 늦다.** 맞춤 측정기준으로 나눈 표(예: `source_click × region`)는 **탐색 > 자유 형식**에서 만든다 — 표준 보고서엔 안 나온다.
- **수치는 실제의 70–90%** — 광고 차단·쿠키 차단·iOS 추적 제한이 10–30%를 지운다. 절대값이 아니라 **추세·비율**로 읽는다.
- 이벤트별 건수: 보고서 > 참여도 > 이벤트. 유입 경로: 획득 > 트래픽 획득(검색 유입 = Organic Search — SEO 랜딩이 일하는지 여기서 본다).

## 5. 이 숫자로 내릴 결정 (기준은 가설 — 운영자가 정한다)
| 질문 | 볼 지표 | 첫 기준(가설) |
|---|---|---|
| 유료 노출을 팔 트래픽인가 | 월 공개 `page_view` · `job_view` | 4주 데이터로 SNAPSHOT 2026-09-02의 값 결정을 다시 본다 |
| 공고가 지원으로 이어지나 | `source_click ÷ job_view` | 상세 10건 중 1건이 원문으로 가면 "지원 매체"라 말할 수 있다 |
| 어느 지역·직분이 수요인가 | `job_view × region` · `× position` | 상단 조합에 랜딩·광고 자리를 맞춘다 |
| 요금 페이지가 결제까지 가나 | `pricing_preview_open` → `purchase` | 미리보기가 쌓이는데 결제 0이면 값·문구 문제 |
| 교회가 들어오나 | `verify_submit` · `job_post`(via) | 클레임 비중이 높으면 "이미 올라온 우리 교회 공고" 동선이 맞다는 뜻 |
| 검색 유입이 성장 엔진인가 | 획득 > Organic Search 비중 · 랜딩 28개 `page_view` | 비중이 절반을 넘기면 SEO에 더 쓴다(CLAUDE "SEO는 성장 엔진") |
