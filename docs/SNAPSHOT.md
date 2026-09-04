# SNAPSHOT — MinJob 작업 시점 핸드오프

> **이 문서 하나로 "지금 상황" 파악.** 역할 분리: [`CLAUDE.md`](../CLAUDE.md)(HOW·아키텍처·가드레일), [`SPEC.md`](./SPEC.md)(페이지 명세), [`ROADMAP.md`](./ROADMAP.md)(작업 단위), [`DATA.md`](./DATA.md)(데이터), [`INTERVIEWS.md`](./INTERVIEWS.md)(인터뷰).
>
> **작성 시점**: 2026-08-11 · **HEAD**: 이 스냅샷 커밋 · ✅ **dev = prod = origin/\*** (fast-forward only, merge 커밋 0). 배포 설정·로그인 실동작 확인 완료.
>
> ▶ **2026-07-28 방향 전환**: 크롤러 도입(min_job_agent) + **개교회 채용**으로 범위 확장 (§0 한 문장 요약·§0 완료도·§6 방향 전환 기록).
>
> ▶ **2026-07-29 로그인 실전환**: mock 세션(`mj_session`) → **Supabase Auth Google OAuth** + 운영자 게이트(§5 인증·§7 ①·§8). **dev·prod 반영 완료.**
>
> ▶ **2026-08-05 KCP 심사 종료 → prod 동결 해제**: 카드사 등록신청 심사가 끝나 "심사 중 변경 금지" 제약이 풀렸다. **prod를 dev로 fast-forward**(7/29 로그인 전환 이후 23커밋 일괄 반영) + 테스트 계정 잔재 제거(ROADMAP 1-8·8). ⚠️ 결제 경로(`/mypage/church/promote`)는 `churchVerificationStatus` 하드코딩 `null` 때문에 **여전히 도달 불가** — 교회 멤버십 배선 전까지 비활성.
>
> ▶ **2026-08-05 스키마 확정**: `jobs` 미확정 7필드 + **스키마 6개 결정**(직분/직무 XOR CHECK · `stipend_*`→`pay_*` 개명 · 연락처 4컬럼 · `apply_methods` 폐기 · **`job_promotions` 신설**(테이블 7개) · 필수값 조임). **크롤러 실데이터 3,181건으로 검증해 최소 조건을 8개 → 필수 4 + CHECK 2로 줄였다**: 필수 `church_id`·`title`·`job_kind`·`description` / CHECK 직분XOR직무·연락처≥1. **뺀 3개 = 교단(명시 2.8%)·지역(81%)·게시일(PCKWORLD 60건)** — 게시판이 안 주거나 원문에 없는 값. 대가로 **NULL 표시 UI 3개 + `posted_at` 처리 3가지**(JSON-LD 생략·정렬 폴백·타입)가 숙제로 남았다. 근거·수치는 DATA.md §3, 결정 목록은 ROADMAP Phase 0. ⚠️ **확정은 문서에만 반영됐다** — `types/domain.ts`·mock은 아직 옛 스키마고 **18곳이 어긋난다**(ROADMAP Phase 0에 목록). 코드 변경은 `pay_*` 개명뿐. **마이그레이션 SQL도 아직 없다**(`supabase/` 폴더 없음) — 다음 관문은 `001_init.sql` + 타입·mock 정합을 **한 묶음으로** 도는 것.
>
> ▶ **2026-08-06 교회 식별을 claim으로 미룸**: 크롤러 요청 수용 — `jobs.church_id` **NOT NULL 해제** + `church_name`·`region` 추가. 교회 묶기가 자동 95%까지만 되고 **사람이 봐도 판정 안 되는 구간**이 남아(검증 불가 67개 · 같은 연락처 다른 교회명 83건), 확신 없는 `churches` 행을 만드는 대신 **교회가 claim할 때 채운다**. 필수 4의 1번이 `church_id` → `church_name`으로 교체. ⬜ **결정 2개 대기**(끌어올림 간격 N일 · `repostKey` 처리) — §7 상단.
>
> ▶ **2026-08-11 배포 확인 완료 + 만료 규칙 결정**: prod에서 **구글 로그인·`/admin` 실동작 확인**(설정 정본은 §7). 그리고 **공개 목록의 만료 규칙을 확정**했다(아직 미착수 — 아래 "결정만 하고 미착수" 참조). ⏳ 당시엔 크롤러 구조화 결과 대기였다 — **2026-08-21에 해소**: 스키마 적용 완료, `/admin/ingest`는 개편이 아니라 **`/admin/review`로 대체**(붙여넣기 삭제).
>
> ▶ **2026-08-16 교회 조인 경로 정합 (claim 결정을 코드로 내림)**: 2026-08-06의 `church_id` nullable 결정이 **DATA.md에만 있고 코드는 조인에 의존**하고 있었다. 조인이 실패하면 교단을 `ETC`·지역을 `SEOUL`로 **지어냈고**(미상이 기타교단·서울로 둔갑 → 필터·거점 판정 오염), 공고 상세는 교회가 없으면 **404**였다(크롤 공고가 통째로 안 열림). 잠복 상태였던 이유는 mock 101건이 전부 유효한 `church_id`를 갖고 있었기 때문 — 그래서 mock에 **미claim 14건**을 심어 재발을 막았다. 함께 고친 것: `getSimilarJobs`(둘 다 NULL이면 무관한 교회가 "같은 교회") · `getSearchSuggestions`(크롤 교회명 누락) · `getJobStats`(NULL이 한 덩어리) · `getCoverageStats`(NULL을 교단·지역 하나로 셈). 홈 지표는 **"함께하는 교회" → "청빙 중인 교회"** (수집 교회들은 우리와 함께하기로 한 적이 없다). 표기 규칙 = SPEC 공고 상세 §미claim 축소 표시.
>
> ▶ **2026-08-22 mock 제거 — 읽기가 전부 실 DB로**: `lib/queries` 18개 함수(jobs 12·churches 3·users 2·verifications 1)를 Supabase 쿼리로 교체하고 **`src/mocks/` 폴더를 삭제**했다. seam을 둔 값어치가 여기서 드러났다 — **페이지 코드 0줄 · 라우트 모드(`◐`/`○`) 그대로.** 새로 생긴 것 = `lib/queries/row-map.ts`(DB 행 → 도메인 41필드, enum 좁히기) · `lib/domain-enum.ts`(`keyOf`·`keysOf`·`enumLabel` — 캐스트를 한 곳에 가둔다) · `lib/job-visibility.ts`의 `isFeaturedOn`(유료 노출 기한 판정 — mock엔 없던 개념이라 기한 지난 등급이 영구 노출될 자리였다). 검증은 충돌 불가능한 이름의 임시 행 7개 + 교회 2곳 + 임시 인증신청 2건을 심어 **공개 페이지 23항목**을 실측하고 전부 지웠다(빈 DB에서도 확인). ⚠️ **`church_verifications` 테이블은 설계상 없다** — 신청은 `users.verification_*` + `churches` 행 조인으로 조립한다.
>
> ▶ **2026-08-28~29 마이페이지 정리 · 북마크 DB · 사진 축 제거**: ① `/mypage`를 재구성 — 교회 카드는 인증·신청중이면 맨 위, 구직자엔 아래(사람에 따라 순서가 다르다), 관심 교회 "준비 중" 상자·회원탈퇴 빨간 상자 제거, 최근 본 공고는 서버 카드로 그려 지운 공고가 자동으로 빠진다. ② **북마크를 localStorage에서 `bookmarks` 표로** — 새 seam `lib/queries/bookmarks.ts`(비캐시) + `setBookmark` 액션 + `components/job/bookmark-provider.tsx`(컨텍스트 · 헤더 세션 hole이 seed). 비로그인은 저장을 누르면 로그인으로(A안). `/mypage`가 공고 885건 전부를 내리던 것이 그 사람 것만으로. `toCard`는 `row-map`으로. ⚠️ 레이아웃 provider에 `useSearchParams`를 쓰면 프리렌더 트리 전체가 dynamic hole이 된다 — 클릭 시점 `window.location`으로. ③ **사진 업로드를 MVP 밖(Phase 2)으로** 미루면서 코드에서 사진 축 전체 제거 — 정보 관리의 `disabled` 구획·`ChurchGallery`(`e586fe0`)·`Church.photos`·`church_photos` 조인. 표는 남겼다. 되살릴 설계는 ROADMAP Phase 2.
>
> ▶ **2026-08-30 공개 상세 다듬기 (카드 사례비 "돈 아니면 협의"에 이어)**: 운영자가 상세 화면을 "더럽다"고 봤고 실데이터로 원인을 셋으로 좁혔다 — **지도 플레이스홀더 상자**(주소 있는 84%에 160px 빈 상자, 임베드로 읽힘) · **같은 말 두 번**(사택 "제공 · 사택제공" 102건, 지원 방법 안내와 하단 출처 문장) · **정보 아닌 조각**("기타" 직분 229건). 상자는 주소 옆 "지도에서 보기" 링크로, 사택 원문 표현은 보조 줄로(`housingDisplay`), "기타"뿐인 직분은 공개 화면에서 뺐고(`publicPositionLabel` — 검수·편집은 값을 그대로 본다), 안내 문장은 전부 없앴다 — 지원 방법 머리(연락처만 남김)와 하단 "운영자 등록 공고예요…"(출처는 우측 카드 원문 링크가, 문의는 푸터가 맡는다). **비슷한 공고**는 본문 아래 구분선(페이지 유일) + 큰 여백 뒤로 — 그전엔 본문 구획과 같은 제목·간격이라 공고의 일부처럼 읽혔다. **제출 서류**는 " · " 한 줄 → 대시 목록(다섯 목록 컬럼 중 유일한 예외 제거 · 정규화는 안 한다 — 화면이 텍스트를 해석하지 않으니 크롤러가 종류 필드를 만들어도 꼬일 곳이 없다). 같은 날 **화면 전수 점검**(390×1280, ROADMAP 디자인 단계) — 홈 390 오른쪽 넘침(`grid-cols-1` 누락)·카드 메타 줄 세로 쌓임(`flex-wrap`)·`/about`·`/pricing` "교회 1·지역 1·교단 1"(인증 교회 표 기준 → 공고 기준) 셋을 고쳤다.
>
> ▶ **2026-08-31 소개 페이지 재작성 · 연락처 이메일 통일**: `/about`을 8→6섹션으로 다시 썼다(§7 순서 2 · 구성 정본 = SPEC 소개 절) — "공고는 이렇게 모입니다" 두 경로(직접 등록 먼저)·교회 담당자 카드(인증 CTA만 — 수정·삭제 안내와 FAQ "내리고 싶어요"는 문의 페이지 예정으로 뺌, opt-out 임시 경로 = FAQ "원문과 다르면" 이메일·푸터) 신설, 현황 3수치(공고→지역→교회, 교단 제외), 크롤링 단어 없는 "직접 모아 정리" 프레임. **소개를 top nav로 승격**(header `NAV_LINKS`). 푸터 공개 연락처는 전화 → **이메일 하나**(tkdgns25300@naver.com — 전화는 약관·개인정보 표기에만). ROADMAP에 **문의 접수 폼** 항목 신설(mailto만으론 웹메일 사용자가 막힌다).
>
> ▶ **2026-09-01 클레임(가져오기) 구현**: 크롤 공고가 먼저 있고 교회가 같은 자리를 새로 등록하는 중복(유일하게 안 막혀 있던 방향 — 반대 방향은 크롤러 앵커 §4.2가 막는다)을 **등록 입구에서** 차단. `/jobs/new` 위저드 전 후보 패널 → 가져오면 `church_id`+`source=CHURCH`(원문 링크·게시일 보존) → 수정 화면. 규칙 정본 `claimMatchTier`(이름 정규화 일치/포함 + 지역·교단 배제, 확정은 교회) · 액션이 서버 재판정 + `church_id IS NULL` 경합 방어 · 대시보드 배너/`claimableCount` 제거(입구 한 곳) · 상세 "직접 등록" 배지는 원문 링크 없는 공고로 한정. E2E는 임시 크롤 공고를 심어 전 흐름 확인 후 삭제. ⚠️ **"출근: 협의"(75%)는 알고도 남겼다** — 운영자 결정: 어떤 공고든 같은 형태. 우측 카드·연락처 비링크(2026-08-21 결정)도 그대로.
>
> ▶ **2026-09-05 스페셜 9.9만 → 6.9만**(운영자 결정): 1주 6.9 / 2주 12.9 / 4주 20.9만(기존 할인율·끝자리 관례 유지). 🔴 **근거가 뒤집힌 변경이다** — 2026-09-02에 최상단을 9.9만으로 잡은 이유가 "갓피플 스페셜(8.8만/7일)과 같은 급"이었는데, 우리는 트래픽 실적이 0이라 같은 값을 부를 처지가 아니다. 첫 판매를 막는 것이 값 자체라고 보고 내렸다. 사다리 비율은 3.4:1.7:1 → **2.4:1.7:1**로 좁아졌다 — 간격이 준 만큼 상위 등급의 설득은 **자리 수**(홈 3칸·목록 5줄)가 맡는다. 가격은 `EXPOSURE_PRODUCTS.prices` 단일 소스라 코드는 세 줄뿐이고, 요금 페이지·결제 화면·서버 금액 검증이 함께 따라온다. 함께: `/pricing` 히어로 제목을 **"공고를 더 많은 사역자에게 알리세요"**로("노출"은 우리 쪽 용어다), 홈 히어로는 "사례비·지역·부서" → **"지역·부서·사례비"**(찾는 순서대로).
>
> ▶ **2026-09-05 연관 광고 칸 1 → 3**(운영자 결정): 비슷한 공고 6장 중 **위 3칸**이 광고 자리다(`SIMILAR_AD_SLOTS`). "첫 칸 하나"는 정원 없는 기본 등급이 같은 지역에 넷 이상 몰리면 **각자 페이지의 1/n만 받는 자리**여서, 사는 쪽에서 보면 무엇을 사는지가 확률이 된다. 셋으로 늘리면 여섯 곳이 겹쳐도 각자 절반의 페이지를 받는다. **먼저 산 교회 것이 묽어지는 결정임을 알고 택했다**(SPEC "수요가 넘치면 정원이 아니라 값을 올린다"의 예외 — 정원 없는 등급이라 정원을 올린 게 아니라 자리를 늘렸다). 나누는 방식은 **당번표**: 후보를 id로 세우고 기준 공고 id 해시를 **시작점**으로 연달아 셋(끝을 넘으면 처음으로) — 시작점만 해시라 몫이 고르다(실측 공개 953장 `%6` 16.7% ±2%p). 🔴 **후보를 "페이지 id + 광고 id" 해시로 줄 세우는 안을 실측으로 버렸다** — djb2는 뒷글자가 결과를 좌우해 이어 붙이는 순서에 따라 한 곳이 **99%를 독식**했다(murmur3 avalanche를 덧붙이면 49~52%로 고쳐지지만, 시작점 방식이 이미 고르므로 해시를 더 쓸 이유가 없다). 등급은 이 자리에서 순서를 만들지 않는다(스페셜·기본이 같은 한 표). 정본 = SPEC 수익화·공고 상세 절.
>
> ▶ **2026-09-03 (저녁) 지역·직분·부서 SEO 랜딩 28개**(§7 순서 5) — 노리는 키워드를 받을 URL이 없던 것을 고쳤다. `/jobs/region/[region]`·`/position/[position]`·`/department/[department]`가 각자 H1·title·canonical·breadcrumb를 갖고 프리렌더된다. **조합은 안 만들었다**(지역×직분 79조합 중 24개가 5건 미만 · 부서까지 231조합 중 166개 — 얇은 페이지는 자산이 아니라 부채다). 담기는 공고는 사역직만, 얇은 축은 `noindex`. 발견 경로는 sitemap + 공고 상세 919장의 "같은 조건 모아보기" + `/jobs` 허브 + 홈 칩. `/jobs`의 canonical 전제는 재검토 결과 유지 — 서버 필터링은 랜딩 안에서만 한다. 규칙 정본 = `lib/job-facets`(순수 · 테스트 19). 정본 = SPEC 랜딩 절 · ROADMAP.
> ▶ **2026-09-03 (오후) 노출 상태를 원장 한 곳으로 · 기간을 시작일부터 7일씩으로**(운영자 결정) — `jobs.featured_tier`·`featured_from`·`featured_until` 세 칸을 **컬럼째 삭제**(마이그레이션 `20260903022405`). 그 칸을 둔 근거("캐시된 쿼리 안에서 `now()`를 못 써 원장을 계산할 수 없다")가 seam의 `todayInSeoul()` 관용구로 사라졌고, 같은 사실이 두 곳에 있어 **"한 공고는 창 하나"** 제약·연장 규칙·동기화 걱정이 딸려 왔다. 지금은 `getActiveExposure`(캐시 · `cacheTag("jobs")`)가 오늘을 덮는 PAID 행을 지도로 만들어 목록·홈·상세·운영자 표에 넘긴다. 함께 바뀐 것: **월~일 고정 폐기**(목요일에 사면 4일에 1주 값이었다) → 시작일은 오늘부터 7일, 기간은 그날부터 주수 × 7일, 정원은 **동시 건수**(하루 단위로 센다 · 홈 3칸과 정확히 맞는다). 결제 화면은 날짜 버튼 7개, 운영자 홈은 7일 × 등급 표. 정본 = DATA §7 · SPEC 수익화·마이페이지 절.
> ▶ **2026-09-03 노출 3등급 구현 + 결제 마무리(§7 순서 3·4)**: 묶음 1(자리·라벨·상품표·비슷한 공고 규칙·요금 페이지 — dev·prod 배포)은 리뷰 후 커밋, 묶음 2·3(결제 완료 Server Action `completePromotion` · 정원·시작 주 결제 화면 · 모바일 복귀 · 대시보드 노출 상태 · 운영자 노출 카드·원장 표 · `jobs.featured_from` 컬럼)은 **dev에만** — `featured_from` 마이그레이션 적용·타입 재생성·실결제 1건 확인 뒤 prod로. 환불 정책 확정(게재 전 전액 / 게재 후 없음). 리뷰에서 잡은 것: admin 미리보기 `JobCard`가 provider 없는 저장 버튼으로 죽는 회귀(→ `preview` prop), 목록 광고 로우 등급별 상한 누락, 연관 첫 칸이 자리 표를 안 보던 것, 결과가 광고뿐일 때 "총 0건" 모순.
> ▶ **2026-09-02 BM·노출 상품 재기획 확정(§7 순서 3)**: 대형사·IT/구독형·성과형·기독 니치 네 갈래를 다시 조사하고(§9 E) 우리 실데이터에 대 봤다 — 지역×직분 91조합 중 71개가 20건 이하라 **"상단 고정"은 네 조합에서만 실체**, 측정 인프라 0이라 **성과형은 후보가 아님**, 대표광고 "구좌 한정"은 카피만 있고 수가 없었다. 확정: **자리 셋**(홈 카드 3칸 · 목록 상단 로우 최대 5줄 · 연관 첫 칸) + **사다리 3등급**(스페셜 9.9만/주·정원 3 → 플러스 4.9만·정원 2 → 기본 2.9만) · 광고는 그 화면의 결과에 원래 들어갈 공고일 때만 맨 위 · 정렬 1차 키 폐기 · 런칭 프로모션 없음 · **비슷한 공고 규칙 교체**(자격 문 → 선호 점수 → 보충 — 실측 전도사 페이지 6장 중 부목사 4장이 오던 것을 잡았다). 정본 = SPEC 수익화·공고 상세 절. **자리·라벨·상품표·비슷한 공고 규칙은 2026-09-03 구현**, 결제 적용·정원 판정은 1-8.
>
> ▶ **2026-08-27 성공 알림을 토스트로 통일**: `sonner` + `<Toaster />` **루트 한 벌**, 규칙은 **성공=토스트 / 실패=인라인**(CLAUDE.md Styling). 15지점 배선. 🔴 그 과정에서 **판정 화면 넷이 토스트를 띄울 수 없는 상태**였음이 드러났다 — 액션 안의 `redirect`가 **던져서** `await action()` 다음 줄이 죽은 코드였다(원래 주석도 그렇게 적고 있었다). `redirect`를 걷어내고 이동을 호출부로 옮겼다. 가장 필요한 자리였다: **반려는 되돌릴 수 없고 증빙을 파기하는데** 큐로 돌아가면 그 줄이 사라진 것만 보였다. 함께: `done` 상태 4개·`catch {}` 삼킴 1개 제거, 어드민 실패 문구 6개를 습니다체로(둘은 한 문장 안에서 섞여 있었다), `role="alert"` 누락 2곳.

