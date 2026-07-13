import type { CurrentUser } from "@/types/domain";

// ⚠️ mock 전용 인증 — 실 인증(Supabase Auth)은 Phase 1. 비밀번호는 평문(가짜 테스트 계정).
// 세션 = 비httpOnly 쿠키(mj_session=userId): authed 페이지는 서버(cookies())에서,
// 헤더 계정 위젯은 클라이언트(document.cookie)에서 읽는다 — 공개 페이지 'use cache'를 안 깨려는 절충.
// 이 모듈은 client-safe(서버 전용 import 없음) — 로그인 폼·헤더 위젯·getCurrentUser가 공유.
export const SESSION_COOKIE = "mj_session";

interface MockAccount extends CurrentUser {
  password: string;
}

// 테스트 계정 (비번 공통: test1234)
const ACCOUNTS: MockAccount[] = [
  {
    id: "user-saebyeok",
    email: "test1@test.com", // 인증된 계정
    password: "test1234",
    name: "이도현", // 이름만(SNS 닉네임/가입 입력) — 직분은 가입 시 안 받음. 개인이자 새벽빛교회 인증 담당자
    churchId: "ch-saebyeok",
    churchName: "새벽빛교회",
    churchVerificationStatus: "APPROVED",
  },
  {
    id: "user-seeker",
    email: "test2@test.com", // 미인증 계정(순수 사역자)
    password: "test1234",
    name: "박서연", // 순수 사역자(교회 인증 없음)
    churchId: null,
    churchName: null,
    churchVerificationStatus: null,
  },
];

/** 이메일·비번 검증 → 성공 시 userId, 실패 시 null */
export function authenticate(email: string, password: string): string | null {
  const acc = ACCOUNTS.find(
    (a) => a.email === email.trim().toLowerCase() && a.password === password,
  );
  return acc ? acc.id : null;
}

/** userId → CurrentUser(비밀번호 제외). 없으면 null */
export function getAccount(id: string | null | undefined): CurrentUser | null {
  if (!id) return null;
  const a = ACCOUNTS.find((x) => x.id === id);
  if (!a) return null;
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    churchId: a.churchId,
    churchName: a.churchName,
    churchVerificationStatus: a.churchVerificationStatus,
  };
}
