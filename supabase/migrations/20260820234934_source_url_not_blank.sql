-- `jobs.source_url`이 빈 문자열이면 거부한다.
--
-- 초기 스키마의 CHECK ③(`source = 'CHURCH' or source_url is not null`)은 **NULL만** 막는다.
-- 빈 문자열은 NULL이 아니라 그대로 통과했다 — 그러면 수집 공고가 **출처 없이 공개된다**.
--
-- 왜 무거운가: 남의 공개 게시판 내용을 우리 사이트에 싣는 근거가 **"원문 재게시 없이
-- 요약 + 출처 링크"**(가드레일 #1)이고, 2026-07-28 법률 검토가 그 포지셔닝으로 통과했다.
-- `source_url`이 비면 남는 것은 요약뿐이라 그 근거가 사라진다.
--
-- 화면도 끊긴다: `job-detail-view`의 `getApplyTarget`이 `if (job.sourceUrl)`로 판정하는데
-- 빈 문자열은 JS falsy라 이 분기를 지나간다. 크롤 공고는 `church_id`가 NULL이어서 교회
-- 홈페이지 폴백도 없다 → **지원 동선이 통째로 사라진 공고**가 조용히 공개된다.
--
-- 확률은 낮다(크롤러가 파이썬에서 이미 막는다). 넣는 이유는 **결과가 무겁고 감지되지 않기**
-- 때문이다 — 사례비 역순처럼 화면에서 티가 나는 종류가 아니라, 그 공고 하나만 조용히 망가진다.
--
-- NULL은 계속 허용한다 — 교회가 직접 등록한 공고는 원문이 없다(CHECK ③이 그쪽을 면제한다).

alter table jobs
  add constraint jobs_source_url_not_blank
  check (source_url is null or length(btrim(source_url)) > 0);
