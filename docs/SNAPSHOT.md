# SNAPSHOT — MinJob 작업 시점 핸드오프

> **이 문서 하나로 "지금 상황" 파악.** 역할 분리: [`CLAUDE.md`](../CLAUDE.md)(HOW·아키텍처·가드레일), [`SPEC.md`](./SPEC.md)(페이지 명세), [`ROADMAP.md`](./ROADMAP.md)(작업 단위), [`DATA.md`](./DATA.md)(데이터), [`INTERVIEWS.md`](./INTERVIEWS.md)(인터뷰).
>
> **작성 시점**: 2026-07-14 · **HEAD**: 이 스냅샷 커밋 (직전 코드 = `e89bebd` /mypage/church 재설계) · **dev = prod = origin**

---

## 0. 한 문장 요약

흩어진 교회 **사역자 청빙 공고**를 모아 구조화·비교·재공고추적으로 차별화하는 채용 플랫폼. **mock 데이터로 페이지를 하나씩 디자인·확정하는 단계.** 완료(mock): 홈·/jobs·/jobs/[id]·/churches/[id]·/about·/pricing·/login·**/mypage(사역자)·/mypage/verify(교회 인증)·/jobs/new(3스텝 위저드)**. **단일 계정 + mock 세션 로그인 실동작**(test1/test2), 헤더 우측 = "교회 공고 등록" 상시 링크 + 아바타(마이페이지 직행), 로그아웃·회원탈퇴는 /mypage 계정 영역. **`/mypage/church` 대시보드 재설계 + `/mypage/church/info` 구현 완료(mock).** 남은 것: jobs/new 인증 게이트·admin 3종·`/terms`·`/privacy`. 백엔드(Supabase)·모든 mutation·배포는 Phase 1.

---

## 1. 페이지 현황 (핵심)

**범례**: ✅ 완료(검수+커밋) · 🟡 Fable 초안(코드 있음·검수 전) · ⬜ 스캐폴드(미착수)

| 페이지 | 섹션 | 디자인 | 검수 | 커밋 | 데이터 |
|---|:--:|:--:|:--:|---|:--:|
| `/` 홈 | ✅ | ✅ | ✅ | ✅ (이전 세션) | mock |
| `/jobs` 목록 | ✅ | ✅ | ✅ | ✅ `af391ce`·`0119de9`·`03d2758` | mock |
| `/jobs/[id]` 공고 상세 | ✅ | ✅ | ✅ | ✅ `85f53bb` | mock |
| `/churches/[id]` 교회 상세 | ✅ | ✅ | ✅ | ✅ `e586fe0`·`38e6432`·`e1efa16` | mock |
| `/about` 소개 | ✅ | ✅ | ✅ | ✅ `f787c3d` | 정적(+실집계) |
| `/pricing` 노출 안내 | ✅ | ✅ | ✅ | ✅ `e35fcb8`·`59c7aa6`·`a0d4cdd` | 정적(+실집계) |
| `/login` | ✅ | ✅ | ✅ | ✅ `c517faf` | **mock 로그인 동작**(test1/test2) |
| `/mypage` 사역자 view | ✅ | ✅ | ✅ | ✅ `8ded8d3`·`84d6b36` | mock(북마크·최근본 localStorage) + 하단 교회 CTA·계정(로그아웃·회원탈퇴) |
| `/mypage/verify` 교회 인증 폼 | ✅ | ✅ | ✅ | ✅ `8ded8d3` | mock UI(none/PENDING/APPROVED). REJECTED 화면·이메일발송 Phase 1 |
| `/jobs/new` 공고 등록 | ✅ | ✅ | ✅ | ✅ `c2bcb0b` | **3스텝 위저드** mock. ⚠️ **인증 게이트 없음**·저장 Phase 1 |
| `/jobs/[id]/edit` 수정 | ✅ | ✅ | ✅ | ✅ `c2bcb0b` | 위저드 공유(소유권 체크 有)·저장 Phase 1 |
| `/mypage/church` 교회 관리 | ✅ | ✅ | ✅ | ✅ `e89bebd` | mock — 탭·노출광고 사이드바·공고 행(수정/⋯). mutation Phase 1 |
| `/mypage/church/info` 교회 정보 | ✅ | ✅ | ✅ | ✅ `e89bebd` | mock — 소개·연락처·채널6·사진. 실 저장 Phase 1 |
| `/terms`·`/privacy` | 🟡 | ⬜ | ⬜ | (Fable 미변경) | — (법률검토) |
| `/admin`·`/admin/jobs`·`/admin/ingest` | ⬜ | ⬜ | ⬜ | 스캐폴드(Placeholder) | — |