> ▶ **2026-08-05 SEO 마감**: `sitemap.xml`·`robots.txt`·canonical·OG(이미지 포함) 완료(§7 6·§8 SEO). **dev에 커밋 완료.** 남은 것 = **Search Console 사이트맵 등록**(실데이터 후 — 등록이 곧 "가짜 공고 색인 요청") · **공고별 OG 이미지**(한글 정적 폰트 선행).

---

## 0. 한 문장 요약

흩어진 교회 **사역자 청빙 공고**(→ **개교회 채용**으로 범위 확장: 사역직+일반직, 2026-07-28)를 모아 구조화·비교로 차별화하는 채용 플랫폼(재공고 추적은 2026-08-07 보류). **페이지 스캐폴드는 확정, 읽기는 실 DB로 전환 완료(2026-08-22), 남은 것은 쓰기.** 완료: 홈·/jobs·/jobs/[id]·/churches/[id]·/about·/pricing·/login·**/mypage(사역자)·/mypage/verify(교회 인증)·/jobs/new(3스텝 위저드)**. **단일 계정 + Supabase Auth Google OAuth 실 로그인 동작**(2026-07-29 — mock 세션·test 계정 폐기), 헤더 우측 = "교회 공고 등록" 상시 링크 + 아바타(마이페이지 직행), 로그아웃(Server Action)·회원탈퇴 안내는 /mypage 계정 영역. **`/mypage/church` 재설계 + `/mypage/church/info` + `/jobs/new` 인증 게이트 + `/terms`·`/privacy` 초안 보강(사업자번호 165-41-01202·푸터 표기·청약철회 조항) 완료(mock).** **✅ `/mypage/church/promote` 노출 결제 flow 구현·실동작 검증(PortOne V2 + KCP, 서버 금액 검증 포함) — 2026-07-20 테스트 결제로 검증했고 2026-08-05부터 실카드 청구다.** **✅ 약관·개인정보처리방침 확정본화(초안 배너 제거·시행일 표기)·실 사업자정보(훈테크·대표 이상훈·전화·주소) 반영·문의 이메일 단일화.** **✅ SEO 마감(2026-08-05)**: sitemap·robots·canonical·OG 이미지. 남은 것: terms/privacy 법률검토 + **교회 멤버십**(admin 4페이지 mock 완료 · 운영자 게이트는 2026-07-29 완료). **✅ Vercel 배포 · Supabase 연결 · 도메인 `www.minjob.co.kr` 연결(SSL) · PortOne 실연동 KCP 채널(`kcp_v2`) 전환 · NHN KCP 가맹 심사 + 카드사 등록 둘 다 통과 → 실카드결제 활성(2026-08-05, PG=KCP 일반결제 단일, 통신판매 면제)** → 다음 = **Phase 1 — 교회 멤버십 배선**(결제 경로의 유일한 블로커) + 데이터 유입(§7). **인증(로그인)만 실배선 완료**(2026-07-29), 나머지 백엔드(Supabase 실사용)·모든 mutation·실 노출 적용은 Phase 1.

> **▶ 방향 전환(2026-07-28, 법률 검토 완료)**: 자매 프로젝트 **min_job_agent 크롤러 도입 확정** — 데이터 수집을 사람 수집에서 **공개 공식 게시판 자동 수집 → AI 구조화 → 검수 큐(`review_data`) → 운영자 승격**으로 전환. 제품 범위도 **개교회 채용(사역직 MINISTRY + 일반직 GENERAL)**으로 확장. 가드레일 #1·#3 재정의. min_job 쪽 싱크(문서·코드·검수 브릿지)는 Phase로 진행(ROADMAP 1-10). 정본 = **`../min_job_agent/docs/`**(CRAWLER_HANDOFF.md는 흡수 후 삭제, 2026-08-05).

---

## 0. 완료도 스냅샷 (2026-07-23 · 인증 축 2026-07-29 · 결제·스키마 축 2026-08-06 · 데이터·크롤러·수익화 축 2026-08-30 갱신)

> **실서비스(배포+실동작+수익화) 기준 ≈ 40%.** 화면 체감은 70%+지만, 안 보이는 심장(백엔드·데이터·실 로그인·실결제·로직 마감)이 가장 덜 됐다. ※ **%는 유동적** — 아래 축별 현황이 실제 지표.

| 축 | 완성 | 남은 것 |
|---|---|---|
| UI/디자인 스캐폴드 | ~90% | (거의 끝 — 전 페이지 확정) |
| 인프라/배포 | ~90% | Vercel·도메인·SSL·Supabase 연결 완료 |
| 수익화/결제 | ~92% | ✅ **KCP 가맹·카드사 심사 둘 다 통과 → 실카드결제 활성(2026-08-05)**. 인증 교회는 결제 화면에 도달한다(2026-08-27 멤버십 배선). ✅ **3등급 자리·상품표 구현(2026-09-03 · prod)** · ✅ **결제 마무리 코드(2026-09-03 · dev)** — 주문 저장·정원 판정·모바일 복귀·운영자 원장 + **원장 단일화**(노출 칸 삭제 · 시작일 방식). 남은 것 = 마이그레이션 적용 → 실결제 1건 확인 → prod(§7 순서 4) |
| 프론트 로직 디테일(1-9) | ~90% | URL동기화·404/error·위저드검증·모바일네비·?next·admin deep-link 완료(2026-07-29). 페이지네이션 완료(2026-08-30 게시판식 5개 묶음). 남은 것 = **화면 전수 점검**(390/1280 · §7 순서 1) · soft 404 |
| 백엔드(Supabase 실사용) | ~75% | Auth·운영자 게이트(2026-07-29) · 마이그레이션 + `types/database.ts`(2026-08-20~21) · **수집 검수 실 DB**(2026-08-22) · **`lib/queries` 읽기 전부 DB + mocks 삭제**(2026-08-22) · **교회 인증 접수·판정**(2026-08-25~26) · **교회의 공고 등록·수정·마감**(2026-08-27) · **교회 정보 저장**(2026-08-27) · **북마크 DB 이전**(2026-08-28) · **클레임(가져오기)**(2026-09-01 — `/jobs/new` 후보 패널 + `claimJob`). 남은 mutation = **노출 결제 주문 저장**(사진 업로드는 2026-08-29 Phase 2로), 그리고 **RLS**(§9 유예 — 공개 전 필수) |
| 데이터(실 공고·구조화) | ~80% | **모집중 953건이 실 DB에 산다**(2026-08-30 · 크롤러가 31개 게시판을 자동 수집·구조화 → 77% 자동 공개, 17% 검수 대기, 2% 자동 거절). 남은 것 = 교회 행(0곳 — 클레임이 만든다) · 표시 규칙으로 흡수한 비정형값(사례비 61% 자유 텍스트 · 서류 1,163가지)은 크롤러 필드가 생기면 갈아탄다 |
| 크롤러 연동(min_job_agent) | ~85% | **검수 브릿지 완료**(`/admin/review` 3화면 · 2026-08-22~) + 운영자 홈에 수집 상태·실패 게시판 링크(2026-08-29). 크롤러가 `jobs`에 직접 공개하고 우리는 `review_data`만 쓴다. 남은 것 = 중복 판정 뒤의 클레임 연결(`published_job_id` FK 없음) · 크롤러 쪽 정규화 필드(사례비·서류)는 요청 예정. 정본 = `../min_job_agent/docs/` |
| SEO | ~80% (기술 마감 O, **유입 설계 X**) | **기술 요소 완료(2026-08-05)**: sitemap·robots·canonical·metadataBase·OG(이미지 포함)·JobPosting. 남은 것 = **지역·직분 랜딩 라우트**(노리는 키워드 `"OO지역 전도사 청빙"`를 받을 URL이 아직 없다 — §7 미해결 3) · 실데이터 후 Search Console 등록 · 공고별 OG 이미지(한글 폰트 선행) · 유입 측정 |
| 법률/행정 | ~50% | 약관 법률검토 전 (사업자등록·통신판매 면제 O) |

> 격차의 정체: **읽기는 실 DB가 됐고(2026-08-22), 남은 심장은 "쓰기"다.** 화면이 다 있어도 저장되는 곳은 수집 검수 판정과 로그인/로그아웃뿐이다.
> **▶ 방향 전환(2026-07-28)**: 크롤러 도입(min_job_agent) + 개교회 채용으로 범위 확장 = **새 대축**. 데이터 수집 방식이 사람→크롤러로 바뀌며 "데이터" 축의 채우기 방식이 달라진다(§6 방향 전환 기록·ROADMAP 1-10).

## 1. 페이지 현황 (핵심)

**범례**: ✅ 완료(검수+커밋) · 🟡 Fable 초안(코드 있음·검수 전) · ⬜ 스캐폴드(미착수)

> ⚠️ **"완료" = 디자인·UI 스캐폴드 + 읽기 배선**이지 쓰기·인터랙션 디테일 완성이 아니다. 폼 제출·hover/토글·상태 분기·빈 상태·모바일 등 mock에서도 동작해야 할 구멍이 페이지마다 남아 있다 — **전 페이지 로직 디테일 마감은 별도 갈래(ROADMAP 1-9)**. (실 DB·Auth 의존분은 Phase 1.)

