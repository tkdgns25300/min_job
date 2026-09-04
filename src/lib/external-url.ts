// 밖으로 나가는 주소 하나를 `href`로 쓸 수 있는 모양으로 만든다(순수). 못 만들면 `null`.
//
// 두 곳이 같은 답을 써야 해서 파일로 뺐다(2026-09-04): **교회가 저장하는 채널 주소**(`lib/church-info`)와
// **공고가 공개한 지원 링크의 표시**(`(public)/jobs/[id]`). 앞은 저장 전 검증, 뒤는 링크로 만들지 글자로
// 둘지의 판정인데, 두 물음의 답이 갈리면 저장은 되는데 눌리지 않는(또는 그 반대) 주소가 생긴다.

const HOSTNAME = /^[^.]+(\.[^.]+)+$/;
/** 주소 하나가 아니라는 표시 — 값이 여럿이거나("a.org, b.org") 설명이 붙은 것("a.org (홈페이지)") */
const NOT_ONE_URL = /[\s,()]/;

/**
 * 주소 정규화 — 스킴이 없으면 `https://`를 붙인다. 교회는 `andongtaehwa.org`처럼 주소만 적고
 * 크롤러도 원문을 그대로 넘겨서(실측 2026-09-04: `jobs.contact_link` 722건 중 206건이 스킴 없음),
 * 그대로 쓰면 **상대 경로 링크가 되어 깨진다**.
 *
 * 🔴 **스킴을 확인하는 것이 핵심이다.** `javascript:alert(1)`은 스킴이 **있어서** 위 부착을 비껴가고
 *    `new URL()`도 통과한다. 그 값이 `href`로 나가면 누른 사람 브라우저에서 실행된다.
 *    `data:`·`mailto:`·`tel:`도 같은 문으로 들어온다. 그래서 **`http`/`https`만** 통과시킨다.
 * ⚠️ **호스트 모양도 본다.** `https://foo`(점 없음)·`https://.com`·`https://a.`은 파싱만 보면 통과하는데
 *    전부 죽은 링크다 — 교회는 "형식이 맞다"는 답을 듣고 저장하게 된다. 점으로 나뉜 조각이 모두
 *    비어 있지 않아야 한다.
 * ⚠️ **주소 하나여야 한다.** 공백·쉼표·괄호가 섞인 값은 파서가 **조용히 통과시켜** 엉뚱한 호스트를 만든다
 *    (실측: `"www,guryejungangchurch.com"` → 호스트 `www,guryejungangchurch.com` · `"http://www. chilsung.org"`
 *    → 호스트 `www.`). 링크가 되느니 글자로 남는 편이 낫다.
 * ⚠️ **자격증명은 지운다.** `https://naver.com@evil.com/`처럼 아는 도메인을 앞에 세워 사람을 속이는
 *    모양이 되고, 교회가 실수로 붙여 넣은 비밀번호가 공개 페이지에 박힐 수도 있다.
 *
 * 한글 도메인은 punycode로 바뀌어 나간다(`www.용인선린교회.org` → `www.xn--…org`) — 브라우저가 하는 것과
 * 같은 변환이라 **글자는 원문 그대로 두고 `href`만** 이 값을 쓴다.
 */
export function normalizeExternalUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || NOT_ONE_URL.test(value)) return null;
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!HOSTNAME.test(url.hostname)) return null;
  url.username = "";
  url.password = "";
  return url.toString();
}