> **완료(mock) 13개** = 홈·/jobs·/jobs/[id]·/churches/[id]·/about·/pricing·/login·/mypage(사역자)·/mypage/verify·/jobs/new·/jobs/[id]/edit·**/mypage/church·/mypage/church/info**. **단일 계정 + mock 세션 로그인 실동작**(계정 §5). **남은 화면 = jobs/new 인증 게이트·admin 3종(Placeholder 스텁)·/terms·/privacy.** 실 mutation·백엔드 = Phase 1.
> **드롭됨**: `/churches`(교회 목록 browse), 교회 규모 필드.

---

## 2. Fable(AI)로 한 것

이 프로젝트는 **Fable 모델로 "전체 개괄"을 먼저 깔고, 그 위에서 페이지별로 상세히 다듬는** 방식을 씀. Fable가 한 3가지:

1. **`docs/fable.md`** — 전 페이지(공개·인증·admin) **섹션+디자인 제안서**. 사람 검토용 초안. (SPEC로 흡수 후 삭제 가능)
2. **공개+인증 페이지에 디자인 코드 적용** — Fable가 홈 디자인 언어(딥그린)로 각 페이지를 코드로 스캐폴드. 이게 지금 `🟡` 초안들.
   - 이후 사람 검수로 재디자인·확정: `/jobs`·`/jobs/[id]`·`/churches/[id]`·`/about`·`/pricing`·`/login`·`/mypage`(사역자·교회). 남은 Fable 초안 = `/jobs/new`·`/jobs/[id]/edit`·`/terms`·`/privacy`·admin.
3. **100 mock 데이터 생성** — 교회 35 + 공고 100 (아래 §5).

> Fable 산출물은 **검증 통과 후에만** 채택했음(build·규칙·가드레일 스캔). Fable = 스캐폴드/드래프트, **확정은 사람 검수**.

---

## 3. 작업 방식 (계속 이렇게)

**"Fable로 전체 스캐폴드 → 페이지 하나씩: 시안으로 디자인 확정 → 코드 → SPEC/DATA 갱신 → 페이지별 커밋+푸시+머지."**

- **시안**: `scratchpad/*.html`을 만들어 브라우저에서 여러 안 비교 → 사용자가 택1 → 코드. (예: `detail-*-mockup.html`, `jobs-*-mockup.html`)
- **디자인은 섹션 구조/레이아웃 먼저** → 컴포넌트 → 조합. 색은 토큰이라 나중 스왑 가능.
- **아이콘**: 공고 상세는 **전부 제거**(텍스트/점). 저장·공유(JobActions) 버튼만 아이콘 유지. → 앞으로도 아이콘 최소/텍스트 지향.
- **데이터 seam**: 페이지·뷰는 `@/mocks` 직접 import 금지 → `lib/queries/*`만. mock JSON에 필드 채우며 스키마 확정 → 완료 시 DATA.md.
- **인증/admin**: 원칙은 "mock 안 만들고 Phase 1 실백엔드"였으나, **디자인 미리보기 위해 Fable가 mock으로 스캐폴드**함(결정 변경). Phase 1에서 실 인증·백엔드로 재작업.
- **커밋**: 페이지 완료 시 그 페이지 파일 + 관련 docs를 함께. dev→prod **ff-only 머지**. (커밋/푸시/머지는 사용자 요청 시에만)

---

## 4. 실행 / 검증

