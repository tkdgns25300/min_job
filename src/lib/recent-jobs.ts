import { STORAGE_KEYS } from "@/constants/storage";

// localStorage 기반 최근 본 공고 (로그인 불필요). 상세 진입 시 기록,
// /jobs 우측 레일·검색 오버레이가 읽는다. 계정 데이터는 Phase 1에서 Supabase 이관 예정.
export interface RecentJob {
  id: string;
  title: string;
  subtitle?: string; // "교회명 · 지역" (구버전 기록엔 없을 수 있어 optional)
}

const MAX = 10;

export function readRecentJobs(): RecentJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.recentJobs);
    return raw ? (JSON.parse(raw) as RecentJob[]) : [];
  } catch {
    return [];
  }
}

export function addRecentJob(job: RecentJob): void {
  try {
    const next = [job, ...readRecentJobs().filter((it) => it.id !== job.id)].slice(0, MAX);
    localStorage.setItem(STORAGE_KEYS.recentJobs, JSON.stringify(next));
  } catch {
    // 저장 실패 무시 (프라이빗 모드 등)
  }
}