| 페이지 | 섹션 | 디자인 | 검수 | 커밋 | 데이터 |
|---|:--:|:--:|:--:|---|:--:|
| `/` 홈 | ✅ | ✅ | ✅ | ✅ (이전 세션) | **실 DB** |
| `/jobs` 목록 | ✅ | ✅ | ✅ | ✅ `af391ce`·`0119de9`·`03d2758` | **실 DB**. ⚠️ 서버가 열린 공고 **전부**를 내리고 클라이언트가 거른다 — 3천 건에서 payload를 다시 본다 |
| `/jobs/[id]` 공고 상세 | ✅ | ✅ | ✅ | ✅ `85f53bb` | **실 DB**. 미claim 공고도 열린다(교회 프로필만 빠짐) |
| `/churches/[id]` 교회 상세 | ✅ | ✅ | ✅ | ✅ `e586fe0`·`38e6432`·`e1efa16` | **실 DB**(검수 통과 교회만). ⚠️ `churches` 0행이라 당분간 전부 404 — 교회가 claim해야 생긴다 |
| `/about` 소개 | ✅ | ✅ | ✅ | ✅ `f787c3d` | 정적(+실집계) |
| `/pricing` 노출 안내 | ✅ | ✅ | ✅ | ✅ `e35fcb8`·`59c7aa6`·`a0d4cdd` | 정적(+실집계) |
| `/login` | ✅ | ✅ | ✅ | ✅ `c517faf`·`a79692d` | **Google OAuth 실 로그인**(2026-07-29 — 서버 렌더 폼·`?next=` 복귀·`?error=oauth`) |
| `/mypage` 사역자 view | ✅ | ✅ | ✅ | ✅ `8ded8d3`·`84d6b36`+ | **재구성(2026-08-28)** — 교회 카드는 인증·신청중이면 맨 위, 구직자엔 아래 · 저장·최근 두 목록이 같은 행(서버 카드에서 id로 해석 → 지운 공고 자동 제외 · 최근 5개) · 관심 교회 "준비 중" 섹션 삭제 · 회원탈퇴 한 줄. **북마크는 DB**(2026-08-28 — 이 사람 것만 SSR), 최근본만 localStorage(카드는 액션으로) |
| `/mypage/verify` 교회 인증 | ✅ | ✅ | ✅ | ✅ `8ded8d3`+ | **접수 실 배선(2026-08-25)** — 고유번호 확인 단계로 처음/기존을 가르고, `churches` 6칸 + `users.verification_*`에 저장. 상태 3갈래(폼 / PENDING 안내 / REJECTED 사유+폼), APPROVED는 `/mypage/church`로 redirect. **판정도 화면에서(2026-08-26 · `/admin/verify/[id]`)** · 결과 알림 메일 미구현(주 5건 초과 시) |
| `/jobs/new` 공고 등록 | ✅ | ✅ | ✅ | ✅ `c2bcb0b`+ | **실 저장(2026-08-27)** — 3스텝 위저드 + 인증 게이트 + **미리보기**(공개 컴포넌트를 iframe에 그대로). `jobs` 한 표만 쓰고 교회 값은 인증된 `churches`에서 복사, `church_id`는 세션에서. 검수 없이 바로 `OPEN` |
| `/jobs/[id]/edit` 수정 | ✅ | ✅ | ✅ | ✅ `c2bcb0b`+ | **실 저장(2026-08-27)** — 위저드 공유. 게이트 = 자기 교회 + `source=CHURCH`(미claim 크롤 공고는 못 고친다). `posted_at`을 다시 찍지 않는다(수정으로 목록 순위를 살 수 없다) + 하단 **상태 관리**(마감 ↔ 다시 모집, 삭제 없음) |
| `/mypage/church` 교회 관리 | ✅ | ✅ | ✅ | ✅ `e89bebd`+ | **읽기 실 DB**(managed/claimable 분리) — 탭·노출광고 사이드바·공고 행. 행 액션은 **`수정` 하나**(2026-08-27 — 아무 동작도 안 하던 `⋯`의 마감·삭제·재등록을 걷어냈다. 상태 변경은 수정 화면 하단 상태 관리가 한다). ⬜ 클레임("가져와 관리하기")은 여전히 비활성 |
| `/mypage/church/info` 교회 정보 | ✅ | ✅ | ✅ | ✅ `e89bebd`+ | **실 저장(2026-08-27)** — `churches` 6칸 + `church_links` 행 + `updateTag("churches")`. 지역·시·군·구 필수, 채널은 `http`/`https`만(`javascript:` 차단), 비우면 행 삭제. 저장 후 화면에 머물며 **토스트**로 알린다. 사진 구획은 2026-08-29에 걷어냈다(Phase 2) |
| `/mypage/church/promote` 노출 결제 | ✅ | ✅ | ✅ | ✅ `5764fdc` | **PortOne V2 · 실카드 청구**(2026-08-05 활성, 서버 금액 검증). 화면이 실청구·수동 적용·환불 기준을 밝힌다. 주문 저장·실 노출 적용·모바일 redirect 복귀 Phase 1 |
| `/terms`·`/privacy` | 🟡 초안 보강 | — | ✅ | ✅ `150aa99` | 법률검토·`[ ]`실값 대기 |
| `/admin` 셸·홈·`/admin/jobs` | ✅ | ✅ | ✅ | ✅ `bcb9e77`+ | **읽기 실 DB** — 셸(딥그린 사이드바·noindex·**운영자 게이트 적용**: proxy `/admin/**` + `.env ADMIN_EMAILS`, 2026-07-29)·**홈 재설계(2026-08-25)**: 처리할 일(검수·인증 큐)·수집(마지막 실행 · 경보 판정은 크롤러 `minjob-ingest status`)·공개(공개 중·내려감·공개 대기+새로고침). `◐`로 내려가며 페이지 게이트 확보·공고 관리(탭[전체·게재중·내려감·마감]·필터[교단·지역·노출]·테이블·행 액션[수정·마감/다시 모집]). ⚠️ **공고 전수 검수 철회(2026-08-21)** — 검수중 탭을 만들지 않는다. **2026-08-24 쓰기 배선**: `/admin/jobs/[id]` 편집(33칸 · `◐`) + 마감·다시 모집. 삭제·노출 설정·재등록·출처 필터는 걷어냈다(크롤러가 되살림·결제 미배선·값 하나뿐) |
| `/admin/verify` 교회 인증 검수 | ✅ | ✅ | ✅ | ✅ `a4599c9` | **읽기 실 DB**(`users` ⋈ `churches` 조인 — 전용 테이블 없음) — **유일 검수 게이트**. 탭[검수중·완료·반려·전체]·필터·테이블·승인/반려 Sheet(서류확인+반려사유). **dynamic**(운영자+PII라 `'use cache'` 금지 — `<Suspense>` 안 `requireOperator()`가 쿠키를 읽어 dynamic). 정렬=대기 우선. 승인/반려 mutation·알림 Phase 1 |
| `/admin/review` 수집 검수 | ✅ | ✅ | ✅ | ✅ `1f88ae9` | **실 DB 직결 — mock이 아닌 첫 화면.** 화면 3개(큐 목록 · `[id]` 단건 · `[id]/group` 묶음) 전부 `◐`. 큐 조건은 `review_status='PENDING'` 하나, "확인할 것"·승격 게이트는 저장값에서 계산(`lib/review-flags`), 편집 짝 규칙은 `lib/review-edits`, 판정은 `admin/review/actions.ts`(승인·거절·되돌리기 셋 — "저장만"은 2026-08-23에 없앴다). `jobs`·`source_data`에 쓰지 않는다 — 공개는 크롤러 다음 실행. **2026-08-23 재설계**: 읽기 우선 값 목록 + 원문 형태별 열 너비 + 첨부 레인 + 공개 미리보기 탭, 구획·라벨은 공개 상세와 동일, 확인 체크는 값 단위(`value-rows.ts`), 판정은 3단계 색, "저장만" 없음(판정은 승인·거절 둘), 게시판은 `키 · 이름`(`SOURCE_BOARDS`), 원문 열은 제목·포스터(이미지/PDF)·본문(`raw_text` + `raw_meta` 공고 내용 14칸 한 덩어리)·첨부 |
| ~~`/admin/ingest` 공고 수집~~ | ⛔ | — | — | **삭제됨(2026-08-22)** | `/admin/review`로 대체. 붙여넣기 UI + `lib/ingest/structure.ts` + 죽은 `getChurchOptions`까지 지웠다 |

> **완료(mock) 14개** = 홈·/jobs·/jobs/[id]·/churches/[id]·/about·/pricing·/login·/mypage(사역자)·/mypage/verify·/jobs/new·/jobs/[id]/edit·**/mypage/church·/mypage/church/info·/mypage/church/promote**. **단일 계정 + Google OAuth 실 로그인**(§5 인증). **`/mypage/church/promote`는 PortOne 실결제까지 동작**(데이터·실 노출 적용만 Phase 1). **남은 것 = SEO(sitemap/robots) + terms/privacy 법률검토·실값. admin 페이지(셸·홈·공고관리·인증검수) mock 구현 완료 + **수집 검수 3화면은 실 DB 직결**.** (약관·개인정보 초안 보강·사업자정보 반영됨.) 실 mutation·백엔드 = Phase 1.
> ⚠️ **교회 기능은 현재 전부 닫혀 있다(2026-07-29)**: 실 로그인 전환 후 `getCurrentUser`가 `churchId`·`churchName`·`churchVerificationStatus`를 **항상 null**로 주므로(교회 테이블 없음) `hasChurchAccess`가 어떤 실 계정에서도 false다 → `/jobs/new`·`/jobs/[id]/edit`·`/mypage/church`·`/mypage/church/info`·`/mypage/church/promote`·`POST /api/payments/complete` 도달 불가. 위 행의 "mock 완료"는 **화면 스캐폴드가 있다**는 뜻이며, 실제로 보려면 교회 멤버십 배선(§7 ①)이 필요하다. 상태 미리보기용 `?preview=none|pending|rejected` 어포던스는 mock 세션과 함께 제거됐다.
> ⚠️ **`/mypage/verify`는 유일하게 도달 가능한 교회 경로**(헤더 "교회 공고 등록"·마이페이지 CTA가 여기로 보낸다). **2026-08-25 접수 실 배선** — "준비 중"·"저장되지 않았어요" 안내와 운영자 메일 샛길을 걷어내고 실제로 받는다: 고유번호 확인 → 처음이면 `churches` 생성 / 기존이면 그 행에 붙임, 증빙 서류는 비공개 버킷(`verification-docs`), 동의는 시행일과 함께 기록. **판정(승인·반려)은 운영자가 DB에서 직접** 하고 결과 알림 메일은 아직 없다. 이메일 인증은 폐기했다(2026-08-18, Google OAuth로 이미 검증된 `users.email`을 쓴다). ⬜ **승인 시 운영자가 셋을 바꾼다** — `users.church_verification_status='APPROVED'` · `churches.verification_status='APPROVED'` · `churches.contact_tel`/`contact_email`에 `users.verification_contact_*` 이관. **앞의 둘이 모두 APPROVED여야 교회 view가 열린다**(`hasChurchAccess`). 공개 교회 조회는 한 시간 캐시라 `/admin`의 **공개 목록 새로고침**을 누르면 즉시 반영된다.
> **드롭됨**: `/churches`(교회 목록 browse), 교회 규모 필드.

---

## 2. Fable(AI)로 한 것

이 프로젝트는 **Fable 모델로 "전체 개괄"을 먼저 깔고, 그 위에서 페이지별로 상세히 다듬는** 방식을 씀. Fable가 한 3가지:

1. **`docs/fable.md`** — 전 페이지(공개·인증·admin) **섹션+디자인 제안서**. 사람 검토용 초안. **SPEC로 흡수 후 삭제됨(2026-07-29)** — 이 파일은 더 이상 없다.
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
- **인증/admin**: 원칙은 "mock 안 만들고 Phase 1 실백엔드"였으나, **디자인 미리보기 위해 Fable가 mock으로 스캐폴드**함(결정 변경). **인증은 2026-07-29에 실 전환 완료**(Supabase Auth Google OAuth) · admin 데이터는 여전히 mock이지만 **접근은 운영자 allowlist(`.env ADMIN_EMAILS`)로 잠김**.
- **커밋**: 페이지 완료 시 그 페이지 파일 + 관련 docs를 함께. dev→prod **ff-only 머지**. (커밋/푸시/머지는 사용자 요청 시에만)

---

## 4. 실행 / 검증

```bash
npm run dev      # http://localhost:3000 (다른 프로젝트가 :3000 점유 시 :3001+)
npm run build    # TS + Cache Components 검증 (핵심 게이트)
npm run lint     # eslint
npx prettier --check <file>   # 포맷
```
⚠️ **로그인 테스트는 `npm run dev`로.** 세션 쿠키가 `secure`(production)라 로컬에서 `next start`를 http로 띄우면 로그인이 끝까지 진행되지 않는다.
**확인 URL(mock)**: `/jobs`(공고 100·필터·정렬·페이지당) · `/jobs/job-010`(유초등부) · `/jobs/job-004`(owned·제출서류 긴 것) · `/jobs/job-054`(CLOSED 배너) · `/churches/ch-saesomang`(지난 공고 목록).

**SEO 확인**(빌드 후 `npx next start`):
```bash
curl -s localhost:3000/robots.txt                       # 차단 목록 + Sitemap 줄
curl -s localhost:3000/sitemap.xml | grep -c '<url>'    # 120 (정적 6 + 모집중 공고 + 교회 35)
curl -s localhost:3000/jobs'?region=SEOUL&page=2' | grep canonical   # → /jobs 로 고정
curl -s localhost:3000/jobs/job-054 | grep -c ld+json   # 0 (마감 공고엔 JobPosting 없음)
curl -s localhost:3000/jobs/job-001 | grep -o 'og:image[:a-z]*'      # url·type·width·height·alt 5개
curl -sI localhost:3000/opengraph-image                 # image/png 1200x630
```
⚠️ **인증 게이트 확인은 `next start`로** — proxy 307은 프로덕션 빌드에서만 정확히 재현된다.

---

## 5. 데이터 (mock 스키마 = 확정 진행 중)

### mock 현황 (`src/mocks/`)
- **churches.json 36개** · **jobs.json 101개**(2026-08-14 날짜 현행화 — 상대 관계 보존한 채 +37일 이동). 분포: **공개 노출 63건**(유료 8 · HERO 3 · 이번 주 새 공고 9) / 마감일 경과 12 · 상시 90일 초과 4 **← 만료 기능 시연용** / CLOSED 22 · OPERATOR·CHURCH 혼합. (⚠️ 이 수치는 2026-08-14 기준 101건 시절이다 — 지금은 **104건**이고 일반직 2·혼합 1·연 사례비 3이 더해졌다. `PENDING`은 상태값 자체가 제거됐다.) **새벽빛교회(ch-saebyeok) = 교회 등록 3 + 운영자 등록 1(job-101, 클레임 데모)**. 전 공고 `jobKind=["MINISTRY"]`.
- **church-verifications.json 7건**(admin/verify 검수용): 검수중 4·인증완료 2·반려 1. 이미 인증된 교회에 담당자가 추가 신청 6 + 신규 교회 신청 1(`ch-lifewater` — 제출 시 `PENDING` 행이 먼저 생기므로 `church.id`는 항상 있다). PII는 **전건 명백한 합성값**(신청자 이메일 @example.com — 담당자 전화는 2026-08-18에 수집 자체를 폐기).
- **인증(2026-07-29 실 전환)**: mock 로그인 계정(`src/lib/mock-auth.ts`)·테스트 계정(`test1@test.com`·`test2@test.com`)·세션 쿠키 `mj_session`은 **전부 삭제**됐다(코드·mock 데이터에 테스트 계정 잔재 0건 — 2026-08-05 확인). 이제 로그인 수단은 **Supabase Auth Google OAuth 단독** — 이메일/비밀번호 로그인도 없다. 세션 = Supabase 쿠키(`httpOnly` + 배포 시 `secure` + `sameSite=lax`, `lib/supabase/cookie-options.ts`). 카카오는 **오픈 전 추가**, 네이버는 Supabase 기본 미지원이라 보류. ⚠️ 로컬에서 `next start`를 http로 띄우면 `secure` 때문에 로그인이 끝까지 진행되지 않는다 — 로그인 테스트는 `npm run dev`로.

### enum (`src/constants/domain.ts`)
DENOMINATIONS(**10키 — KIJANG 제거·기장=ETC·HAPSIN 유지, 2026-07-29**) · **JOB_KINDS**(사역직 MINISTRY·일반직 GENERAL) · REGIONS(18) · POSITIONS(담임목사·부목사·전도사·강도사·기타) · DEPARTMENTS · EMPLOYMENT_TYPES · **QUALIFICATIONS**(ANY·ENTRY·EXPERIENCED·ORDAINED·SEMINARIAN) · **JOB_STATUSES**(OPEN·CLOSED — ⚠️ `PENDING` 제거 2026-08-21) · FEATURED_TIERS · **EXPOSURE_PRODUCTS**(PREMIUM·HERO — weekly·bundle4 가격)·**EXPOSURE_WEEKS**(1·2·4)·**exposurePrice()**(결제 금액 단일 소스, client+server 공용) · JOB_SOURCES · CHURCH_CHANNELS(6·ETC) · **CHURCH_VERIFICATION_STATUSES**(PENDING·APPROVED·REJECTED) · HOUSING_OPTIONS · APPLY_METHODS(닫힌 4키 EMAIL·LINK·TEL·POST — ETC 없음) · **PAY_NOTE_PRESETS**(구 STIPEND_NOTE_PRESETS) · QUALIFICATION_PRESETS · REQUIRED_DOC_PRESETS

