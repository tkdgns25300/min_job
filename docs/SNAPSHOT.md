# SNAPSHOT — MinJob 작업 시점 핸드오프

> **이 문서 하나로 "지금 상황" 파악.** 역할 분리: [`CLAUDE.md`](../CLAUDE.md)(HOW·아키텍처·가드레일), [`SPEC.md`](./SPEC.md)(페이지 명세), [`ROADMAP.md`](./ROADMAP.md)(작업 단위), [`DATA.md`](./DATA.md)(데이터), [`INTERVIEWS.md`](./INTERVIEWS.md)(인터뷰).
>
> **작성 시점**: 2026-07-07 · **HEAD**: 이 스냅샷 커밋 (직전 코드 = `1073005`) · **dev = prod = origin**

---

## 0. 한 문장 요약

흩어진 교회 **사역자 청빙 공고**를 모아 구조화·비교·재공고추적으로 차별화하는 채용 플랫폼. 현재 **mock 데이터로 공개 페이지를 한 페이지씩 디자인하며 스키마를 확정하는 단계**. **홈·공고목록(/jobs)·공고상세(/jobs/[id]) = 디자인·검수·커밋 완료.** 나머지 페이지는 **Fable(AI)가 스캐폴드한 초안이 repo에 있고(검수 전)**, 그 위에서 페이지별로 다듬는 중. 백엔드(Supabase)·인증·admin·배포는 Phase 1(아직).

---

## 1. 페이지 현황 (핵심)

**범례**: ✅ 완료(검수+커밋) · 🟡 Fable 초안(코드 있음·검수 전) · ⬜ 스캐폴드(미착수)

| 페이지 | 섹션 | 디자인 | 검수 | 커밋 | 데이터 |
|---|:--:|:--:|:--:|---|:--:|
| `/` 홈 | ✅ | ✅ | ✅ | ✅ (이전 세션) | mock |
| `/jobs` 목록 | ✅ | ✅ | ✅ | ✅ `af391ce`·`0119de9`·`03d2758` | mock |
| `/jobs/[id]` 공고 상세 | ✅ | ✅ | ✅ | ✅ `85f53bb` | mock |
| `/churches/[id]` 교회 상세 | 🟡 | 🟡 | ⬜ | WIP `1073005` | mock |
| `/about` 소개 | 🟡 | 🟡 | ⬜ | WIP `1073005` | 정적 |
| `/pricing` 노출 안내 | 🟡 | 🟡 | ⬜ | WIP `1073005` | 정적 |
| `/terms`·`/privacy` | 🟡 | ⬜ | ⬜ | (Fable 미변경) | — (법률검토) |
| `/login` | 🟡 | 🟡 | ⬜ | WIP `1073005` | mock |
| `/mypage` | 🟡 | 🟡 | ⬜ | WIP `1073005` | mock |
| `/jobs/new` 공고 등록 | 🟡 | 🟡 | ⬜ | WIP `1073005` | mock |
| `/jobs/[id]/edit` 수정 | 🟡 | 🟡 | ⬜ | WIP `1073005` | mock |
| `/admin/jobs`·`/admin/ingest` | ⬜ | ⬜ | ⬜ | 스캐폴드 | — |

> **완료 = 홈 + /jobs + /jobs/[id] 3개.** 나머지 공개·인증은 **Fable 초안(🟡)** — 커밋돼 있어 집에서 pull하면 그대로 있음. **초안 ≠ 검수 완료** — 페이지별로 시안→검수→재디자인 필요. admin은 아직 안 건드림.
> **드롭됨**: `/churches`(교회 목록 browse), 교회 규모 필드.

---

## 2. Fable(AI)로 한 것

이 프로젝트는 **Fable 모델로 "전체 개괄"을 먼저 깔고, 그 위에서 페이지별로 상세히 다듬는** 방식을 씀. Fable가 한 3가지:

1. **`docs/fable.md`** — 전 페이지(공개·인증·admin) **섹션+디자인 제안서**. 사람 검토용 초안. (SPEC로 흡수 후 삭제 가능)
2. **공개+인증 페이지에 디자인 코드 적용** — Fable가 홈 디자인 언어(딥그린)로 각 페이지를 코드로 스캐폴드. 이게 지금 `🟡` 초안들.
   - 이후 **`/jobs`·`/jobs/[id]`는 사람 검수로 전면 재디자인**(Fable 초안 → 확정). 나머지(교회상세·about·pricing·인증)는 **Fable 초안 그대로 대기**.
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
- **churches.json 35개** · **jobs.json 100개** (`7475f4f`). 분포: OPEN 74 / CLOSED 22 / PENDING 4 · HERO 3 / PREMIUM 7 · OPERATOR 88(owner 없음) / CHURCH 12(owner 있음). **재공고 데모 4교회**(새소망 유초등부 3회 등) · **owned 3건**(`user-saebyeok`, mypage용).

