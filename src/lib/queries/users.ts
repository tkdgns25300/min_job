import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import * as mock from "@/mocks";
import { createClient } from "@/lib/supabase/server";
import { todayInSeoul, type HiddenReason } from "@/lib/job-visibility";
import type { Church, CurrentUser, Job } from "@/types/domain";

// 데이터 소스 seam (인증 사용자) — 인증 페이지는 여기서만 가져온다.
// ⚠️ 인증 의존 read는 'use cache' 금지 — 쿠키 세션 기반 server.ts를 쓴다(service.ts X).
// getCurrentUser는 Supabase Auth 실배선 완료. 교회 대시보드·공고 조회는 아직 mock 위임.

// 마이페이지 관리 리스트 projection — 관리·표시에 필요한 필드만
export type MyJob = Pick<
  Job,
  | "id"
  | "title"
  | "status"
  | "featuredTier"
  | "postedAt"
  | "deadline"
  | "position"
  | "department"
  | "employmentType"
  | "source"
> & {
  /**
   * 공개 목록에 실제로 노출되는가 — 마감일 경과·상시모집 90일 초과면 false (DATA.md §6-1).
   * `status`는 교회의 명시적 의사표시(마감 버튼)라 별개다. 교회 화면은 둘 다 보여준다:
   * 숨겨진 공고에 노출 결제를 팔면 안 되고, 교회는 왜 안 보이는지 알아야 한다.
   */
  isPubliclyOpen: boolean;
  /** 내려간 이유 (안내 문구 선택용) — 노출 중이거나 교회가 직접 마감했으면 null */
  hiddenReason: HiddenReason;
};

// 교회 관리 대시보드 — 그 교회 공고(church_id 기준) + 클레임 가능(운영자 등록) 건수
export interface ChurchDashboard {
  church: Pick<Church, "name" | "denomination" | "region" | "city"> | null;
  managed: MyJob[]; // 교회 직접 등록(source=CHURCH) — 편집 대상
  claimableCount: number; // 운영자 등록(source=OPERATOR) — "가져와 관리"(클레임) 대상
}

/**
 * 로그인 사용자 — Supabase Auth 세션 기준. 비로그인은 null(게이트가 /login으로 보낸다).
 * cache() = 요청 단위 메모이제이션: 한 요청에서 헤더와 페이지가 각각 불러도 Auth 왕복은 1회.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    const supabase = await createClient();
    // getUser는 Auth 서버에서 토큰을 검증하고 최신 계정 정보를 준다(getSession과 달리 위조 불가).
    const { data, error } = await supabase.auth.getUser();
    // 이메일은 표시 신원(헤더 아바타·문의)이라 없으면 미로그인 취급 — CurrentUser.email은 non-null.
    if (error || !data.user?.email) {
      // 세션 없음(AuthSessionMissingError)은 정상 흐름이라 조용히 넘긴다.
      // 그 외(5xx·레이트리밋 등)는 로그인 사용자가 로그아웃된 것처럼 보이게 만드므로 원인을 남긴다.
      if (error && error.name !== "AuthSessionMissingError") {
        console.error("[auth] 세션 확인 실패 — 미로그인으로 처리", error);
      }
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email,
      name: displayName(data.user.user_metadata),
      // 교회 소속·인증 상태는 교회 테이블 도입 후 join — 그때까지 모든 계정은 미신청 상태.
      // churchIsVerified는 `churches.verification_status`에서 온다(같은 join으로 함께 읽는다).
      churchId: null,
      churchName: null,
      churchVerificationStatus: null,
      churchIsVerified: false,
      churchRejectionReason: null,
    };
  } catch (thrown) {
    // ⚠️ Next 내부 제어 신호(프리렌더 중단·dynamic bailout·redirect)는 반드시 되던진다.
    // 삼키면 dynamic hole이 "미로그인"으로 프리렌더에 박혀 캐시가 오염된다.
    unstable_rethrow(thrown);
    // 남는 건 진짜 장애(env 누락·네트워크). 헤더가 공개 페이지에서도 이 함수를 부르므로
    // 여기서 던지면 사이트 전체가 에러 화면이 된다 → 미로그인으로 강등(fail-closed).
    console.error("[auth] 세션 조회 실패 — 미로그인으로 처리", thrown);
    return null;
  }
});

/** OAuth 프로필의 표시명 — 제공자마다 키가 달라 후보를 순서대로 본다. 없으면 null(이메일로 폴백) */
function displayName(metadata: Record<string, unknown>): string | null {
  const candidates = [metadata.full_name, metadata.name];
  return candidates.find((v): v is string => typeof v === "string" && v.trim() !== "") ?? null;
}

/**
 * 교회 관리 대시보드 — 권한은 교회 인증 멤버십(DATA §4).
 * ⚠️ 이 함수는 `'use cache'`가 없다(인증 의존) → 여기서 오늘 날짜를 만들어도 굳지 않는다.
 *    공개 목록 쪽(`queries/jobs.ts`)은 cached scope라 사정이 다르다(CLAUDE.md 제약 #2).
 */
export async function getChurchDashboard(churchId: string): Promise<ChurchDashboard> {
  return mock.getChurchDashboard(churchId, todayInSeoul());
}

/**
 * 수정 화면용 공고 — 권한 = 그 공고 church_id의 인증 관리자 **+ `source=CHURCH`**.
 * 운영자 등록 공고는 클레임 전까지 편집 불가(대시보드의 managed/claimable 구분과 일치).
 * 남의 교회 공고·미클레임 공고는 null → notFound
 */
export async function getEditableJob(id: string, churchId: string): Promise<Job | null> {
  return mock.getEditableJob(id, churchId);
}