### 스키마 확정 (2026-08-04~05) — **문서만 반영, 코드는 아직 옛 스키마**

정본 = `DATA.md` §3. 여기는 요약이다.

**테이블 7개**: `churches` · `church_links` · `church_photos` · `jobs` · **`job_promotions`(신설)** · `users` · `bookmarks`(2026-08-28 실 배선)

**공고가 성립하는 최소 조건 = 필수 5 + CHECK 2** (초안 8개를 크롤러 백업 **3,181건**으로 검증해 줄이고, `posted_at`을 2026-08-14에 되돌렸다)

```
필수 5    church_name · title · job_kind · description · posted_at   ← church_id 아님(2026-08-06) · posted_at 복귀(2026-08-14)
CHECK ①   직분 XOR 직무   (MINISTRY→position 필수·role NULL / GENERAL→반대)
CHECK ②   연락처 4컬럼 중 ≥1   ⚠️ source_url은 세지 않는다
해제 3    churches.denomination · churches.region · **jobs.church_id**   (~~posted_at~~ 은 2026-08-14 필수 복귀)
시스템 4  status · source · featured_tier · pay_period  (전부 DEFAULT)
```

- **`description` NOT NULL이 빈 공고를 막는 유일한 장치** — 본문·이미지·첨부가 전무한 공고 실측 CSU 53 + YTUS 1건.
- **CHECK ②에서 `source_url`을 뺀 이유**: 세면 크롤링 공고는 항상 통과해 **제약이 장식**이 된다. 빼면 크롤링은 연락처를 채우게 되고(품질↑), 교회 등록은 `source_url`이 NULL이라 자동으로 연락처 필수.
  - 연락 수단 0종 160건(5%)의 정체 = 포스터 이미지에 연락처 79건(구조화가 읽으면 채워짐) + **"청빙 완료되었습니다" 인사글**(크롤러 게이트1 탈락, 승격 후보 아님) + 완전히 빈 공고 3건. **실제로 막히는 건 극소수.**
- **해제 3개의 실측 근거**: 교단 명시 **2.8%**(CSU만 `order_name`으로 83%, 교회 1,004곳 수동은 비현실) · 광역 **81%** · 게시일 없는 공고 **60건**(PCKWORLD — 게시판이 날짜를 안 줌. `fetched_at` 대체는 틀린 날짜 공개라 금지).
- **교단 `NULL` ≠ `ETC`** — `ETC`는 "소속은 있고 우리 9키에 없는 교단"(기장). 미상을 섞으면 필터·거점 판정이 오염된다.
- ⚠️ **검수 우선순위는 교단보다 지역** — 지역이 비면 지역 필터에서 무조건 탈락해 **사실상 안 보이는 공고**가 된다. 교단은 "미상"으로 공개해도 지원에 지장 없음.
- ⚠️ **`church_id` 자동 매칭 금지** — 실측에 **동명이교회**가 있다(선민교회: HAPDONG ×3 · GAMLI ×1 = 서로 다른 교회 둘). 이름으로 자동 연결하면 **남의 교회 페이지에 남의 공고가 뜬다**(차별점 붕괴). `matched_church_id`는 후보 제시만, 확정은 운영자.
- ⚠️ **`posted_at` nullable의 대가 3가지**: JobPosting JSON-LD 생략(`datePosted`는 Google 필수 필드라 NULL이면 invalid) · 정렬 `posted_at ?? created_at` 폴백 · `Job.postedAt` 타입 null 처리 10곳+. **대안(`NOT NULL` 유지 + 60건 수동 ≈20분)이 더 싸다는 검토 의견은 DATA.md에 남겨뒀다** — 되돌리려면 한 줄.

**교회 식별은 claim으로 미룬다(2026-08-06 — `church_id NOT NULL`을 뒤집었다).** 크롤러가 교회 묶기를 실측하니 자동 95%까지만 되고 사각지대가 남았다 — (교회명+광역) 1,203그룹 중 **검증 불가 67개** · **같은 연락처에 다른 교회명 83건**(`대구대동교회`/`대동교회` 표기 차이 + 교단 사무실 공유). 사람이 봐도 판정이 안 된다. 다른 교회를 합치면 이미 공개된 뒤라 되돌리기 어렵고, 안 합치면 나중에 병합할 수 있다 → **교회 행을 아예 만들지 않는다.**
- 스키마 3개: `jobs.church_id` **NOT NULL 해제** · **`jobs.church_name` 추가**(NOT NULL, 공고가 말한 그대로) · **`jobs.region` 추가**
- 교회가 가입·인증 후 **claim** → `church_id` 채워짐 → 교회 상세 켜짐. **claim이 교회 가입 유인이 된다**(mock `job-101` 클레임 데모와 같은 개념)
- ⚠️ `jobs.region`은 §1 **비정규화 금지의 명시적 예외**(`featured_tier`와 같은 취급) — `church_id`가 NULL이면 JOIN이 안 돼 지역 필터가 통째로 죽는다(크롤링 공고 80%)
- **대가 3개 (화면으로 말하면)**:
  1. **재공고 추적 — 기능을 제거했다**(2026-08-07). 아래 참조
  2. **교회 이름이 링크가 아니라 텍스트** — `/churches/[id]`가 없으니 "점촌제일교회"가 그냥 글자로 뜬다. claim하면 링크가 생긴다
  3. **교단 필터에 안 걸린다** — 교단은 `churches`에 있는데 그 행이 없다. **지역 필터는 걸린다**(그래서 `jobs.region`을 받았다). 교단은 원문 명시가 2.8%뿐이라 실질 손실은 작다

##### 재공고 추적은 제거됐다(2026-08-07)

키가 `church_id:직분:부서`였는데 `church_id`가 nullable이 되면서 claim 전 공고가 전부 `null:직분:부서`로 합쳐져 **무관한 교회의 공고가 합산된 거짓 숫자**가 나온다. 그래서 기능을 통째로 뺐다(§7 결정 완료 · DATA.md §6). 끌어올림 판정은 크롤러 + admin 검수 확인으로 넘어갔다.

**`job_promotions`(신설) = 결제 원장**: `UNIQUE(payment_id)`로 멱등(재시도돼도 노출 2번 적립 X) · `tier` CHECK는 `PREMIUM`/`HERO`만(`NONE`은 상품이 아님). `jobs.featured_tier`·`featured_until`은 **캐시 컬럼으로 유지** — 정렬 1차 키라 최다 조회 경로이고, `'use cache'` 안의 `new Date()`는 엔트리 생성 시 고정된다. 만료는 **seam(`lib/queries/*`)이 `todayInSeoul()`을 만들어 넘긴다** — 호출부가 전부 프리렌더라 거기서 만들면 빌드 시각이 굳는다. `cacheLife("days")`로 하루마다 갱신(최대 하루 지연, Cron 불필요). **`deadline` 지난 공고가 "모집중"으로 뜨는 문제(§7 미해결 1번)와 같은 해법** → 한 번에 정리.

**폐기된 것**: `contact text`(단일) · `apply_methods jsonb` — 같은 것을 두 형태로 저장하는 설계였다. 연락처는 **`jobs`의 4컬럼**(`contact_email`·`tel`·`link`·`post`). 테이블로 안 쪼갠 이유 = `APPLY_METHODS`가 `ETC` 없는 **닫힌 4키**라 컬럼이 1:1(폼의 `Partial<Record<ApplyMethod,string>>`와 정확히 대응, JOIN 0). 1칼럼 text로도 안 되는 이유 = 실측 **75.4%가 2종 이상**이라 뭉개지고 `mailto:`/`tel:` 링크를 못 만든다(모바일 UX).

**개명**: `stipend_*` → **`pay_*`** (일반직 GENERAL은 사례비가 아니라 근로계약 급여라 `stipend`가 절반만 맞았다). 한글 라벨은 `job_kind`로 분기(MINISTRY="사례비" / GENERAL="급여"). `STIPEND_NOTE_PRESETS`→`PAY_NOTE_PRESETS`, `formatStipend`→`formatPay`, 정렬 키 `"stipend"`→`"pay"`.

**교단은 native PG ENUM이 아니라 `text + CHECK`** — native ENUM은 값 삭제·순서 변경이 불가능한데 교단 목록은 아직 유동적이다(기장을 ETC에 넣어둔 상태). `constants/domain.ts`가 이미 단일 소스라 native ENUM의 실익이 없다.

### 타입 (`src/types/domain.ts`) — ⚠️ **위 스키마와 어긋남 있음** (목록·개수 = ROADMAP Phase 0)
- `Job`에 **`qualification?`(자격/경력)** · **`housingProvided?`(사택)**. (`ownerId`는 2026-08-07 제거)
- `CurrentUser` = `{id, email, name|null, churchId|null, churchName|null, churchVerificationStatus|null}` — **배타적 role 없음**(단일 계정). 권한 파생 `hasChurchAccess` = `lib/auth.ts`. `FilterDim`에 `qualification`.
- `PastJob` = `{ id, position, department, postedAt, deadline }` — 교회 상세의 '지난 공고' 평면 목록(2026-08-07, 구 `RoleHistory` 대체).
- `Church`에 **`photos?: string[]`**(첫 장=커버; DATA `church_photos` 1:N 테이블). 기존 `photoUrl` 폐기. → ⛔ 2026-08-29 필드 제거(Phase 2로 미루며 코드에서 뺐다).

### seam (`src/lib/queries/*.ts`, `'use cache'`+`cacheTag`+`cacheLife("days")`)
- `jobs.ts`: **getHomeFeed**(추천 3칸 + 최신 목록 — 2026-09-03, 옛 getAdJobs·getListJobs 대체)·getAllJobCards(**모집중만** — sitemap도 이걸 쓴다)·**getAdminJobs**(운영자 전체 공고)·**getAdminOverview**(운영자 홈 요약)·getJobStats·**getCoverageStats**(/about·/pricing 집계)·getJobDetail·getRepost·getSimilarJobs(`PlacedJob[]` — 규칙은 `lib/similar-jobs.ts`)·getChurchOpenJobs·getSearchSuggestions
- `churches.ts`: getChurch·getChurchTimeline·getIndexableChurchIds(sitemap 전용 — 공개 상세가 열리는 교회만). ⛔ `getChurchOptions`는 **삭제**(2026-08-22 — 유일 소비자가 `/admin/ingest`였다)
- `verifications.ts`: getVerifications(교회 인증 신청 목록 — **PII라 `'use cache'` 없음**, `/admin/verify` 전용)
- `review.ts`(**실 DB 직결**, 2026-08-22): getReviewQueue·getReviewDone(둘 다 100건 상한)·getPendingCount·getReviewDoneCount·getReviewedTodayCount·getReviewDetail·getReviewRow·getQueueNavigation·getReviewGroup. **`'use cache'` 없음**(판정하는 순간 바뀐다) · **컬럼명 snake_case 유지**(크롤러 소유 테이블을 직접 편집하는 도구라 명세와 1:1로 대조해야 한다) · 포스터 signed URL만 `service.ts`(비공개 버킷에 storage 정책이 없다)
- `users.ts`(**인증은 실배선**): getCurrentUser(**Supabase Auth `getUser`** + `React.cache`로 요청당 1회 · 실패는 미로그인으로 강등)·getChurchDashboard(church_id 기준, mock)·getEditableJob(mock). (`getOwnedJobs` 폐기, `'use cache'` 없음 — 인증 의존) ⚠️ getCurrentUser는 `churchId`·`churchName`·`churchVerificationStatus`를 **항상 null**로 준다(교회 테이블 도입 후 join) → 교회 기능 전부 닫힘.

---

## 6. 이번 세션 확정 설계 (되돌리지 말 것)