```bash
npm run dev      # http://localhost:3000 (다른 프로젝트가 :3000 점유 시 :3001+)
npm run build    # TS + Cache Components 검증 (핵심 게이트)
npm run lint     # eslint
npx prettier --check <file>   # 포맷
```
**확인 URL(mock)**: `/jobs`(공고 100·필터·정렬·페이지당) · `/jobs/job-010`(재공고 3회·유초등부) · `/jobs/job-004`(owned·제출서류 긴 것) · `/jobs/job-054`(CLOSED 배너) · `/churches/ch-saesomang`(재공고).

---

## 5. 데이터 (mock 스키마 = 확정 진행 중)

### mock 현황 (`src/mocks/`)
- **churches.json 35개** · **jobs.json 101개**. 분포: OPEN 75 / CLOSED 22 / PENDING 4 · OPERATOR(owner 없음)·CHURCH 혼합. 재공고 데모 4교회 · **새벽빛교회(ch-saebyeok) = 교회 등록 3 + 운영자 등록 1(job-101, 클레임 데모)**.
- **mock 로그인 계정**(`src/lib/mock-auth.ts`, 비번 `test1234`): `test1@test.com`(이도현·새벽빛교회 **인증** APPROVED) · `test2@test.com`(박서연·**미인증** 순수 사역자). 세션 = 비httpOnly 쿠키 `mj_session`.

### enum (`src/constants/domain.ts`)
DENOMINATIONS · REGIONS(18) · POSITIONS(담임목사·부목사·전도사·강도사·기타) · DEPARTMENTS · EMPLOYMENT_TYPES · **QUALIFICATIONS**(ANY·ENTRY·EXPERIENCED·ORDAINED·SEMINARIAN) · **JOB_STATUSES**(OPEN·CLOSED·**PENDING**) · FEATURED_TIERS · JOB_SOURCES · CHURCH_CHANNELS · **CHURCH_VERIFICATION_STATUSES**(PENDING·APPROVED·REJECTED) · STIPEND_NOTE_PRESETS · REQUIRED_DOC_PRESETS

### 타입 (`src/types/domain.ts`) — 이번에 추가된 것
- `Job`에 **`qualification?`(자격/경력)** · **`housingProvided?`(사택)** · `ownerId?`(교회 직접 등록 소유). — 전부 additive/optional.
- `CurrentUser` = `{id, email, name|null, churchId|null, churchName|null, churchVerificationStatus|null}` — **배타적 role 없음**(단일 계정). 권한 파생 `hasChurchAccess` = `lib/auth.ts`. `FilterDim`에 `qualification`.
- `repost-tracking`: `RepostInfo` = `{ count, postings: RolePosting[] }` (상세 재공고 타임라인용).
- `Church`에 **`photos?: string[]`**(첫 장=커버; DATA `church_photos` 1:N 테이블). 기존 `photoUrl` 폐기.

### seam (`src/lib/queries/*.ts`, `'use cache'`+`cacheTag`+`cacheLife("days")`)
- `jobs.ts`: getAdJobs·getListJobs·getAllJobCards·getJobStats·getJobDetail·getRepost·getSimilarJobs·getChurchOpenJobs·getSearchSuggestions
- `churches.ts`: getChurch·getChurchTimeline
- `users.ts`(**인증 mock**): getCurrentUser(**세션 쿠키** 읽음)·getChurchDashboard(church_id 기준)·getEditableJob. (`getOwnedJobs` 폐기, `'use cache'` 없음 — 인증 의존)

---

## 6. 이번 세션 확정 설계 (되돌리지 말 것)

