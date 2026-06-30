# MinJob — 데이터 설계 (작성 예정)

> DB 스키마·enum·인덱스·RLS·구조화 정책·설계 결정을 담을 문서. 비즈니스 동작은 [`SPEC.md`](./SPEC.md), 아키텍처는 [`../CLAUDE.md`](../CLAUDE.md).

> ⚠️ **이 문서는 아직 작성하지 않는다.** 제품이 더 구체화된 뒤 채운다. 지금은 아래 **결정 대기 목록**만 둔다.
> DB 스키마·마이그레이션·DB 타입 생성(ROADMAP Phase 0의 "DB 스키마" 블록, Phase 1 대부분)은 **이 문서가 확정된 뒤** 진행한다.

## 결정 대기 목록 (DATA 작성 시 확정)

1. **교단·지역을 `jobs`에 비정규화 vs `churches` join** — 핵심 필터(교단·지역)가 `jobs` 기준이라 인덱스 유효성과 직결. (비정규화: 필터·인덱스 단순, 거의 안 바뀜 / join: 정규화 유지)
2. **`position`/`employment_type`/`department` 직교화** — enum 값에서 "전임전도사·교육전도사"처럼 직분에 고용형태·부서가 섞이지 않게 분리. 모순 데이터(파트전도사 + 전임) 방지.
3. **enum 허용값 최종 확정·확장 정책** — 영어 대문자 key + 한글 라벨(규칙은 CLAUDE). 실제 공고 수집하며 확장.
4. **교회 dedup/매칭 + 재공고 추적 키** — 운영자 수기 등록 시 같은 교회가 중복 행으로 갈라지지 않게. 재공고 추적·claim·교회상세의 토대. (식별 키 + ingest 시 기존 교회 매칭)
5. **RLS 정책** — public(모집 중) / owner(자기 마감 공고 포함) / service-role(cached read) 경로 구분.
6. **`is_featured` 만료(`featured_until`)** — 유료·기간제 노출이라 만료 시각 필요.
7. **사례비 단위·기간** — 만원 단위 + 월/연 구분(`stipend_period`). 비교가 핵심이라 단위 통일 필수.

## 엔티티 (방향만 — 확정은 위 결정 후)

- `churches`(교회) · `jobs`(공고·핵심) · `users`(계정: 구직자/교회/운영자) · `claims`(소유권 인수)
- 핵심 원칙:
  - `jobs.owner_id` **nullable** — "주인 없는 공고" (운영자 등록은 소유자 없음, claim 후 연결). 가드레일 #2
  - `source`로 운영자 등록 / 교회 직접 등록 구분
  - DB는 저장 전용 (trigger·function 없음, 비즈니스 로직은 Server) — CLAUDE DB Policy
  - 개인 담당자 연락처 컬럼 두지 않음 — 가드레일 #3