- **▶ 스키마 6개 결정(2026-08-05, 실데이터 검증 완료 — 되돌리지 말 것)**: ① `position`/`role` **분리 유지 + XOR CHECK**(합치면 한 칼럼이 "통제 enum + 자유텍스트" 두 값 공간을 가져 TS 타입이 `string`으로 무너진다) ② `stipend_*` → **`pay_*` 개명** ③ 연락처 = **`jobs`의 4컬럼**(테이블도 jsonb도 아님) ④ **`apply_methods`·`contact` 단일 폐기** ⑤ **`job_promotions` 신설** + `featured_*`는 캐시 컬럼 유지(→ **캐시 컬럼만 2026-09-03에 철회** · 원장 단일화) ⑥ **필수 4 + CHECK 2**로 조이고 교단·지역·게시일은 해제(→ **게시일은 2026-08-14에 필수 복귀**, 현재는 필수 5). 근거·수치 = §5 "스키마 확정", 정본 = DATA.md §3.
- **▶ 결제 트랙 종료(2026-08-05)**: NHN KCP **가맹 심사 + 카드사 등록 둘 다 통과 → 실카드결제 활성.** 결제 인프라는 여기서 닫는다. 남은 건 결제가 아니라 **접근**(교회 멤버십)과 **적용**(featured 세팅·주문 저장). `/pricing`의 "온라인 결제는 준비 중 — 지금은 문의로" 카피는 **그대로 둔다** — 게이트 때문에 실제로 아무도 온라인 결제를 못 해서 **아직 사실이다.** 교회 멤버십이 붙는 시점에 4곳(page.tsx 63·159·256행 + CTA)을 함께 전환한다.
- **▶ prod 동결 해제 + fast-forward(2026-08-06)**: 심사 중 걸려 있던 "URL·사업자정보·상품/가격 변경 금지" 제약이 풀려 **prod를 dev로 30커밋 fast-forward**(`4d0d1aa` → `958c060`, merge 커밋 0). 7/29 로그인 실전환·SEO·스키마 개명이 이때 prod에 처음 반영됐다.
- **▶ 방향 전환(2026-07-28) — 크롤러 도입 + 개교회 채용으로 범위 확장 (되돌리지 말 것)**: 2026-07-28 크롤러 도입 확정 + 개교회 채용으로 범위 확장(사역직 MINISTRY + 일반직 GENERAL). 가드레일 #1·#3 재정의(법률 검토 완료). 정본 = **`../min_job_agent/docs/`**(CRAWLER_HANDOFF.md는 흡수 후 삭제, 2026-08-05). min_job 싱크 = **문서/코드/검수 브릿지 Phase로 진행**(ROADMAP 1-10). staging 4테이블은 min_job_agent 소유(min_job은 인지만), init.sql/마이그레이션 보류. denomination 10키·jobs `jobKind`(MINISTRY/GENERAL)·`role`·`contact` = types+mock 반영 완료(Phase 2, 2026-07-29). `position` NULL 허용·일반직 UI·필터는 크롤러 실데이터 시(deferred).
- **/jobs**: 대표광고를 **리스트 안에 통합**(별도 밴드 폐기, 배경 틴트 없이 작은 "광고" 태그, 티어 차이=노출 위치) · **검색 존**(옅은 초록 밴드: H1+설명+"모집 중 N건") · **결과 툴바**(정렬 + **페이지당 20/50/100**) · **자격/경력·사택 필터 추가**(성별·결혼 필터 금지) · 최근 본 공고 정보형 · 교회 CTA 위젯 · 좌필터 스크롤(우레일만 sticky). "총 N건" = 모집 중(HERO 포함).
- **/jobs/[id]**: **단일 흐름 본문(여백형)** + **우측 요약 카드 B**(지원하기 상단 + 사례비·마감·고용) + 비슷한 6개+더보기 + **아이콘 없음** + 지도 placeholder.
- **/churches/[id]**(재설계): 얇은 허브 — 순서 **커버(사진 갤러리·라이트박스) → 채널(brand 색·아이콘) → 청빙 공고(현재 + 지난 공고 접이식) → 위치(지도)**. 공고가 방문 의도라 위로. **아바타 폐기** · **교회 소개 텍스트 미채택**(채널·유튜브로 파악 대체) · 카드 hover=`bg-muted/40`. 사진 = `Church.photos[]`(mock placeholder SVG, 업로드 Phase 1). → ⛔ 2026-08-29 갤러리·필드 제거(Phase 2).
- **지원 모델**: **사이트 내 지원 안 받음** — 원문/교회로 안내. 교회 직접 등록은 나중 `applyMethod` 필드(Phase 1). 사이트 내 지원 중개는 Phase 3.
- **지도**: Phase 1 = 링크/placeholder, Phase 2 = 네이버/카카오 임베드(주소 필드+API 키).
- **헤더/계정(2026-07-13)**: 아바타 = **마이페이지 직행 링크**(드롭다운 폐기). 우측 상시 **"교회 공고 등록"**(로그인 상태로 분기: 비로그인→/login, 미인증→/verify, 인증→/church). 로그아웃·**회원탈퇴**는 `/mypage` 계정 섹션. **2026-07-29 정정**: 로그아웃 = Server Action(`signOut`, `scope:"local"`로 다른 기기 세션 유지) · **회원탈퇴 danger zone 버튼은 제거** — 자동 탈퇴(계정·연관 데이터 삭제)가 미구현이라 "준비 중" 안내 + 운영자 mailto로 대체(로그아웃만 하고 삭제했다고 말하지 않기 위해). footer 위 전 페이지 공통 여백 `mt-16 sm:mt-20`. 골드-틴트 대비 텍스트 토큰 `--gold-ink`.
- **`/jobs/new`·edit 3스텝 위저드(2026-07-13, 조사 기반)**: 상단 진행바 + 스텝 안 왼쪽 섹션 타임라인(스크롤 스파이). **필수 4개**(제목·직분·고용형태·접수 방법)뿐, "＊만 필수" 안내. Step1 모집기본(교회정보·모집내용·자격 프리셋·**함께할 사역자에게**=description) / Step2 처우·서류(사례비+**사택**·**제출서류 필수/선택**·전형절차) / Step3 지원·마감(접수 방법 다중·문의처·마감). 직분/부서 **기타→직접입력**. **성별·연령·결혼 필드 없음**(가드레일). 컴포넌트: `check-list.tsx`·`job-wizard.tsx`.
- **`/mypage/church` 재설계 구현(2026-07-14, mock)**: 기업 대시보드 조사 반영, **지원자·전형(ATS) 전면 제외**(사이트 내 지원 없음). ① **검수중 스탯/탭 제거**(인증 교회 자동 게재; 단 잔여 PENDING은 행에서 검수중 배지+안내, 마감 액션 없음) → ② 스탯바 대신 **탭**[전체·게재중·마감] ③ 헤더 우상단 = 교회 정보 관리 + ＋새 공고 등록 ④ 클레임 = 목록 위 배너(조건부) ⑤ **우측 사이드바 = 노출 광고 전용**(메인 BM, sticky: 프리미엄 주7만·대표광고 주15만 + 상품 보기) ⑥ 공고 행(`MyJobRow`, client)=게재중 수정+⋯(마감·삭제)/마감 재등록+⋯(삭제)/검수중 수정+⋯(삭제). 케밥 Escape·ARIA ⑦ 조회·북마크 지표는 Phase 1. **재청빙 지표는 공개 교회상세로 이관**. (컴포넌트: `church-view.tsx`·`church-job-list.tsx`·`my-job-row.tsx`)
- **`/mypage/church/info` 신규 구현(별도 페이지, mock)**: 기본정보(교회명·교단=수정 문의 / 지역·시군구·**주소**·창립연도 편집) · 한줄+상세 소개 · **대표 공개 연락처**(개인 담당자 X) · 채널 **6종**(홈피·유튜브·인스타·페북·밴드·**기타**) · **교회 사진**(커버·순서, 업로드 Phase 1). APPROVED 전용 게이트. → `/churches/[id]`·공고에 반영. 소개·대표 연락처는 Phase 1 DATA 추가.
- **공용 폼 컨트롤 통일 + admin 전면 재검수(2026-07-21)**: `ui/native-select.tsx`(`NativeSelect`)·`ui/textarea.tsx`(`Textarea`) 추출 → `SELECT_CLASS`/`TEXTAREA_CLASS` 인라인 상수(6×/3×) 제거, admin+authed 폼 **10곳** 적용(Input과 동일 시각문법, drift 원천 제거). admin 4페이지 냉정 재검수 후 일관성 수정(컨트롤 높이·검색 `aria-label`·홈 폭 통일) + **CLAUDE.md admin 캐시표 정정**(admin non-PII read=`'use cache'`, `/admin/verify`만 PII라 dynamic). native `<select>` 잔류 = `/jobs` 정렬·`/pricing` 문의폼(의도적 다른 디자인).

---

## 7. ▶ 다음 작업 (집에서 이어서)

### ▶▶ 지금 바로 다음 (2026-08-30 기준) — 여기부터 읽으면 된다

**상태 한 줄**: 읽기는 전부 실 DB(모집중 953건 · 검수 큐 46건 · 게시판 31개 수집 중), 쓰기는 8개 중 6개 완료(검수 판정 · 공개 공고 저장 · 교회 인증 접수·판정 · 교회의 공고 등록·수정 · 교회 정보 · 북마크). 공개 화면은 8/29~30에 한 차례 다듬었다(카드 사례비 · 상세 정리 · 페이지네이션). **쓰기 8개 전부 코드 완료**(클레임 2026-09-01 · 노출 결제 주문 저장·적용 2026-09-03 — 실결제 확인 대기).

**남은 순서(운영자 합의 2026-08-30)**
1. **화면 전수 점검** — 모바일 390 × PC 1280, 주요 화면 10개, 실데이터 극단값으로 **깨짐·잘림·겹침만** 고친다(글자 크기 인벤토리 포함). 대시보드의 클레임 자리(`claimableCount` · "가져와 관리")는 **건드리지 않는다** — 클레임 자체가 미정이다(아래)
2. ~~소개 페이지(`/about`) 재작성~~ ✅ **완료(2026-08-31)** — 6섹션 재작성 + top nav 승격. **프레임은 운영자 결정대로**: 크롤링·자동수집·AI 단어 없이 "공개된 공고를 저희가 직접 모아 정리 + 원문 링크", 두 경로 중 **직접 등록이 먼저**(지향점), 게시판 실명 목록 없음(b안), 원칙 상자 없음(내용은 FAQ·교회 카드가 맡음). opt-out 안내는 문의 페이지(ROADMAP 문의 항목)로 미뤘고 임시 경로는 FAQ "원문과 다르면" 이메일·푸터다. 구성 정본 = SPEC 소개 절
3. ~~BM·노출 상품 재기획~~ ✅ **확정(2026-09-02)** — 자리 셋 + 사다리 3등급(스페셜·플러스·기본) · 정원 3·2 · 9.9/4.9/2.9만/주 · 비슷한 공고 규칙 교체 · 런칭 프로모션 없음. 정본 = SPEC 수익화 절, 근거 = §9. 자리·상품표는 2026-09-03 구현, 결제 적용은 4에서
4. ~~결제 마무리~~ ✅ **코드 완료(2026-09-03)** — 상품 3등급 전환 · 자리 구현 · 비슷한 공고 규칙 교체(묶음 1 · prod 배포) / 주문 저장 + 정원 판정 · 모바일 복귀 · 운영자 노출 카드·원장 표(묶음 2·3 · **dev만**) · **원장 단일화**(같은 날 오후 — `jobs`의 노출 칸 셋을 지우고 시작일 방식으로). 답한 것 — 광고 중 공고가 마감되면 남은 기간 소진, CANCELLED = 게재 전 전액 취소, REFUNDED = 게재 후 예외 환불. **← 지금 여기: 마이그레이션 적용 · 타입 재생성 · 시드 E2E · 원장 인덱스 정리 · **prod 머지**까지 2026-09-03에 끝났다. 남은 것은 **실결제 1건**(실카드 결제 → 노출 적용 확인 → PortOne 콘솔 환불) 하나뿐이다.**

**✅ 클레임 — 구현 완료(2026-09-01 · 운영자 확정)** — 걱정의 방향은 하나였다: 크롤 공고가 먼저 있고 교회가 인증 후 같은 자리를 **새로 등록**하는 경우(반대 방향 — 교회가 먼저 올리고 크롤러가 나중에 수집 — 은 크롤러 **앵커**(§4.2)가 이미 막는다. "초안끼리만 본다"던 이전 기록은 오독이라 정정). 그래서 클레임 = **등록 입구의 한 단계**로 만들었다: `/jobs/new` 위저드 전에 후보 패널("이미 올라온 우리 교회 공고 N건") → [내 공고로 가져오기] 하면 `church_id`+`source=CHURCH`로 이전(원문 링크·게시일 보존) 후 바로 수정 화면 / [해당 없음]이면 위저드. 규칙 정본 = `claimMatchTier`(lib/job-church). 대시보드 상시 노출·별도 신청 화면·운영자 승인 큐·복구/감사 장치는 **안 만들었다**(운영자 결정 — 인증 게이트가 자격이고, 잘못 가져간 건 운영자가 DB에서 되돌린다).

**베타 공개 전 필수(기능 밖)** — RLS 켜기(DATA §9 유예 · 지금은 쿼리가 스스로 `user_id`를 건다) · 약관·개인정보 법률 검토 + `[상호·대표·주소]` 실값 · 브랜드 이메일 · Search Console 등록 · 지역·직분 랜딩 URL(SEO 유입의 핵심인데 아직 없다).

> 아래 ✅ 항목들은 2026-08-14~21 사이의 이력이다(그때의 "다음"이었던 것). 2026-08-16 기준 상태 줄은 지웠다.

**✅ 교회 인증 스키마 확정 (2026-08-18)** — `churches` +3(`verification_status`·`contact_email`·`contact_tel`) · `users` +8(증빙 Storage 경로 · 담당자 실명·직분 · **신청 사무용 전화·이메일** · 제출/검수일 · 반려사유 — `church_verification_status`는 기존 컬럼) · **CHECK +2**(APPROVED면 church_id 필수 · REJECTED면 사유 필수). **새 테이블 없이** 기존 7개 유지.
- **`churches` 행이 생기는 경로는 둘**(DATA §3): 인증 신청에서 신규 교회로 적어내면 `PENDING`, 운영자 승격은 `APPROVED`로 명시 INSERT. 검수 전 행이 존재하므로 **공개 조회는 `APPROVED`만**이고, 그 조건은 `mocks/index.ts`의 `isPubliclyVisible`이 유일한 관문이다. ⚠️ **DB 전환 후에도 RLS는 이 경로를 못 막는다** — 공개 교회 조회는 cached read라 `service.ts`(secret 키)를 쓰고 그건 RLS를 우회한다. 조건은 쿼리 본문이 직접 걸어야 한다(DATA §9).
- **`hasChurchAccess`는 사람·교회 양쪽을 본다** — 사람만 승인하고 교회가 미검증이면 검수 안 끝난 교회가 공고를 올린다. 호출부 8곳이 전부 `CurrentUser`만 받으므로 `churchIsVerified`를 거기 실었다.
- **안 받기로 한 것**: 등록번호·서류 종류(서류를 열면 보이고 저장하면 보관 부담) · 담당자 개인 전화(**사칭자가 자기 번호를 적고 자기가 받으므로 검증이 성립하지 않는다**) · 교회 소개(표시 화면 없음). 검증의 축은 **사무용 연락처를 공개 게시판 공고·홈페이지와 대조**하는 것.
- **남은 것 = Server Action 2개뿐**(화면·타입·필드는 확정 — 반려 사유도 `CurrentUser.churchRejectionReason`으로 실어 신청자 화면이 운영자가 적은 사유를 그대로 보여준다). SPEC 교회 인증 절 참조.

**✅ 초기 마이그레이션 적용 완료 (2026-08-20~21)** — `supabase/migrations/20260820231650_init.sql`(테이블 7개 + 제약 + 인덱스) + `20260820234934_source_url_not_blank.sql`. **원격 DB에 적용됨** — 크롤러 4테이블까지 합쳐 `public`에 11테이블이 산다. ⬜ RLS(2026-08-21 결정으로 당분간 유예)·Storage 버킷은 다음 마이그레이션 · GRANT는 크롤러 service role이라 쓰지 않는다.
**✅ `types/database.ts` 생성 + 클라이언트 3개에 배선 (2026-08-21)** — Supabase 자동 생성(11테이블·180컬럼). `server.ts`·`service.ts`·`session.ts` 모두 `<Database>`. 붙이자마자 드러난 것 2개: ① **enum 컬럼이 `string`으로 온다** — DB가 `text + CHECK`라 Postgres enum이 없다 → 좁히기는 seam(`lib/queries/*`)의 일이고, 남은 정합 항목의 enum 컬럼마다 같은 일이 필요하다. ② `churches(...)` 조인은 **객체**로 추론된다 — `getCurrentUser`에 있던 `Array.isArray` 방어는 근거 없는 코드였고 삭제했다.
구조(테이블 7개·컬럼·enum·인덱스·RLS)는 이미 확정이고, 실데이터가 바꾸는 건 **제약의 임계값**이다 — `description NOT NULL` 같은 조건이 실제 승격을 얼마나 막는지는 AI 구조화 결과를 봐야 안다. 지금 써두면 그 결과에 따라 어차피 고친다. 신규 DB라 늦게 써도 `ALTER`가 아니라 `CREATE TABLE`이므로 미루는 비용이 거의 없다. **`types/domain.ts` 드리프트도 이 묶음에 딸려 있다**(ROADMAP Phase 0).

**✅ 완료 — 위치 3컬럼 (Step 2, 2026-08-17)**
`jobs.city`·`jobs.address`·`churches.address` 추가. 네이버 지도의 실제 블로커는 비용·난이도가 아니라 **주소 데이터 부재**였다. 지도 검색어 규칙은 **지역+시+상세 주소를 이어 붙이고, 상세 주소가 없으면 교회명을 앞에 붙이고, 아무것도 없으면 섹션 생략**이고(2026-08-26 정정 — 그전엔 `address`를 전체 주소로 보고 그것만 검색해 전국의 동명 도로를 짚었다) `lib/format.ts`의 `naverMapUrl` 하나가 공고 상세·교회 상세를 모두 담당한다 — 전에는 두 파일이 각자 조립하다 한쪽만 고쳐 가드가 빠질 뻔했다. `jobChurchRef`의 `city`도 교회 조인에서 **공고 값**으로 옮겼다(위치 3종이 같은 출처여야 `"부산 고양"` 같은 조합이 안 생긴다). §1 비정규화 예외는 개수가 늘지 않았다 — 예외 ①을 "`jobs`의 위치 3종"으로 넓혔다(이유가 하나라서). 주소는 **상세 주소 한 컬럼**(지역·시 다음 조각 · 도로명/지번 안 나눔)이고 `contact_post`(접수처)와 **다른 값**이다.
남은 것: 지도 **임베드**와 거리 기반 필터는 Phase 2(API 키·좌표).

#### ✅ 완료 (2026-08-14) — 공개 목록 만료 규칙

지금 mock **OPEN 79건 중 55건이 마감일 경과**인데 그대로 "모집중"으로 뜬다. 코드가 `status` 하나만 믿기 때문이고, **실데이터에서 그대로 재현된다**(크롤링 공고 75%가 마감일을 갖는다). sitemap이 만료 URL을 신선한 콘텐츠로 광고하고, `JobPosting` JSON-LD가 과거 `validThrough`를 계속 내보낸다 — **지금 구글에 틀린 정보를 보내고 있다.**

**확정된 규칙**
```
공개 목록에 뜬다 =
    status === 'OPEN'
    AND ( deadline !== null ? deadline >= today
                            : posted_at + 90일 >= today )
```
mock 기준 **79건 → 21건**. 크게 줄지만 나머지 58건은 지금 거짓으로 "모집중"인 것들이다.