- **/jobs**: 대표광고를 **리스트 안에 통합**(별도 밴드 폐기, 배경 틴트 없이 작은 "광고" 태그, 티어 차이=노출 위치) · **검색 존**(옅은 초록 밴드: H1+설명+"모집 중 N건") · **결과 툴바**(정렬 + **페이지당 20/50/100**) · **자격/경력·사택 필터 추가**(성별·결혼 필터 금지) · 최근 본 공고 정보형 · 교회 CTA 위젯 · 좌필터 스크롤(우레일만 sticky). "총 N건" = 모집 중(HERO 포함).
- **/jobs/[id]**: **단일 흐름 본문(여백형)** + **우측 요약 카드 B**(지원하기 상단 + 사례비·마감·고용) + **재공고 이력 접이식** + 비슷한 6개+더보기 + **아이콘 없음** + 지도 placeholder.
- **/churches/[id]**(재설계): 얇은 허브 — 순서 **커버(사진 갤러리·라이트박스) → 채널(brand 색·아이콘) → 청빙 공고(현재+지난 통합, 재공고 배지) → 위치(지도)**. 공고가 방문 의도라 위로. **아바타 폐기** · **교회 소개 텍스트 미채택**(채널·유튜브로 파악 대체) · 카드 hover=`bg-muted/40`. 사진 = `Church.photos[]`(mock placeholder SVG, 업로드 Phase 1).
- **지원 모델**: **사이트 내 지원 안 받음** — 원문/교회로 안내. 교회 직접 등록은 나중 `applyMethod` 필드(Phase 1). 사이트 내 지원 중개는 Phase 3.
- **지도**: Phase 1 = 링크/placeholder, Phase 2 = 네이버/카카오 임베드(주소 필드+API 키).
- **헤더/계정(2026-07-13)**: 아바타 = **마이페이지 직행 링크**(드롭다운 폐기). 우측 상시 **"교회 공고 등록"**(로그인 상태로 분기: 비로그인→/login, 미인증→/verify, 인증→/church). 로그아웃·**회원탈퇴**(danger zone)는 `/mypage` 계정 섹션. footer 위 전 페이지 공통 여백 `mt-16 sm:mt-20`. 골드-틴트 대비 텍스트 토큰 `--gold-ink`.
- **`/jobs/new`·edit 3스텝 위저드(2026-07-13, 조사 기반)**: 상단 진행바 + 스텝 안 왼쪽 섹션 타임라인(스크롤 스파이). **필수 4개**(제목·직분·고용형태·접수 방법)뿐, "＊만 필수" 안내. Step1 모집기본(교회정보·모집내용·자격 프리셋·**함께할 사역자에게**=description) / Step2 처우·서류(사례비+**사택**·**제출서류 필수/선택**·전형절차) / Step3 지원·마감(접수 방법 다중·문의처·마감). 직분/부서 **기타→직접입력**. **성별·연령·결혼 필드 없음**(가드레일). 컴포넌트: `check-list.tsx`·`job-wizard.tsx`.
- **`/mypage/church` 재설계 구현(2026-07-14, mock)**: 기업 대시보드 조사 반영, **지원자·전형(ATS) 전면 제외**(사이트 내 지원 없음). ① **검수중 스탯/탭 제거**(인증 교회 자동 게재; 단 잔여 PENDING은 행에서 검수중 배지+안내, 마감 액션 없음) → ② 스탯바 대신 **탭**[전체·게재중·마감] ③ 헤더 우상단 = 교회 정보 관리 + ＋새 공고 등록 ④ 클레임 = 목록 위 배너(조건부) ⑤ **우측 사이드바 = 노출 광고 전용**(메인 BM, sticky: 프리미엄 주7만·대표광고 주15만 + 상품 보기) ⑥ 공고 행(`MyJobRow`, client)=게재중 수정+⋯(마감·삭제)/마감 재등록+⋯(삭제)/검수중 수정+⋯(삭제). 케밥 Escape·ARIA ⑦ 조회·북마크 지표는 Phase 1. **재청빙 지표는 공개 교회상세로 이관**. (컴포넌트: `church-view.tsx`·`church-job-list.tsx`·`my-job-row.tsx`)
- **`/mypage/church/info` 신규 구현(별도 페이지, mock)**: 기본정보(교회명·교단=수정 문의 / 지역·시군구·창립연도 편집) · 한줄+상세 소개 · **대표 공개 연락처**(개인 담당자 X) · 채널 **6종**(홈피·유튜브·인스타·페북·밴드·**기타**) · **교회 사진**(커버·순서, 업로드 Phase 1). APPROVED 전용 게이트. → `/churches/[id]`·공고에 반영. 소개·대표 연락처는 Phase 1 DATA 추가.