### enum (`src/constants/domain.ts`)
DENOMINATIONS · REGIONS(18) · POSITIONS(담임목사·부목사·전도사·강도사·기타) · DEPARTMENTS · EMPLOYMENT_TYPES · **QUALIFICATIONS**(ANY·ENTRY·EXPERIENCED·ORDAINED·SEMINARIAN) · **JOB_STATUSES**(OPEN·CLOSED·**PENDING**) · FEATURED_TIERS · JOB_SOURCES · CHURCH_CHANNELS · STIPEND_NOTE_PRESETS · REQUIRED_DOC_PRESETS

### 타입 (`src/types/domain.ts`) — 이번에 추가된 것
- `Job`에 **`qualification?`(자격/경력)** · **`housingProvided?`(사택)** · `ownerId?`(교회 직접 등록 소유). — 전부 additive/optional.
- `CurrentUser`(인증 mock), `FilterDim`에 `qualification` 추가.
- `repost-tracking`: `RepostInfo` = `{ count, postings: RolePosting[] }` (상세 재공고 타임라인용).

### seam (`src/lib/queries/*.ts`, `'use cache'`+`cacheTag`+`cacheLife("days")`)
- `jobs.ts`: getAdJobs·getListJobs·getAllJobCards·getJobStats·getJobDetail·getRepost·getSimilarJobs·getChurchOpenJobs·getSearchSuggestions
- `churches.ts`: getChurch·getChurchTimeline
- `users.ts`(**Fable, 인증 mock**): getCurrentUser·getOwnedJobs·getEditableJob (`'use cache'` 없음 — 인증 의존)

---

## 6. 이번 세션 확정 설계 (되돌리지 말 것)

- **/jobs**: 대표광고를 **리스트 안에 통합**(별도 밴드 폐기, 배경 틴트 없이 작은 "광고" 태그, 티어 차이=노출 위치) · **검색 존**(옅은 초록 밴드: H1+설명+"모집 중 N건") · **결과 툴바**(정렬 + **페이지당 20/50/100**) · **자격/경력·사택 필터 추가**(성별·결혼 필터 금지) · 최근 본 공고 정보형 · 교회 CTA 위젯 · 좌필터 스크롤(우레일만 sticky). "총 N건" = 모집 중(HERO 포함).
- **/jobs/[id]**: **단일 흐름 본문(여백형)** + **우측 요약 카드 B**(지원하기 상단 + 사례비·마감·고용) + **재공고 이력 접이식** + 비슷한 6개+더보기 + **아이콘 없음** + 지도 placeholder.
- **지원 모델**: **사이트 내 지원 안 받음** — 원문/교회로 안내. 교회 직접 등록은 나중 `applyMethod` 필드(Phase 1). 사이트 내 지원 중개는 Phase 3.
- **지도**: Phase 1 = 링크/placeholder, Phase 2 = 네이버/카카오 임베드(주소 필드+API 키).

---

## 7. ▶ 다음 작업 (집에서 이어서)

**유저플로우 순서로 페이지별 검수·재디자인:**
1. **`/churches/[id]` 교회 상세** ← 다음 (Fable 초안 있음. 시안→검수→재디자인)
2. `/about` · `/pricing` 검수 · `/terms`·`/privacy` 법률 검토(내용)
3. **인증 4개**(`/login`·`/mypage`·`/jobs/new`·`/jobs/[id]/edit`) 검수 — Fable mock 초안 위에서
4. **admin 2개**(`/admin/jobs`·`/admin/ingest`) — 미착수
5. **Phase 1**: Supabase·인증(proxy)·`'use cache'` 실적용·sitemap/robots·Vercel 배포

**미결 TODO**(코드에 표시): 정렬 "사례비순"(인터뷰 "세상적") 유지/축소 · 필터↔URL 동기화 시점 · 부서 세분화(ROADMAP 1-7) · CLOSED 공고 JSON-LD 제거 여부 · 아이콘 제거 범위(홈·목록의 지역핀·검색 돋보기도 뺄지).

---

## 8. 스택 · 아키텍처 (요약 — 상세는 CLAUDE.md)

- **Next.js 16.2.9**(App Router, `cacheComponents:true`) · **React 19** · **TS strict** · **Tailwind v4** · **shadcn/ui(Base UI)** · **Pretendard** · **Supabase 미연동**(Phase 1).
- 색 = **딥그린+골드**(`globals.css` 토큰). 아이콘 = lucide(최소 사용).
- 레이어: `page.tsx`=조합 / `*-view.tsx`=프레젠테이션(기본 서버) / `lib/queries/*`=데이터 seam(mock↔DB 본문만 교체) / `components/**`=재사용 UI.
- 캐시: 홈·/jobs = `○ Static`(쿼리 `'use cache'`+`cacheTag`+`cacheLife`), 상세·인증 = `◐ PPR`(params/auth 의존 `<Suspense>`).
- ⚠️ `lib/supabase/*`·`lib/ingest/*`·`proxy.ts`·`actions.ts`·`types/database.ts` — CLAUDE 트리엔 있지만 **아직 없음**(Phase 1).