| 결정 | 내용 |
|---|---|
| **`status`는 OPEN 유지 · 배치 UPDATE 안 한다** | 크롤링 공고가 실제로 마감됐는지 **우리는 모른다**. 모르는 걸 `CLOSED`로 써버리면 "교회가 닫은 것"과 "우리가 시간으로 판단한 것"이 구별되지 않고 되돌릴 수 없다(§nullable 원칙과 같은 이유). **파생 계산**으로 숨기면 원본이 보존되고 90→120일 변경이 즉시 반영된다. Cron도 불필요 |
| **`today`는 cached scope 안에서 계산**(2026-08-14 정정) | 원래 "페이지가 인자로 넘긴다"였으나 **호출부 3곳(`/jobs`·홈·`sitemap.xml`)이 전부 프리렌더 스코프**라 거기서 `new Date()`를 부르면 빌드 시각이 굳는다. 캐시 안에서 계산하면 `cacheLife("days")`와 함께 하루마다 갱신된다(만료 최대 1일 지연 — 목록 자체가 하루 캐시라 무해). 인자 방식은 `await connection()`이 필요해 두 페이지가 **`◐ PPR` → `ƒ`** 로 떨어진다 |
| **`CLOSED`는 진짜 의사표시만** | 교회가 "마감했습니다"라고 누른 것만 저장(Phase 1 mutation) |
| **`ALWAYS_OPEN_MAX_DAYS = 90`** | 상시모집(마감일 없음)이 방치돼 영구히 "모집중"으로 남는 것을 막는다. mock 상시모집 20건의 게시 경과일은 최소 36·중간 63·최대 113일 — 90일이면 3건이 걸린다. **짧게 잡아 살아있는 공고를 숨기는 게 더 나쁜 오류** |
| **숨김 범위** | 목록·검색·홈·sitemap·JSON-LD에서 **제외**. **공고 상세는 살린다** + "마감" 배너(기존 롱테일 SEO 정책과 일관) · 교회 상세의 "지난 공고"에도 계속 보임 |
| **교회 대시보드는 계속 보임** | 교회 입장에서 "우리 공고가 갑자기 사라졌다"가 되면 안 된다. "게시 90일 경과 — 갱신하면 다시 노출" 안내(갱신 mutation은 Phase 1) |

> 🔴 **`posted_at`을 NOT NULL로 되돌린다**(2026-08-11 — 8/5의 nullable 결정을 뒤집는다). 크롤러도 필수로 하기로 했다. **사라지는 부담 4개**: JobPosting JSON-LD 생략 분기 · 정렬 `?? created_at` 폴백 · `Job.postedAt` 타입 null 처리 10곳+ · 90일 판정의 `created_at` 폴백. **필수 조건이 4개 → 5개**(`church_name`·`title`·`job_kind`·`description`·**`posted_at`**). 대가는 PCKWORLD 60건을 검수에서 날짜 입력하는 것뿐(포스터에 대개 적혀 있다).
> ⚠️ **크롤러 회신 필요** — 8/5에 nullable로 전달했는데 뒤집는 것이라, PCKWORLD 60건 처리 규칙까지 함께 알려야 한다.

> **착수 결과(2026-08-14)**: 판정은 `lib/job-visibility.ts`(`todayInSeoul`·`isPubliclyOpen`·`hiddenReason`) 단일 소스. 목록·검색·홈·sitemap·JSON-LD에서 제외하고 공고 상세는 살렸다. 운영자·교회 화면은 **내려간 이유**를 보여준다(`hiddenReason`). 정본은 **DATA.md §6-1**에 반영 완료.

#### ✅ 결정 완료 (2026-08-07) — 중복/재공고는 지금 안 한다

| 결정 | 내용 |
|---|---|
| **끌어올림(bump)** | **min_job 일이 아니다.** 크롤러(min_job_agent)가 수집 단계에서 묶고, min_job admin 검수 화면에서 **"이거 끌어올리시겠습니까?"** 로 운영자에게 확인받는다. N일 임계값을 우리가 정하지 않는다 |
| **재공고 추적** | **기능 자체를 제거**(보류). `lib/repost-tracking.ts` 삭제 · 공고 상세 배지·이력 섹션 제거 · 교회 상세는 평면 "지난 공고" 목록으로. **이유는 "안 잡힌다"가 아니라 "틀린 값이 나온다"** — 키가 `church_id:직분:부서`인데 `church_id`가 nullable이 되면서 claim 전 공고가 전부 `null:직분:부서` 한 덩어리로 합쳐져 무관한 교회들의 공고가 합산된다 |
| **`owner_id`** | **컬럼 제거.** 유일한 사용처 `getEditableJob`이 이 컬럼으로 편집 권한을 판정하고 있었는데 **그게 가드레일 #2 위반**이었다(담당자는 여럿·교체됨 · 운영자 공고는 작성자가 없어 영영 편집 불가). 권한을 `church_id`(그 교회 인증 관리자) 기준으로 바꾸고 컬럼을 없앴다. `hasChurchAccess`를 타입 술어로 만들어 통과 후 `churchId`가 `string`으로 좁혀진다 |

> **되살릴 때**: claim이 돌아 `church_id`가 채워진 뒤가 자연스럽다. 후보 키 = `church_id + 직분 + 부서`(claim된 것만) 또는 크롤러와 같은 `연락처 + 직분 + 부서`. 마감(CLOSED) 공고 공개 정책은 그대로 유지된다(교회 상세의 지난 공고가 그 위에서 돈다). 근거·조건 = DATA.md §6.

**선택지 3개 — 위 결정 후 착수, 추천 순서**

| | 작업 | 왜 / 막는 것 |
|---|---|---|
| **1️⃣ 추천** | **초기 마이그레이션 적용 + 타입·mock 정합 (한 묶음)** | 마이그레이션 적용·`types/database.ts` 생성은 **완료(2026-08-21)**. 남은 것 = `domain.ts` 정합 → mock JSON 전환 → `lib/queries` 본문 교체. **남은 `types/domain.ts` 드리프트가 여기서 해소**된다(목록·개수는 ROADMAP Phase 0) |
| 2️⃣ | **교회 멤버십 배선** | **매출을 여는 단일 스위치**(결제 인프라는 이미 완성). `getCurrentUser`가 `churchId`·`churchVerificationStatus`를 항상 `null`로 줘서 교회 기능 전체가 닫혀 있다. 단 `users`·`churches` 테이블이 필요하므로 **사실상 1️⃣이 선행** |
| ~~3️⃣~~ | ~~**NULL 표시 UI 2개**(교단·지역 미상)~~ | ✅ **완료(2026-08-16)** — 공개 화면은 조각 생략, 운영자 화면만 "미상" 명시. 표기 단일 소스 = `lib/format.ts`의 `churchMetaLine`·`churchLocation`. 규칙은 SPEC 공고 상세 §미claim 축소 표시 |

> ⚠️ **1️⃣ 착수 전 반드시 알아야 할 것 — `types/domain.ts`가 아직 옛 스키마다.** 남은 곳의 **목록·개수는 ROADMAP Phase 0이 정본**이다(여기 복제해 두었더니 양쪽 숫자가 갈렸다 — 2026-08-21 제거).
> 하나만 여기 적어 둔다: **`description`이 TS에선 nullable인데 DB는 `NOT NULL`이다.** 다른 항목은 화면이 조금 비는 정도지만 이건 **공고 등록 Server Action을 붙이는 순간 런타임 에러**다.

**▶ 배포 확인 — ✅ 완료(2026-08-11)**. prod에서 구글 로그인·`/admin` 접근 실동작 확인. 아래는 그때 정리된 설정 정본이다:
1. **Google Cloud 승인된 리디렉션 URI = Supabase 콜백 하나뿐**(`https://<ref>.supabase.co/auth/v1/callback`). ⚠️ **우리 도메인을 여기 넣지 않는다** — 구글은 Supabase까지만 알면 되고, Supabase가 우리 앱으로 다시 보낸다. (한 번 잘못 안내했던 지점)
   - **Supabase → Authentication → URL Configuration**이 우리 도메인을 아는 곳이다: **Site URL = `https://www.minjob.co.kr`**(경로 없이) · **Redirect URLs = `https://www.minjob.co.kr/auth/callback**` + `http://localhost:3000/auth/callback**`**. `**`는 `?next=` 쿼리까지 허용하는 와일드카드고, **localhost가 없으면 로컬 `npm run dev` 로그인이 안 된다.**
   - ⚠️ **Supabase 무료 플랜은 약 7일 무요청이면 프로젝트를 자동 일시정지**한다. 멈추면 Auth가 죽어 **아무도 로그인할 수 없다**(코드가 fail-closed로 미로그인 강등 → 사이트는 살아 있지만 로그인만 안 됨). 대시보드에서 `Resume project`. **정식 오픈 전 Pro 검토 필요** — 주말 지나고 멈추면 실서비스가 막힌다.돼 있으면 prod 콜백이 실패한다.
2. **Vercel env `ADMIN_EMAILS`** — ✅ `tkdgns25300@gmail.com`(Production·Preview). 없으면 fail-closed라 **본인도 `/admin`에 못 들어간다**. 코드가 기대하는 나머지 3개(`NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`·`SUPABASE_SECRET_KEY`)도 이름 일치 확인.
3. (참고) `test1@test.com`은 이제 로그인이 안 된다. KCP 심사가 끝나 문제는 아니지만 카드사 재확인 요청이 오면 알고 있어야 한다.

**▶ 이번 세션(2026-08-05~06)에 한 일 — 커밋 순서**

| 커밋 | 내용 |
|---|---|
| `0959981` | `jobs` 미확정 7필드 확정 + nullable 원칙(크롤링 3,051건 언급률 실측 근거) |
| `090a173` | `church-verifications.json` vf-005의 `test1@test.com` → 합성값 |
| `889e2ec` | KCP 심사 종료 기록 + prod 동결 해제 |
| `593e73b` | 결제 트랙 종료(가맹·카드사 둘 다 통과 → 실카드결제 활성). README 링크를 `www.minjob.co.kr`로 |
| `1343491` | **`stipend_*` → `pay_*` 개명**(21파일, 코드 변경은 이게 전부) |
| `6d53bd3` | 스키마 6개 결정(XOR CHECK · 연락처 4컬럼 · `apply_methods` 폐기 · `job_promotions` 신설 · 필수값) |
| `5311d6f` | **크롤러 실데이터 3,181건으로 필수값 재검증** → 8개 → 필수 4 + CHECK 2 |
| `958c060` | 코드↔문서 드리프트를 마이그레이션 전제조건으로 기록 |
| `81a7d4b` | 세션 핸드오프를 SNAPSHOT에 기록 + SPEC의 깨진 링크(삭제된 CRAWLER_HANDOFF.md) 수정 |
| `c0aa4ec` | **교회 식별을 claim으로 미룸** — `church_id` NOT NULL 해제 · `church_name`·`region` 추가(크롤러 요청 수용) |

그 외: `docs/CRAWLER_HANDOFF.md` **삭제**(6개 절 전부 CLAUDE.md·DATA.md·ROADMAP·SPEC에 흡수됐음을 하나씩 확인 후).

---

**▶ 바로 다음 (배포 → KCP 심사 착수 순서):**
1. ✅ **Vercel 배포 완료 (2026-07-18)** — **https://min-job.vercel.app/** (mock 데이터·환경변수 0개). 커스텀 도메인 연결은 이후.
2. ✅ **Supabase 연결 완료·검증됨(2026-07-19)** — 클라이언트 배선(`lib/supabase/{server,service,session}.ts`, `@supabase/ssr`+`supabase-js`, 공식 문서 검증) + 키 입력(로컬 `.env` + Vercel env: `NEXT_PUBLIC_SUPABASE_URL`·`_PUBLISHABLE_KEY`·`SUPABASE_SECRET_KEY`) + **임시 ping 라우트로 연결 검증**(PostgREST 도달·인증 OK, `PGRST205`=스키마 비어 있음=정상, 검증 후 라우트 삭제). ⚠️ **연결만** — `lib/queries/*`는 계속 mock(JSON), 실 DB 사용(Auth·조회·마이그레이션)은 Phase 1.
3. ✅ **PortOne 노출 결제 flow 구현·검증(2026-07-20, `5764fdc`)** — `/mypage/church/promote`(인증 게이트) → `promote-checkout.tsx`(client)에서 **PortOne V2 `requestPayment`**(KCP CARD 채널) 결제창 → 성공 시 `POST /api/payments/complete`가 **PortOne API로 실결제 조회 + 금액 서버 재계산(tier·weeks, 클라 불신) + `status===PAID` 대조**. 가격 단일 소스 = `EXPOSURE_PRODUCTS`/`exposurePrice`(constants). **KCP 테스트 결제 성공 확인.** env: `NEXT_PUBLIC_PORTONE_STORE_ID`·`_CHANNEL_KEY`·`PORTONE_API_SECRET`. ⚠️ paymentId 38자(KCP 40자 제한). ⚠️ **모바일 redirect 복귀 미처리** — 데스크톱 팝업(Promise)만 완료 화면·서버검증. 모바일 `?paymentId=` 복귀 처리 = Phase 1. 실 노출 적용(featured_tier·featured_until 세팅)·주문 저장도 Phase 1.
4. ✅ **도메인 연결 + NHN KCP 전자결제 신청 제출(2026-07-20)** — 도메인 `minjob.co.kr` → Vercel(hosting.kr DNS: A `@`→216.198.79.1 + CNAME `www`→Vercel 전용, 대표=`www.minjob.co.kr`, SSL 자동). PortOne 전자결제 신청 **사전점검 6항목 통과**(URL=`https://www.minjob.co.kr`, 전화번호 반영으로 사업자정보 통과) → 가맹 심사 제출 → **✅ 통과·일반결제 계약 활성(2026-08-05)**. **PG 결정: NHN KCP·신용카드 일반결제 단일 채널**(KPN·정기결제·간편결제·본인인증 미사용 — ROADMAP 1-8 PG결정). 실연동 채널 키 교체는 5번에서 완료.
5. ✅ **PG-API·실연동 채널 전환 + 카드사 등록신청 제출(2026-07-21)** — KCP PG-API(개인키+서비스 인증서) 발급 → PortOne **실연동** 채널 "MinJob NHN KCP"(`kcp_v2`·사이트코드 IP94F·PG-API 인증서/개인키) → 채널 키 `channel-key-bc781263-…`를 `_CHANNEL_KEY`(로컬 `.env` + Vercel)에 교체·재배포(STORE_ID·`PORTONE_API_SECRET` 불변). 라이브 결제창 = 실연동. **`partner.kcp.co.kr` 카드사 등록신청 제출 → 심사 3~15일 대기**(승인 시 실카드결제). 문의내용: test1 계정 + 결제창 경로(`/mypage/church/promote`) + 통신판매 면제 사유. ⚠️ 심사 중에는 URL·하단 사업자정보·상품/가격 변경이 금지였다. ✅ **2026-08-05 심사 종료 → 제약·prod 동결 모두 해제**: 7/29 로그인 전환으로 심사용 계정(`test1@test.com`)이 없어지고 교회 인증상태가 항상 null이라 결제창 경로에 도달할 수 없어 prod를 7/29 이전 상태로 동결해 뒀었다. 심사가 끝나 **prod를 dev로 fast-forward**하고 테스트 계정 잔재를 제거했다. **가맹 심사(4번)·카드사 등록(5번) 둘 다 통과 → 실카드결제 활성.** 결제 인프라는 끝났고, 남은 블로커는 교회 멤버십 배선(결제 경로 도달 불가). ROADMAP 1-8·8.
6. ✅ **SEO 마감(2026-08-05)** — 이전 "실데이터 즈음으로 defer" 결정을 **뒤집었다**: sitemap이 `lib/queries` seam에서 URL을 읽으므로 **DB 전환 시 재작업 0**이라, 미리 해두는 게 손해가 없다고 판단.
   - `sitemap.ts`(정적 6 + 모집중 공고 + 교회 = 현재 120 URL) · `robots.ts`(공개 허용 / `/mypage`·`/admin`·`/login`·`/auth`·`/api`·`/jobs/new`·`/jobs/*/edit` 차단) · `metadataBase`(`constants/site.ts`) · **canonical 전 공개 페이지** · OG 공통값 + **OG 이미지**(`app/opengraph-image.tsx` 브랜드 카드).
   - **고친 색인 결함 4개**: ① `/jobs` 필터·정렬·페이지 쿼리 조합이 각각 색인될 수 있던 것 → canonical 고정 ② 마감 공고에도 `JobPosting` 출력 → **모집중일 때만** ③ `/jobs`가 홈과 title 중복 → 검색용 title 부여 ④ openGraph를 재정의한 상세 페이지가 `og:image`·`site_name`을 잃던 것 → `SITE_OPEN_GRAPH` 공유.
   - ⚠️ **Search Console 등록은 실데이터 후.** 코드는 준비됐지만 등록이 곧 "가짜 공고를 색인해달라"는 요청이다.
   - 남은 것: **공고별 OG 이미지**(한글 정적 폰트 ttf/otf 선행 — satori는 woff2 불가 + 번들 500KB 제한) · **지역·직분 랜딩 라우트**(아래 미결 TODO).
   - terms/privacy 법률 검토는 계속 대기. **admin 4페이지** mock 구현 완료(2026-07-21) — 실 등록·검수 처리·구조화 API는 Phase 1.