---

## 7. ▶ 다음 작업 (집에서 이어서)

**▶ 바로 다음:**
1. **`/jobs/new` 인증 게이트** — 미인증 접근 시 `/mypage/verify`로(현재 안 막힘) · `/jobs/[id]/edit` 권한 = 교회 인증 멤버십(owner 아님)
2. **`/mypage/verify` REJECTED 화면** 보강 · **`/terms`·`/privacy`** 문구(법률검토 후)
3. **admin 3종**(`/admin`·`/admin/jobs`·`/admin/ingest` = 현재 Placeholder → 특히 `/admin/ingest` 수집→구조화 파이프라인)
4. **배포 & NHN KCP 심사 선행**(ROADMAP 1-8) — admin 제외 기본 페이지 완성(+취소/환불 규정·사업자정보 표기) → JSON 더미 그대로 **배포** → KCP 가맹 신청·사이트 심사(느림, 먼저) → **승인 후 온라인 결제 연동**. 결제는 KCP 승인 후 붙임("문의 결제"는 과도기)
5. **Phase 1**: Supabase·인증(proxy)·모든 mutation `actions.ts`·`'use cache'` 실적용·계정 북마크·sitemap/robots·배포 · DATA 스키마 반영(모집인원·부임시기·전형절차·접수방법·서류 필수여부·사택 협의·교회 소개·대표 연락처)
> ✅ **완료(2026-07-14)**: `/mypage/church` 대시보드 재설계 + `/mypage/church/info` 신규(시안 = `docs/mockups/church-dashboard.html`).
> **온보딩 결정(2026-07-12)**: 가입 시 프로필 모달 없음 — 이름=SNS 닉네임/이메일 가입폼, 직분은 안 받음(인재 프로필 Phase 3), 담당자 정보=교회 인증 폼에서. 구직자 관심교회·알림 = Phase 2.
> **시안 위치**: 이번 세션 확정 시안은 `docs/mockups/`에 커밋됨(스크래치패드는 기기 간 동기화 안 됨). 그 외 과거 시안은 로컬 scratchpad에만 존재.

**미결 TODO**(코드에 표시): 정렬 "사례비순"(인터뷰 "세상적") 유지/축소 · 필터↔URL 동기화 시점 · 부서 세분화(ROADMAP 1-7) · CLOSED 공고 JSON-LD 제거 여부 · 아이콘 제거 범위(홈·목록의 지역핀·검색 돋보기도 뺄지).

---

## 8. 스택 · 아키텍처 (요약 — 상세는 CLAUDE.md)

- **Next.js 16.2.9**(App Router, `cacheComponents:true`) · **React 19** · **TS strict** · **Tailwind v4** · **shadcn/ui(Base UI)** · **Pretendard** · **Supabase 미연동**(Phase 1).
- 색 = **딥그린+골드**(`globals.css` 토큰). 아이콘 = lucide(최소 사용).
- 레이어: `page.tsx`=조합 / `*-view.tsx`=프레젠테이션(기본 서버) / `lib/queries/*`=데이터 seam(mock↔DB 본문만 교체) / `components/**`=재사용 UI.
- 캐시: 홈·/jobs·/about·/pricing = `○ Static`(쿼리 `'use cache'`+`cacheTag`+`cacheLife`), 상세·인증(/mypage·/mypage/church·/jobs/new·edit) = `◐ PPR`(params/auth 의존 `<Suspense>`).
- **mock 인증**: 세션 = 비httpOnly 쿠키 `mj_session`(`lib/mock-auth`). 서버는 authed 페이지에서 `getCurrentUser`가 `cookies()` 읽음 · 헤더는 **client island**(`header-account`)에서 읽어 **공개 페이지 캐시 유지**. 권한 파생 = `lib/auth.hasChurchAccess`. 실 인증(Supabase)은 Phase 1.
- ⚠️ `lib/supabase/*`·`lib/ingest/*`·`proxy.ts`·`actions.ts`·`types/database.ts` — CLAUDE 트리엔 있지만 **아직 없음**(Phase 1).

---

