import { ADMIN_PREFIX } from "@/lib/auth";
import {
  EXPOSURE_PRODUCTS,
  exposurePrice,
  type ChurchChannel,
  type ExposureProduct,
  type ExposureWeeks,
} from "@/constants/domain";
import type { Job } from "@/types/domain";

// GA4 이벤트 계약 — **이름·매개변수를 여기서 닫는다.** 콘솔에 등록한 맞춤 측정기준 8개
// (`docs/ANALYTICS.md`)와 매개변수 이름이 1:1이어야 보고서에 잡힌다 — 오타는 GA가 조용히 버린다.
//
// ⚠️ **전부 클라이언트에서 보낸다.** 공개 페이지는 `'use cache'`로 모든 방문자가 같은 HTML을 받아
//    서버에서는 "누가 봤다"를 셀 수 없고(CLAUDE `'use cache'` 제약), 서버 이벤트는 봇·크롤러도 센다.
//    `track`은 브라우저 밖(서버 렌더)에서는 아무 일도 하지 않는다.
// ⚠️ 운영자 화면(`/admin/**`)에서는 보내지 않는다 — 검수 미리보기가 공개 상세와 같은 컴포넌트를 그려서,
//    막지 않으면 운영자가 원문을 확인한 클릭이 핵심 지표(`source_click`)에 섞인다.

/** 공고 이벤트가 공통으로 싣는 값 — 콘솔 측정기준 `job_id`·`job_kind`·`region`·`position` */
export interface JobParams {
  job_id: string;
  /** 종류 키를 `+`로 이었다(`MINISTRY`·`GENERAL`·`MINISTRY+GENERAL`) — 배열은 매개변수로 못 보낸다 */
  job_kind: string;
  region: string | null;
  /** 직분 키를 `+`로 이었다. 일반직처럼 직분이 없으면 null(보내지 않는다) */
  position: string | null;
}

/** 원문 링크의 종류 — 수집 공고의 원문(`source`)인지 인증 교회의 홈페이지(`homepage`)인지 */
export type SourceLabel = "source" | "homepage";

interface PurchaseParams {
  /** 결제번호 — GA가 같은 번호의 `purchase`를 하나로 합친다(모바일 복귀 화면 새로고침 대비) */
  transaction_id: string;
  /** 정가(원) — 운영자 임시 가격(`TEST_EXPOSURE_PRICES`)은 반영하지 않는다 */
  value: number;
  currency: "KRW";
  tier: ExposureProduct;
  job_id: string;
  items: [{ item_id: string; item_name: string; price: number; quantity: 1 }];
}

export type AnalyticsEvent =
  | { name: "job_view"; params: JobParams }
  | { name: "source_click"; params: JobParams & { label: SourceLabel } }
  | { name: "bookmark_add"; params: { job_id: string } }
  | { name: "share"; params: { method: "copy"; content_type: "job"; item_id: string } }
  | { name: "church_link_click"; params: { channel: ChurchChannel } }
  | { name: "pricing_preview_open"; params: { label: string } }
  | { name: "verify_submit"; params?: undefined }
  | { name: "job_post"; params: { via: "form" | "claim" } }
  | { name: "purchase"; params: PurchaseParams };

export function jobParams(job: Pick<Job, "id" | "jobKind" | "region" | "position">): JobParams {
  return {
    job_id: job.id,
    job_kind: job.jobKind.join("+"),
    region: job.region,
    position: job.position.length > 0 ? job.position.join("+") : null,
  };
}

/** 노출 결제 완료 — GA4 표준 전자상거래 이벤트 모양(`transaction_id`·`value`·`currency`·`items`) */
export function purchaseEvent(
  order: { jobId: string; tier: ExposureProduct; weeks: ExposureWeeks },
  paymentId: string,
): AnalyticsEvent {
  const value = exposurePrice(order.tier, order.weeks);
  return {
    name: "purchase",
    params: {
      transaction_id: paymentId,
      value,
      currency: "KRW",
      tier: order.tier,
      job_id: order.jobId,
      items: [
        {
          item_id: `${order.tier}_${order.weeks}W`,
          item_name: `${EXPOSURE_PRODUCTS[order.tier].label} ${order.weeks}주`,
          price: value,
          quantity: 1,
        },
      ],
    },
  };
}

type GtagParams = Record<string, unknown>;

declare global {
  interface Window {
    /** gtag.js가 심는 전역 — 스크립트가 없으면(측정 ID 미설정 · 차단 확장) undefined */
    gtag?: (command: "event", name: string, params?: GtagParams) => void;
  }
}

/** 이벤트 하나를 보낸다. 브라우저 밖·스크립트 없음·운영자 화면이면 조용히 건너뛴다 */
export function track(event: AnalyticsEvent): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (window.location.pathname.startsWith(ADMIN_PREFIX)) return;
  window.gtag("event", event.name, withoutNulls(event.params));
}

// null 값은 빼고 보낸다 — GA는 빈 값을 "(not set)"으로 세어 분포를 흐린다
function withoutNulls(params: object | undefined): GtagParams | undefined {
  if (!params) return undefined;
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== null));
}