7. **Phase 1 (본체) — mock→실 DB = 독립 2트랙**(2026-07-29 정리, ROADMAP Phase 1 노트):
   - **① 인증(로그인) — ✅ 완료(2026-07-29)**: Supabase Auth **Google OAuth 단독** + `auth/callback` route(PKCE code→세션) + `getCurrentUser` 실배선 + `proxy.ts`(세션 refresh + 1차 차단) + 페이지 `requireUser` + mock-auth·이메일·test 계정 제거. 카카오는 **오픈 전 추가**(provider 켜고 버튼 하나), 네이버 보류. ⚠️ **`users` 테이블은 "로그인용으로만" 불필요했다** — 로그인·세션·이름/이메일은 `auth.users`가 준다(그래서 테이블 0개로 로그인이 돈다). **프로필 테이블 자체는 여전히 필요**하다(`church_id`·`church_verification_status` 둘 곳이 없어 교회 기능이 닫혀 있음, DATA §3 유효).
     - **admin 운영자 게이트 ✅ 완료(2026-07-29)**: `.env` `ADMIN_EMAILS` allowlist — proxy가 익명 307 + 운영자 아니면 `/`로, `/admin/verify`는 페이지에서도 `requireOperator()` 재확인. 목록 비면 아무도 접근 못 함(fail-closed). ⚠️ Vercel env 등록 필요.
     - **남은 인증 작업 1개**: **교회 멤버십** — `getCurrentUser`가 churchId·인증상태를 항상 null로 주어 교회 기능 전체가 닫혀 있다(②트랙에서 교회 테이블과 함께).
   - **② 데이터(공고·교회) — 크롤러 검수브릿지 준비 후**: ⚠️ 핵심은 seam 전환(쉬움)이 아니라 **데이터 유입**(크롤러 승격/교회 등록 mutation/seed). DB 비면 read 전환해도 빈 화면. read+write 도메인별 함께. `lib/queries` mock→DB · mutation `actions.ts` · 계정 북마크 · `/jobs/[id]/edit` 권한=교회 인증 멤버십 · **노출 결제 마무리**(주문 저장=`job_promotions` INSERT · 실 노출 적용 · 모바일 redirect 복귀 — KCP 심사·실카드결제는 2026-08-05 완료). ✅ **DATA 스키마 정합은 확정 완료**(2026-08-04~05 — 폼 7필드 전부 컬럼 확보 + 스키마 6개 결정. ROADMAP Phase 0 참조).
> ✅ **완료(2026-07-14)**: `/mypage/church` 재설계 + `/mypage/church/info` + `/jobs/new` 인증 게이트 + `/terms`·`/privacy` 초안 보강(사업자번호 165-41-01202·푸터).
> **결정(2026-07-14)**: 배포 먼저(mock) → Supabase는 "연결만"(데이터 mock 유지) → ~~SEO는 나중~~. Supabase/배포는 서로 독립이라 DB 먼저 할 필요 없음.
> └ **2026-08-05 정정**: "SEO는 나중"은 **뒤집혔다** — sitemap이 seam에서 URL을 읽어 DB 전환 시 재작업이 0이므로 미리 해도 손해가 없다. 단 **Search Console 등록만** 실데이터 후로 미룬다(§7 6).
> **온보딩 결정(2026-07-12)**: 가입 시 프로필 모달 없음 — 이름=SNS 닉네임/이메일 가입폼, 직분은 안 받음(인재 프로필 Phase 3), 담당자 정보=교회 인증 폼에서. 구직자 관심교회·알림 = Phase 2.
> **시안 위치**: 이번 세션 확정 시안은 `docs/mockups/`에 커밋됨(스크래치패드는 기기 간 동기화 안 됨). 그 외 과거 시안은 로컬 scratchpad에만 존재.

**미결 TODO**(코드에 표시): 필터↔URL 동기화 시점 · 부서 세분화(ROADMAP 1-7) · 아이콘 제거 범위(홈·목록의 지역핀·검색 돋보기도 뺄지).
> ~~CLOSED 공고 JSON-LD 제거 여부~~ → **결정(2026-08-05): 제거.** 구글이 마감 공고의 구조화 데이터 제거를 권장하고, `validThrough`만 믿으면 "마감일 없이 조기 마감"·"마감일 미래인데 마감" 공고가 모집중으로 노출된다. `status === "OPEN"`일 때만 출력.

**▶ SEO 검수에서 나온 미해결 3건 (2026-08-05 — 실데이터 전에 처리)**
1. **만료된 `OPEN` 공고** — mock 79건 중 **52건이 마감일 경과인데 status=OPEN**. 코드가 `status` 하나만 믿으므로 실데이터에서 그대로 재현된다 → `validThrough`가 과거인 `JobPosting`을 계속 내보내고 sitemap이 만료 URL을 신선한 콘텐츠로 광고하며 `/jobs`의 "지금 모집 중 N건"도 틀린다. 해법은 페이지가 아니라 **데이터 계층**(만료 OPEN→CLOSED 전환 배치) — cached scope에선 `new Date()`를 쓸 수 없다.
2. **soft 404** — 없는 공고·교회(`/jobs/nope`)가 **HTTP 200**을 준다. PPR 셸이 먼저 나가고 `notFound()`가 `<Suspense>` 안에서 호출되기 때문(proxy 리다이렉트와 같은 제약). 지금은 Next가 `noindex`를 자동 주입해 색인은 막히지만, **DB 전환 후 삭제된 공고가 404/410 대신 200을 주면** Search Console에 soft 404가 쌓인다. 고치려면 PPR 셸 결정을 되돌려야 하므로 **일단 기록**.
3. **지역·직분 랜딩 라우트 부재** — CLAUDE.md가 노리는 키워드는 `"OO지역 전도사 청빙"`인데 **그 키워드를 받을 URL이 없다**(`/jobs?region=SEOUL`은 canonical로 `/jobs`에 흡수). 쿼리 파라미터로 facet SEO를 하려 하지 말고 **전용 라우트**(`/jobs/region/seoul` 등, 자체 H1·title·canonical)를 만드는 것이 정답. "SEO 90%"는 이 부재를 감춘 수치다.
> 그 외 저비용 보강 후보: 공고 상세 `BreadcrumbList` JSON-LD · root `Organization` JSON-LD(`constants/business.ts`에 재료 이미 있음) · `JobPosting.identifier`.

---

## 8. 스택 · 아키텍처 (요약 — 상세는 CLAUDE.md)

- **Next.js 16.2.9**(App Router, `cacheComponents:true`) · **React 19** · **TS strict** · **Tailwind v4** · **shadcn/ui(Base UI)** · **Pretendard** · **Supabase = Auth만 실사용**(2026-07-29 · 데이터는 계속 mock, DB 전환은 Phase 1).
- 색 = **딥그린+골드**(`globals.css` 토큰). 아이콘 = lucide(최소 사용).
- 레이어: `page.tsx`=조합 / `*-view.tsx`=프레젠테이션(기본 서버) / `lib/queries/*`=데이터 seam(mock↔DB 본문만 교체) / `components/**`=재사용 UI.
- 캐시(빌드 출력, 2026-07-29 측정): 홈·/jobs·/jobs/[id]·/churches/[id]·/about·/pricing·/terms·/privacy = **`◐ PPR`**(이전 `○ Static`에서 바뀜 — 헤더 계정 영역이 세션을 읽는 dynamic hole이라 셸은 계속 prerender되지만 문서 응답은 `no-store`) · `/login`·인증(/mypage·/mypage/church·/jobs/new·edit) = `◐` · **`/admin/jobs`는 `○ Static` 유지**(admin 셸에 공개 헤더가 없음). **`/admin`(홈)은 2026-08-25 재설계로 `◐`**(검수·인증 큐와 `crawl_run`이 캐시 불가). **`/admin/review`·`/admin/review/[id]`·`/admin/review/[id]/group` = `◐`**(미검수 데이터 + `requireOperator`, 2026-08-22 측정) · 삭제된 `/admin/ingest`는 `○ Static`이었다. ⚠️ admin 셸의 `usePathname`은 **동적 세그먼트에서 프리렌더할 수 없어** `<Suspense fallback={<AdminSidebarFallback/>}>`로 감쌌다(스켈레톤이 아니라 강조 표시만 없는 같은 사이드바) — 이 경계가 없으면 `/admin/review/[id]` 빌드가 막힌다. 경계를 넣어도 `/admin/jobs`는 `○ Static`을 유지한다 · `/auth/callback`·`/opengraph-image` = `ƒ`(`/api/payments/complete`는 2026-09-03 Server Action으로 옮기며 삭제) · **`/sitemap.xml`·`/robots.txt` = `○ Static`**(sitemap은 `cacheLife("days")`에서 온 `1d/1w` revalidate) · `ƒ Proxy` 존재. 공고 데이터 자체는 계속 `'use cache'`+`cacheTag`+`cacheLife`.
- **실 인증(2026-07-29)**: Supabase Auth **Google OAuth 단독**. 흐름 = 서버 렌더 `<form action={signInWithGoogle}>`(JS 없이도 동작) → Server Action이 **Origin 헤더로 `redirectTo` 구성** → Supabase → 구글 → `app/auth/callback/route.ts`가 PKCE code를 세션으로 교환 → `next`로 **상대 경로 303**. `?next=`는 왕복 내내 유지되고 `safeInternalPath`가 오픈 리다이렉트를 막으며, 실패는 `?error=oauth`(+`next` 보존)로 돌린다. 세션 쿠키 = `httpOnly`+`secure`(배포)+`sameSite=lax`. 서버는 `getCurrentUser`(Supabase `getUser`) 사용 · 헤더 계정 영역은 **`<Suspense>` 안의 서버 컴포넌트**(`HeaderAccount`+`HeaderAccountFallback`) — 쿠키가 httpOnly라 client island로는 못 읽는다. 권한 파생 = `lib/auth.hasChurchAccess`(교회 테이블 전까지 항상 false).
- **인증 2단 방어**: `proxy.ts`가 ① 세션 refresh ② `/mypage/**`·`/jobs/new`·`/jobs/[id]/edit`·**`/admin/**`** 비로그인 **1차 307 차단** ③ `/admin/**`은 로그인해도 운영자(`.env ADMIN_EMAILS`)가 아니면 `/`로 리다이렉트. 최종 권한 판단은 각 페이지의 `requireUser()`·`requireOperator()`(`lib/auth-guard.ts`, **인자 없음** — 복귀 경로는 proxy가 `x-pathname` 요청 헤더로 넘긴다)가 한다. 이유: cacheComponents에선 uncached read(쿠키)가 `<Suspense>` 안이어야 해서 페이지 안 redirect가 진짜 307이 아니라 **스트림 데이터(HTTP 200 + 스켈레톤)**로 나간다. ⚠️ **`/admin/jobs`(목록) 하나만** `○ Static` 유지 목적상 페이지 게이트가 없어 proxy 판정에만 의존한다 → proxy는 Auth 장애 시에도 admin만은 fail-closed로 막는다. 나머지(`/admin` 홈·`/admin/review`·`/admin/verify`·`/admin/jobs/[id]`)는 dynamic이라 페이지에서도 `requireOperator()`를 부른다.
- **SEO(2026-08-05)**: `app/sitemap.ts`가 **`lib/queries` seam에서 URL을 읽는다** → mock→DB 전환 시 파일 무수정(빌드 매니페스트로 확인: sitemap prerender 엔트리에 `jobs`·`churches` 태그가 전파돼 `updateTag("jobs")`가 sitemap도 갱신한다. 태그가 실패해도 `1d` revalidate가 안전망). 모집중 공고만 실음(구글 권장). `app/robots.ts`는 공개 허용 + 인증·운영자·API·공고등록/수정 차단. canonical = 전 공개 페이지(홈·`/jobs`·정적 4개·상세 2종). OG = `constants/site.ts` `SITE_OPEN_GRAPH`(siteName·locale·이미지 url/type/width/height/alt + `?v=` 캐시버스터) — ⚠️ **Next는 `openGraph`를 통째로 교체**하므로 openGraph를 재정의하는 페이지는 이 상수를 반드시 펼쳐 써야 한다. OG 이미지는 `app/opengraph-image.tsx`(브랜드 카드, **한글 미사용** — satori가 woff2·가변폰트 불가 + 번들 500KB 제한).
- ⚠️ `lib/supabase/*`·`proxy.ts`(+`lib/supabase/cookie-options.ts`·`lib/auth-guard.ts`·`lib/operator.ts`·`login/actions.ts`·`mypage/actions.ts`·`app/sitemap.ts`·`app/robots.ts`·`app/opengraph-image.tsx`·`constants/site.ts`)는 **존재**한다. 아직 없는 것 = 공고/교회 mutation `actions.ts`. `types/database.ts`는 **2026-08-21 생성**(클라이언트 3개에 `<Database>` 배선). `lib/ingest/structure.ts`는 **삭제됐다**(2026-08-22 — 구조화는 크롤러가 한다). 새로 생긴 것 = `lib/queries/review.ts`(seam·캐시 안 함) · `lib/review-flags.ts` · `lib/review-edits.ts` · `app/admin/review/actions.ts`(**첫 실 DB mutation**).

---

## 9. 수익 모델 & 노출 상품 (BM — 2026-07-08 조사·확정)