## 9. 수익 모델 & 노출 상품 (BM — 2026-07-08 조사·확정)

> 4개 subagent로 사람인·잡코리아·원티드·인크루트·갓피플·청빙넷·기독정보넷·알바몬/천국·인디드를 조사 후 확정. **되돌리지 말 것.** (`/pricing` 페이지 시안의 근거)

### A. 수익 모델 5종 — 판정

| 모델 | 설명 | 사례 | 민잡 |
|---|---|---|---|
| ① 무료공고 + **유료 노출광고** | 공고 무료, 상단·강조·메인 노출만 유료 | 사람인·잡코리아·갓피플 | ✅ **채택(핵심 BM)** |
| ② 성공보수 | 채용 성사 시 연봉%·정액 | 원티드(연봉 7%, 최소 50만) | ❌ **제외** — 사이트 내 지원 안 받아 성사 추적 불가 + 성직매매 정서 + 인프라 큼 |
| ③ 정액 구독 | 기간 정액, 그동안 다건 노출 | 원티드 이코노미/언리미티드 | 🔸 **Phase 2+** — 교단·노회·단체(다건 채용)용 |
| ④ 이력서 열람·인재검색 | 구직자 프로필 DB 열람권 | 사람인·잡코리아 | 🔸 **Phase 2+** — 교역자 구직 프로필 풀 쌓인 뒤(민감정보 동의 설계 필수) |
| ⑤ 완전 무료(공공) | 전액 무료 | 고용24 | — 해당 없음 |

→ **민잡 BM = ① 유료 노출 광고**(지금) **+ ④ 이력서 열람**(Phase 2). **②는 완전 제외.**

### B. "유료 노출 광고" 안의 상품 레버 7종 — 채택

| 레버 | 대형사/니치 예 | 민잡 |
|---|---|---|
| ① 리스트 상단 고정 | 사람인 지면(5.2~22만/일)·잡코리아 채용관·원티드 직무상단 5구좌·갓피플 스페셜 | ✅ **프리미엄** |
| ② 메인/홈 배너 | 사람인 플래티넘~알짜(주 100~770만)·원티드 메인배너·갓피플 취업홈 상단 | ✅ **대표광고**(홈+최상단) |
| ③ 강조(볼드·컬러·배경·로고) | 사람인 강조효과(+1.25만/일)·갓피플 아이콘/배경색 | ❌ 안 팜 — "광고 태그·tint 없음" 정책 |
| ④ 끌어올리기(bump) | 사람인 랭크업(2.7만/7일)·잡코리아 점프업·갓피플 긴급 | ❌ 제외 — 공고량 적어 안 묻힘 |
| ⑤ 검색결과 상단 | 사람인 검색플러스(8.8만/일)·인디드 CPC | 🔸 Phase 2+ (트래픽 필요) |
| ⑥ 기간 연장/2배 | 인크루트 7일↑ 2배·갓피플 7→14일 | ✅ **런칭 프로모션**으로 |
| ⑦ 묶음·볼륨 할인 | PC+모바일 결합(사람인 20%·인크루트 40%)·볼륨(원티드 50만↑ 20%) | ✅ 4주 묶음 할인 |

### C. 민잡 최종 상품표 (유료 노출 광고)

| 상품 | 레버 | 노출 | 정가(앵커) | 묶음 |
|---|---|---|---|---|
| **기본 공고** | — | 최신순 리스트(무료) | **0원** | — |
| **프리미엄** | ① | 목록 상단 그룹 고정 + "광고" 태그 | **7만원 / 주** | 4주 24만 |
| **대표광고(HERO)** | ①+② | 홈 + 목록 **최상단 대표 슬롯**, **소수 구좌 한정(매진제)** | **15만원 / 주** | 4주 50만 |

### D. 운영 원칙

