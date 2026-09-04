import { describe, expect, it } from "vitest";
import { normalizeExternalUrl } from "./external-url";

// 표본은 2026-09-04 실데이터(`jobs.contact_link` 722건)에서 뽑았다 — 크롤러가 원문 그대로 넘긴 값이다.
describe("normalizeExternalUrl — 주소 하나만 href가 된다", () => {
  it("스킴이 없으면 https를 붙인다 — 실데이터 206건이 이 모양", () => {
    expect(normalizeExternalUrl("www.esch.or.kr/")).toBe("https://www.esch.or.kr/");
    expect(normalizeExternalUrl("juanjungang.or.kr")).toBe("https://juanjungang.or.kr/");
  });

  it("온전한 주소는 그대로(앞뒤 공백만 정리)", () => {
    expect(normalizeExternalUrl(" https://www.sjyebon.org ")).toBe("https://www.sjyebon.org/");
  });

  it("주소가 아닌 것은 null — 화면에는 글자로만 남는다", () => {
    for (const raw of [
      "카카오톡 ID : tobedo",
      "향동좋은나무교회",
      "bungee406",
      "http//daeyangjeil.com",
      "http://http:www.noamch.co.kr",
      "www.paulchurch.org.",
      "",
    ]) {
      expect(normalizeExternalUrl(raw), raw).toBeNull();
    }
  });

  it("쉼표·괄호·공백이 섞이면 주소 하나가 아니다 — 파서가 통과시켜도 거른다", () => {
    for (const raw of [
      "www, sekwang.org",
      "a.org,b.org",
      "https://a.org (홈페이지)",
      "https://a.org, https://b.org",
    ]) {
      expect(normalizeExternalUrl(raw), raw).toBeNull();
    }
  });

  it("http·https 외의 스킴은 막는다", () => {
    expect(normalizeExternalUrl("javascript:alert`1`")).toBeNull();
    expect(normalizeExternalUrl("mailto:office@church.kr")).toBeNull();
  });

  it("자격증명은 지운다", () => {
    expect(normalizeExternalUrl("https://naver.com@evil.com/")).toBe("https://evil.com/");
  });
});
