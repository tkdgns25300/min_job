import { describe, expect, it } from "vitest";
import { jobParams, purchaseEvent } from "./analytics";

// 매개변수 모양은 콘솔에 등록한 맞춤 측정기준과 1:1이다 — 여기서 고정해 두면 이름이 조용히 어긋나지 않는다.
describe("jobParams — 공고 이벤트 공통 매개변수", () => {
  it("배열은 `+`로 잇고, 없는 직분은 null", () => {
    expect(
      jobParams({ id: "j1", jobKind: ["MINISTRY", "GENERAL"], region: "SEOUL", position: [] }),
    ).toEqual({ job_id: "j1", job_kind: "MINISTRY+GENERAL", region: "SEOUL", position: null });
    expect(
      jobParams({
        id: "j2",
        jobKind: ["MINISTRY"],
        region: null,
        position: ["ASSOCIATE_PASTOR", "EVANGELIST"],
      }).position,
    ).toBe("ASSOCIATE_PASTOR+EVANGELIST");
  });
});

describe("purchaseEvent — GA4 표준 전자상거래 모양", () => {
  it("정가를 value로, 결제번호를 transaction_id로", () => {
    const event = purchaseEvent({ jobId: "j1", tier: "PLUS", weeks: 2 }, "pay-1");
    expect(event.name).toBe("purchase");
    expect(event.params).toMatchObject({
      transaction_id: "pay-1",
      value: 94_000,
      currency: "KRW",
      tier: "PLUS",
      job_id: "j1",
      items: [{ item_id: "PLUS_2W", item_name: "플러스 2주", price: 94_000, quantity: 1 }],
    });
  });
});