- **주 단위** — 청빙 마감 주기(2~4주)와 맞음. 갓피플·원티드도 주 단위.
- **대표광고 = 소수 구좌 매진제**(원티드 직무상단 5구좌식) → 희소성으로 15만/주 정당화 + 운영 부담↓.
- **정가는 높게 앵커링 → 초기엔 무료·할인 시딩.** 내리긴 쉬워도 올리긴 어렵다(기존 고객 반발). 트래픽 쌓이면 프로모션만 걷어 자연 정가화.
- **강조·끌어올리기·검색상단은 안 판다** — 단순성 = 니치의 무기(add-on 사다리는 대형사 게임). 대표광고도 tint 없이 "광고 태그"만.
- **`/pricing` = "안내 + 문의"** 수준. 라이브 결제·구좌예약 없음. 실단가·부가세·묶음 할인 최종 확정은 Phase 2.
- 지원은 사이트 밖(원문/교회) → 성공보수 불가.

### E. 조사 벤치마크 (실단가, 2026-07)

- **사람인**: 메인배너 주 100~770만 · 지면 일 5.2~22만 · 검색 일 8.8만 · 랭크업 2.7만/7일. "위치×등급×기간 + add-on" 사다리.
- **잡코리아**: 채용관 일 4.4~198만 · 점프업 일 3~5만 · 대량 패키지 최대 78%↓.
- **원티드**: 성공보수(연봉 7%) + 직무상단광고 **5구좌 주 5~20만**(태그당). 강조·끌올 없음(단순).
- **인크루트**: 노출 7종 전부 상품화. 메인패키지 주 158만~3천만 · 리스트 2일 13~58만 · 랭크업 6만/2일.
- **갓피플(니치 벤치마크)**: 스페셜 8.8만 · 추천 4.4만 · 긴급(bump) 2.2만 / **7일** + 기간 2배 프로모션. 등록·인재찾기는 무료.
- **청빙넷·기독정보넷(cjob)**: **유료 상품 없음**(무료 게시판) = 구조화된 저가 노출로 **선점할 빈틈**.

### F. 포지셔닝

청빙넷·기독정보넷이 유료화 못 한 자리를, **갓피플보다 더 단순·투명한 2단 상품(프리미엄·대표광고)** 으로 선점. 대형사의 복잡한 매트릭스는 1인 운영엔 부적합 — **단순성이 차별점.**

### G. `/pricing` 페이지 구현 (2026-07-09)
히어로 → **상품 3카드**(무료·프리미엄 7만/주·대표광고 15만/주, 가격 공개 + "문의하기") → **한눈에 비교** → **믿고 노출하세요**(getCoverageStats 실집계 + 하단 슬림 바 "운영자 검수·VAT 포함") → **문의**(mailto) → **FAQ**. 유료 카드의 **"노출 화면 미리보기" → 풀스크린 모달**(`components/pricing/exposure-preview.tsx`, client): PC/모바일 토글(뷰포트 기본) + 상품별 **전체 페이지 장면 캐러셀**(footer 제외). 결제는 문의 기반(라이브 결제 Phase 2). 상세 SPEC `/pricing`.

---

## 10. 계정·역할·인증 모델 + `/mypage` 설계 (2026-07-10 확정 — 코드 전)

> `/mypage`는 **설계·시안·모델 확정, 코드 미착수**. 집에서 이어서. 시안: `scratchpad/mypage-church-mockup.html`(A. 인증완료 관리뷰 / B. 인증 검수중 게이트). **아래 결정은 되돌리지 말 것.**

### A. 계정/역할 모델 (2026-07-12 refinement — 되돌리지 말 것)
> ⚠️ 이전 "가입 시 역할 하드 분기 + `users.role = SEEKER|CHURCH`"는 **폐기**. 아래 단일 계정 모델로 대체(타 플랫폼 재조사 근거 §E + LinkedIn/원티드/Indeed 중간형).
- **단일 계정 + 역할 view**: 계정은 하나, 모든 계정은 기본 **사역자(MINISTER)**. **교회 인증(증빙 + 운영자 승인) 통과 시** 같은 계정에 **교회(CHURCH) view** 개방. 부교역자가 구직자이면서 자기 교회 담당자인 케이스를 단일 정체성이 자연 처리.
- **"교회 계정" 없음**: 교회는 `churches` 엔티티, 사람 계정은 관리 자격. `users`에서 `role` 제거 → **`church_id`(nullable·다대일=다중 담당자) + `church_verification_status`(PENDING/APPROVED/REJECTED)**. 파생 `hasChurchAccess = church_id && APPROVED`. **가입 시 역할 선택 불필요**.
- **공고 소유 = 교회 엔티티**. `jobs.owner_id`는 작성자(감사)로 강등 — **편집 권한 = 그 교회 인증 관리자 여부**(owner 일치 X). 담당자 이동 시 공고는 교회 잔류(owner NULL)·클레임으로 회수. 인증은 **교회별**.
- Phase: **로그인·교회 인증·공고관리·북마크 = Phase 1**(북마크는 단일 계정이라 이동), 관심 교회 팔로우·재공고 알림 = Phase 2.
- 상세 스키마 = DATA §2·§3(users)·§4·§9. 페이지 명세 = SPEC 사용자 모델·§B·/mypage 블록.

