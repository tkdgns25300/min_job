import * as mock from "@/mocks";
import type { CurrentUser, Job } from "@/types/domain";

// 데이터 소스 seam (인증 사용자) — 인증 페이지는 여기서만 가져온다.
// ⚠️ 인증 의존 read는 'use cache' 금지 — 실구현은 쿠키 세션 기반 server.ts(anon) 호출로 교체.
// 현재는 mock 위임(항상 로그인된 mock 교회 계정). Phase 1 Supabase Auth에서 배선.

// 마이페이지 관리 리스트 projection — 관리에 필요한 필드만
export type MyJob = Pick<Job, "id" | "title" | "status" | "featuredTier" | "postedAt" | "deadline">;

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return mock.getCurrentUser();
}

/** 내가 등록한 공고 — 운영자 등록 공고(owner 없음)는 포함되지 않는다 (가드레일 #2) */
export async function getOwnedJobs(userId: string): Promise<MyJob[]> {
  return mock.getOwnedJobs(userId);
}

/** 수정 화면용 공고 — 소유권 불일치(남의 공고·운영자 공고)는 null → notFound */
export async function getEditableJob(id: string, userId: string): Promise<Job | null> {
  return mock.getEditableJob(id, userId);
}
