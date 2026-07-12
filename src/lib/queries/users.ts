import { cookies } from "next/headers";
import * as mock from "@/mocks";
import { getAccount, SESSION_COOKIE } from "@/lib/mock-auth";
import type { Church, CurrentUser, Job } from "@/types/domain";

// 데이터 소스 seam (인증 사용자) — 인증 페이지는 여기서만 가져온다.
// ⚠️ 인증 의존 read는 'use cache' 금지 — 실구현은 쿠키 세션 기반 server.ts(anon) 호출로 교체.
// 현재는 mock 위임(항상 로그인된 mock 교회 계정). Phase 1 Supabase Auth에서 배선.

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
>;

// 교회 관리 대시보드 — 그 교회 공고(church_id 기준) + 클레임 가능(운영자 등록) 건수
export interface ChurchDashboard {
  church: Pick<Church, "name" | "denomination" | "region" | "city"> | null;
  managed: MyJob[]; // 교회 직접 등록(source=CHURCH) — 편집 대상
  claimableCount: number; // 운영자 등록(owner 없음) — "가져와 관리" 대상
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // mock 세션 쿠키(mj_session) → 계정. 실구현은 Supabase Auth 세션(server.ts, 쿠키 기반).
  const store = await cookies();
  return getAccount(store.get(SESSION_COOKIE)?.value);
}

/** 교회 관리 대시보드 — 권한은 교회 인증 멤버십(owner 일치 아님, DATA §4) */
export async function getChurchDashboard(churchId: string): Promise<ChurchDashboard> {
  return mock.getChurchDashboard(churchId);
}

/** 수정 화면용 공고 — 권한 불일치(남의 공고·미인증)는 null → notFound */
export async function getEditableJob(id: string, userId: string): Promise<Job | null> {
  return mock.getEditableJob(id, userId);
}