### B. 교회 인증 (공고 게재 게이트 — "누구나" 차단)
- **증빙 서류 제출 + 운영자 승인**: 가입 시 **고유번호증(또는 사업자등록증)** 사본 + 교회정보 → 운영자 검토·승인 → **인증 교회만 공고 게재**. 승인 전 게재 불가(작성 게이트).
- 사업자등록증 강제(사람인·갓피플식) 대신 **고유번호증**(교회 대부분 보유 = 기부금영수증용) 수용. 서류 없는 교회 대비 = **공개 대표연락처 인증코드**(하이브리드, 후순위).
- 상태: **검수중 → 인증완료(배지) / 반려**. 공고는 등록 시 여전히 `PENDING` 운영자 검수.

### C. `/mypage` 교회 view 섹션 (Phase 1, `getOwnedJobs` 있음)
1. 계정 헤더(교회명 + **인증 상태 배지**) 2. **요약**(게재중/검수중/마감) 3. **내 공고 목록**(상태 배지·노출 배지 + 액션: **수정·마감·복사=재등록·삭제**; 마감건은 복사만) + **"노출 올리기→문의"**(pricing 연동) 4. **새 공고 등록** CTA(**인증 전 비활성**) 5. ⭐**운영자 공고 클레임**(owner 없는 병존 공고를 이 계정에 연결 — 우리 고유) 6. 교회정보 설정
- **제외**: 지원자 관리·이력서 열람(사이트 내 지원 X) · 결제/세금계산서(Phase 2) · 인재검색·제안(Phase 2)

### D. `/mypage` 사역자 view
- **Phase 1**: 최근 본 공고 + **북마크**(단일 계정이라 Phase 1로 이동). **Phase 2**: **관심 교회 팔로우·재공고 알림**(관심기업 번안 = 재공고추적 차별점 직결) + 알림/계정 설정. 지원현황·이력서공개·받은제안 **제외**.

### E. 조사 근거 (subagent, 2026-07-10)
- 타 플랫폼 마이페이지: **기업** = 공고 목록(상태축) + 액션(복사=재등록 표준) + 지원자관리(이력서 열람) + 유료상품·결제·세금계산서 + 기업정보. **개인** = 스크랩/북마크 + 지원현황 + 이력서공개 + 열람기업·받은제안 + 최근본/추천.
- **니치**: 청빙넷·기독정보넷 = 게시판형(통합 관리 UI 없음). **갓피플만** 마이페이지+유료노출+공고 CRUD 보유(사업자등록증 증빙 필수).

### F. TODO (집에서)
1. ✅ **SPEC/DATA/§10 반영 완료(2026-07-12)**: role 제거 → `church_id` + `church_verification_status` · owner_id 작성자로 강등 · 교회 인증(증빙+승인) · /mypage 상태별 섹션 (DATA §2·§3·§4·§9, SPEC 사용자 모델·§B·/mypage)
2. **/mypage 교회 view 코드 구현**(mock 위, 업로드·승인·클레임 실동작은 Phase 1) ← 다음
3. ~~로그인 역할 선택 흐름~~ → **불필요 확정**: 단일 계정(로그인=사역자), 교회는 인증으로 승격. 로그인 UI 변경 없음