> 4개 subagent로 사람인·잡코리아·원티드·인크루트·갓피플·청빙넷·기독정보넷·알바몬/천국·인디드를 조사 후 확정. **되돌리지 말 것.** (`/pricing` 페이지 시안의 근거)
>
> ✅ **2026-09-02 재기획 확정.** A의 모델 판정(무료 공고 + 유료 노출, 성공보수 제외)은 그대로 섰다. **C·D는 확정값으로 갱신**했고 E에 2026-09 재조사를 더했다. 이전 표(프리미엄 7만·대표광고 15만 2단)는 2026-07-08 초안이었다. 조사 기록 세 편은 운영자 아티팩트로 보관 — [시장 지도](https://claude.ai/code/artifact/0b852bbb-d9bf-4715-90b1-9d4993b5e2e7) · [자리 설계(목업)](https://claude.ai/code/artifact/6f0793e7-107b-4bf2-8f5c-b2ddc4c05dd7) · [연관 공고 규칙](https://claude.ai/code/artifact/406aedba-9805-4b27-a519-e4cd71dd1018).

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
| ① 리스트 상단 고정 | 사람인 지면(5.2~22만/일)·잡코리아 채용관·원티드 직무상단 5구좌·갓피플 스페셜 | ✅ **목록 상단 로우**(스페셜·플러스) |
| ② 메인/홈 배너 | 사람인 플래티넘~알짜(주 100~770만)·원티드 메인배너·갓피플 취업홈 상단 | ✅ **홈 카드 3칸**(스페셜) |
| ③ 강조(볼드·컬러·배경·로고) | 사람인 강조효과(+1.25만/일)·갓피플 아이콘/배경색 | ❌ 안 팜 — "광고 태그·tint 없음" 정책 |
| ④ 끌어올리기(bump) | 사람인 랭크업(2.7만/7일)·잡코리아 점프업·갓피플 긴급 | ❌ 제외 — 공고량 적어 안 묻힘 |
| ⑤ 검색결과 상단 | 사람인 검색플러스(8.8만/일)·인디드 CPC | 🔸 Phase 2+ (트래픽 필요) |
| ⑥ 기간 연장/2배 | 인크루트 7일↑ 2배·갓피플 7→14일 | ✅ **런칭 프로모션**으로 |
| ⑦ 묶음·볼륨 할인 | PC+모바일 결합(사람인 20%·인크루트 40%)·볼륨(원티드 50만↑ 20%) | ✅ 4주 묶음 할인 |

### C. 민잡 상품표 (확정 2026-09-02 · 연관 칸 수 개정 2026-09-05 · 이전 2단은 2026-07 초안)

| 등급 | 자리 | 정원(주) | 1주 | 2주 | 4주 |
|---|---|---|---|---|---|
| **기본 공고** | 최신순 리스트(무료) | — | **0원** | | |
| **기본** | 연관 상단 3칸(같은 지역·자격 문 통과 상세 페이지) | 없음 | **29,000** | 55,000 | 89,000 |
| **플러스** | 목록 상단 로우 + 연관 상단 3칸 | **2** | **49,000** | 94,000 | 149,000 |
| **스페셜** | 홈 카드 + 목록 상단 로우 + 연관 상단 3칸 | **3** | **69,000** | 129,000 | 209,000 |

VAT 포함 · 주 단위(월~일) · 2주 −5% · 4주 −25%. 비율 3.4:1.7:1 = 갓피플 4:2:1에 맞춤. 자리별 노출 조건·비슷한 공고 규칙 = SPEC.

### D. 운영 원칙

- **주 단위(월~일)** — 청빙 마감 주기(2~4주)와 맞음. 갓피플·원티드·메디게이트도 주 또는 7일.
- **정원 = 스페셜 3·플러스 2/주**(원티드 직무상단 5구좌식). 희소성이 값의 근거이고 1인 운영의 주간 처리 상한. **수요가 넘치면 정원이 아니라 값을 올린다** — 늘리면 먼저 산 교회 것이 묽어진다.
- **정가로 시작, 런칭 프로모션 없음**(운영자 결정 2026-09-02). 최상단은 갓피플 스페셜(8.8만/7일)과 같은 급 — 트래픽 0인 새 사이트가 그 위를 부를 근거도, 아래로 내려가 올릴 때 저항을 살 이유도 없다.
- **강조·끌어올리기·검색상단·성과형(클릭·지원당)은 안 판다** — 성과형은 측정 인프라 0·트래픽 0이라 성립하지 않고(인디드도 지원당 과금을 강제하다 철회), 나머지는 단순성 = 니치의 무기. 유료도 tint 없이 섹션 라벨 "광고" 하나.
- **`/pricing`은 결제 마무리와 함께 3등급·바로 결제로 전환.** 지금은 2단 안내 + "문의" 카피 — 온라인 결제가 아직 구조적으로 불가해 사실이다.
- 지원은 사이트 밖(원문/교회) → 성공보수 불가.

### E. 조사 벤치마크 (실단가, 2026-07)

- **사람인**: 메인배너 주 100~770만 · 지면 일 5.2~22만 · 검색 일 8.8만 · 랭크업 2.7만/7일. "위치×등급×기간 + add-on" 사다리.
- **잡코리아**: 채용관 일 4.4~198만 · 점프업 일 3~5만 · 대량 패키지 최대 78%↓.
- **원티드**: 성공보수(연봉 7%) + 직무상단광고 **5구좌 주 5~20만**(태그당). 강조·끌올 없음(단순).
- **인크루트**: 노출 7종 전부 상품화. 메인패키지 주 158만~3천만 · 리스트 2일 13~58만 · 랭크업 6만/2일.
- **갓피플(니치 벤치마크)**: 스페셜 8.8만 · 추천 4.4만 · 긴급(bump) 2.2만 / **7일** + 기간 2배 프로모션. 등록·인재찾기는 무료.
- **청빙넷·기독정보넷(cjob)**: **유료 상품 없음**(무료 게시판) = 구조화된 저가 노출로 **선점할 빈틈**. → 2026-09 재확인에서 둘 다 403이라 **"확인 불가"로 낮춤**(cjob엔 광고 접수 폼이 있다).
- **2026-09-02 재확인(네 갈래 병렬 조사)**: 잡코리아는 2025-11 메인 상품 7→4 축소·상단고정 종료·**CPC 스마트픽**(클릭 200~700원, 예산 15/30/50만, 2026-04 기간 개념 제거)으로 이동 중 · 사람인은 상품 코드 117개 전부 기간 과금(성과형 0) · 원티드 직무상단 5구좌 주 5.5~22만(VAT 포함 환산) 그대로 · 갓피플 3종 10년 동결(홈은 스페셜 **로고 박스 8칸 격자**, 상세 하단은 유사도 없이 같은 카테고리 최근 6개) · **교단지 소형 지면 22~36만/1회**(기독공보·기독신문·연합신문 — 교회가 실제로 청빙 광고비를 쓰는 곳) · 메디게이트 주 7.7~66만 · 미국 교회보드 30일 $99~269 전부 유료 · 위 "사람인 랭크업 2.7만/7일"은 **6회 2.7만/일**의 단위 오기.

### F. 포지셔닝

갓피플(3종·8칸·카테고리 목록)과 같은 급의 값에 **자리는 더 희소하게(3·2), 노출은 더 정확하게(자격·지역이 맞는 곳에만)**. 대형사의 매트릭스도 성과형도 1인 운영엔 부적합 — 사다리 3단이 상한이다.

### G. `/pricing` 페이지 구현 (2026-07-09 — ✅ 2026-09-03 3등급으로 전환, CTA는 문의 유지)
히어로 → **상품 4카드**(무료·기본 2.9만·플러스 4.9만·스페셜 6.9만/주 — 문구·비교표는 `EXPOSURE_PRODUCTS`에서 파생, 가격 공개 + "문의하기") → **한눈에 비교** → **믿고 노출하세요**(getCoverageStats 실집계 + 하단 슬림 바 "운영자 검수·VAT 포함") → **문의**(mailto) → **FAQ**. 유료 카드의 **"노출 화면 미리보기" → 풀스크린 모달**(`components/pricing/exposure-preview.tsx`, client): PC/모바일 토글(뷰포트 기본) + 상품별 **전체 페이지 장면 캐러셀**(footer 제외). 상세 SPEC `/pricing`.

### H. 노출 결제 flow (`/mypage/church/promote`, 2026-07-20 — **결제 마무리 2026-09-03**: 3등급 · 시작일 · 정원 · 주문 저장 · 모바일 복귀)
- **공개 `/pricing`은 "안내+문의" 유지**, **실 결제는 인증 교회 전용 `/mypage/church/promote`로 분리**. 진입 = `/mypage/church` 사이드바 "노출 신청 →".
- 화면 = 대상 공고 → 노출 상품(기본·플러스·스페셜 + 고른 기간의 남은 자리) → 시작일(오늘부터 7일) → 기간(1·2·4주, 묶음가 표) → 결제 요약 → 약관 동의 → 결제 → 결과 3갈래(적용됨 / 청구됐는데 적용 못 함 / 청구 없음). 정본 = SPEC 마이페이지 절.
- **PortOne V2(KCP CARD)** 결제창 → **Server Action `completePromotion`**(2026-09-03 — 옛 route handler `/api/payments/complete` 삭제)이 PortOne 조회로 상태·금액을 대조하고, 주문은 `customData`에서 다시 읽어 정원·겹침을 재확인(경합이면 전액 취소)한 뒤 원장 INSERT(멱등) + `updateTag("jobs")` — **원장 한 줄이 곧 노출이라 적용 단계가 없다**(2026-09-03). 적은 **뒤에도** 정원·겹침을 한 번 더 읽는다(먼저 적힌 쪽이 이긴다). 모바일은 `?paymentId=` 복귀가 같은 액션을 부른다. 가격 단일 소스 = `EXPOSURE_PRODUCTS`.
- **채널(2026-07-21)**: PortOne 실연동 "MinJob NHN KCP"(`kcp_v2`·사이트코드 IP94F·PG-API 인증서/개인키). 채널 키 = `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`(로컬·Vercel). STORE_ID·`PORTONE_API_SECRET`은 상점 단위라 채널 바꿔도 불변.
- **KCP 한도(심사 안내)**: 건당 100만원 · 월 정산 150만원(상향요청 시 보증보험료) · 정산 월 4회 · 할부 3개월. 상품 최대 50만원이라 건당 여유, 월 150만은 매출 증가 시 상향.
- **✅ 실카드결제 활성(2026-08-05)** — 가맹 심사 + 카드사 등록 둘 다 통과. 실 노출 적용(featured 세팅)·주문 저장·모바일 redirect 복귀 = Phase 1. 🔴 **화면은 2026-08-19까지 "테스트 모드 — 실제 청구는 없어요"라고 거짓 안내**하고 있었다(심사 시절 문구 잔존). 잠그지 않고 사실을 말하게 고쳤다(결제 경로가 교회 인증 미구현으로 **구조적 도달 불가**라 피해 없음) — 카드 실청구 + 노출 적용은 **운영자 수동** + 결제번호·환불 기준·모바일 복귀 안내 + 문의 링크. 수동 처리가 성립하려면 **무엇을 누구에게**가 필요해 `customData`(jobId)·`customer`(email)를 PortOne 레코드에 싣고 서버가 감사 로그를 남긴다. **청구 후 검증 실패는 `charged` 상태로 분리** — 이중 청구 방지. 결제를 제대로 파는 데 필요한 3가지는 ROADMAP 1-8. **결제 경로 도달은 교회 멤버십 배선에 막혀 있다**(`churchVerificationStatus` 하드코딩 `null`).

---

## 10. 계정·역할·인증 모델 + `/mypage` 설계 (2026-07-10 확정 — 코드 전)

> `/mypage`는 **설계·시안·모델 확정, 코드 미착수**. 집에서 이어서. 시안: `scratchpad/mypage-church-mockup.html`(A. 인증완료 관리뷰 / B. 인증 검수중 게이트). **아래 결정은 되돌리지 말 것.**

### A. 계정/역할 모델 (2026-07-12 refinement — 되돌리지 말 것)
> ⚠️ 이전 "가입 시 역할 하드 분기 + `users.role = SEEKER|CHURCH`"는 **폐기**. 아래 단일 계정 모델로 대체(타 플랫폼 재조사 근거 §E + LinkedIn/원티드/Indeed 중간형).
- **단일 계정 + 역할 view**: 계정은 하나, 모든 계정은 기본 **사역자(MINISTER)**. **교회 인증(증빙 + 운영자 승인) 통과 시** 같은 계정에 **교회(CHURCH) view** 개방. 부교역자가 구직자이면서 자기 교회 담당자인 케이스를 단일 정체성이 자연 처리.
- **"교회 계정" 없음**: 교회는 `churches` 엔티티, 사람 계정은 관리 자격. `users`에서 `role` 제거 → **`church_id`(nullable·다대일=다중 담당자) + `church_verification_status`(PENDING/APPROVED/REJECTED)**. 파생 `hasChurchAccess = church_id && APPROVED`. **가입 시 역할 선택 불필요**.
- **공고 소유 = 교회 엔티티**. `jobs.owner_id`는 **제거됨(2026-08-07)** — **편집 권한 = 그 교회 인증 관리자 여부**. 담당자 이동 시 공고는 교회 잔류·클레임으로 회수. 인증은 **교회별**.
- Phase: **로그인·교회 인증·공고관리·북마크 = Phase 1**(북마크는 단일 계정이라 이동), 관심 교회 팔로우·새 공고 알림 = Phase 2.
- 상세 스키마 = DATA §2·§3(users)·§4·§9. 페이지 명세 = SPEC 사용자 모델·§B·/mypage 블록.

### B. 교회 인증 (공고 게재 게이트 — "누구나" 차단)
- **증빙 서류 제출 + 운영자 승인**: 가입 시 **고유번호증(또는 사업자등록증)** 사본 + 교회정보 → 운영자 검토·승인 → **인증 교회만 공고 게재**. 승인 전 게재 불가(작성 게이트).
- 사업자등록증 강제(사람인·갓피플식) 대신 **고유번호증**(교회 대부분 보유 = 기부금영수증용) 수용. 서류 없는 교회 대비 = **공개 대표연락처 인증코드**(하이브리드, 후순위).
- 상태: **검수중 → 인증완료(배지) / 반려**. (공고 전수 검수는 **철회** — 2026-08-21. 교회 인증이 등록 자격 게이트이므로 그 위에 공고 검수를 또 두지 않는다.)

### C. `/mypage` 교회 view 섹션 (Phase 1, `getOwnedJobs` 있음)
1. 계정 헤더(교회명 + **인증 상태 배지**) 2. **요약**(게재중/검수중/마감) 3. **내 공고 목록**(상태 배지·노출 배지 + 액션: **수정·마감·복사=재등록·삭제**; 마감건은 복사만) + **"노출 올리기→문의"**(pricing 연동) 4. **새 공고 등록** CTA(**인증 전 비활성**) 5. ⭐**운영자 공고 클레임**(owner 없는 병존 공고를 이 계정에 연결 — 우리 고유) 6. 교회정보 설정
- **제외**: 지원자 관리·이력서 열람(사이트 내 지원 X) · 결제/세금계산서(Phase 2) · 인재검색·제안(Phase 2)

### D. `/mypage` 사역자 view
- **Phase 1**: 최근 본 공고 + **북마크**(단일 계정이라 Phase 1로 이동). **Phase 2**: **관심 교회 팔로우·새 공고 알림**(관심기업 번안) + 알림/계정 설정. 지원현황·이력서공개·받은제안 **제외**.

### E. 조사 근거 (subagent, 2026-07-10)
- 타 플랫폼 마이페이지: **기업** = 공고 목록(상태축) + 액션(복사=재등록 표준) + 지원자관리(이력서 열람) + 유료상품·결제·세금계산서 + 기업정보. **개인** = 스크랩/북마크 + 지원현황 + 이력서공개 + 열람기업·받은제안 + 최근본/추천.
- **니치**: 청빙넷·기독정보넷 = 게시판형(통합 관리 UI 없음). **갓피플만** 마이페이지+유료노출+공고 CRUD 보유(사업자등록증 증빙 필수).

### F. TODO (집에서)
1. ✅ **SPEC/DATA/§10 반영 완료(2026-07-12)**: role 제거 → `church_id` + `church_verification_status` · owner_id 작성자로 강등(→ 2026-08-07 완전 제거) · 교회 인증(증빙+승인) · /mypage 상태별 섹션 (DATA §2·§3·§4·§9, SPEC 사용자 모델·§B·/mypage)
2. **/mypage 교회 view 코드 구현**(mock 위, 업로드·승인·클레임 실동작은 Phase 1) ← 다음
3. ~~로그인 역할 선택 흐름~~ → **불필요 확정**: 단일 계정(로그인=사역자), 교회는 인증으로 승격. 로그인 UI 변경 없음
