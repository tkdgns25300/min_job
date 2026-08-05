# MinJob (민잡)

흩어진 **교회 사역자 청빙 공고**(부목사·전도사 중심, 담임목사 포함)를 한곳에 모아, 구조화된 정보로 교단·지역·직분·부서로 검색·비교하는 채용 플랫폼.

> 문서 — 아키텍처·컨벤션·가드레일 [`CLAUDE.md`](./CLAUDE.md) · 기획 [`docs/SPEC.md`](./docs/SPEC.md) · 데이터 [`docs/DATA.md`](./docs/DATA.md) · 작업 [`docs/ROADMAP.md`](./docs/ROADMAP.md) · 시점 [`docs/SNAPSHOT.md`](./docs/SNAPSHOT.md)
>
> 🔗 **배포(mock)**: https://www.minjob.co.kr — **JSON 더미 데이터**로 동작(실 DB·백엔드는 Phase 1). NHN KCP 심사(가맹·카드사)는 2026-08-05 통과해 실카드결제가 열렸으나, 교회 멤버십 미배선으로 결제 경로에는 아직 도달할 수 없다. 정식 오픈 전까지 검색 색인 제외 예정.

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript strict · Tailwind v4 + shadcn/ui (Base UI) · Pretendard(self-host) · Supabase · Vercel · npm

## 요구 사항

- Node.js 20+
- npm

## 시작하기

```bash
npm install
npm run dev        # http://localhost:3000
```

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (Turbopack) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint |
| `npm run format` | Prettier 포맷 적용 |
| `npm run format:check` | 포맷 검사 |

## 환경 변수

- **`.env` 단일 파일만 사용** (gitignored). 템플릿 파일은 없다 — 아래 목록이 정본이다.
- **Supabase 값 3개는 필수**(2026-07-29 로그인 실전환 이후). 헤더가 매 요청 세션을 읽으므로 없으면 로그인은 물론 공개 페이지도 계속 "미로그인"으로만 렌더되고 서버 로그에 `[auth] 세션 조회 실패`가 쌓인다. 값 = Supabase 대시보드 > Settings > API:
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   # 공개 키(RLS 적용) — 구 anon
  SUPABASE_SECRET_KEY=                    # 비밀 키(RLS 우회) — 구 service_role, 서버 전용
  ```
  (`NEXT_PUBLIC_*`만 클라이언트 노출. `SUPABASE_SECRET_KEY`는 절대 노출 금지. secret은 아직 미사용 — DB 전환 시 cached read에 쓴다.)
- **운영자(admin) 계정** — `/admin/*`는 로그인 + 아래 목록에 이메일이 있어야 열린다. 쉼표로 여러 명 가능.
  ```
  ADMIN_EMAILS=me@example.com        # 구글 로그인에 쓰는 이메일
  ```
  ⚠️ **비어 있으면 아무도 접근 못 한다**(fail-closed — 설정 누락으로 admin이 열리는 것보다 안전). Vercel env에도 넣어야 배포본에서 열린다.
- **구글 로그인 선행 설정(사람이 콘솔에서)** — 코드만으로는 동작하지 않는다:
  1. Supabase > Authentication > Providers > **Google** 활성화 + Google Cloud OAuth 클라이언트의 Client ID/Secret 입력. 거기 표시된 **Callback URL**(`https://<ref>.supabase.co/auth/v1/callback`)을 Google Cloud > 사용자 인증 정보 > **승인된 리디렉션 URI**에 등록.
  2. Google Cloud > Google Auth Platform > **Audience**의 Publishing status를 `In production`으로(이름·이메일만 쓰므로 심사 없이 전환). `Testing`이면 등록된 테스트 사용자만 로그인된다.
  3. Supabase > Authentication > **URL Configuration**: Site URL + Redirect URLs에 **서비스에 쓰는 모든 오리진**을 등록 — `http://localhost:3000`, 운영 도메인, **Vercel 프리뷰 도메인까지**. 빠지면 로그인이 조용히 실패하고 화면엔 "로그인에 실패했어요"만 뜬다(원인은 서버 로그 `[auth] OAuth 시작 실패`).
  4. ⚠️ **로컬 로그인 테스트는 `npm run dev`로.** 세션 쿠키가 `secure`(production 한정)라 `npm run start`를 http로 띄우면 브라우저가 쿠키를 저장하지 않아 로그인이 완료되지 않는다.
- **노출 결제(PortOne V2 · KCP)** — `/mypage/church/promote` 결제에 필요. 미설정 시 결제 시도하면 안내만 뜬다(그 외 페이지는 정상). 값 = PortOne 콘솔 > 상점·채널·API Keys:
  ```
  NEXT_PUBLIC_PORTONE_STORE_ID=          # 공개 — 상점 ID(store-...)
  NEXT_PUBLIC_PORTONE_CHANNEL_KEY=       # 공개 — KCP 채널 키(channel-key-...)
  PORTONE_API_SECRET=                    # 서버 전용 — 결제 조회·검증용, 절대 노출 금지
  ```
- 배포(Vercel)는 대시보드 env 사용. 로컬로 당길 땐 `vercel env pull .env`.

## 구조 / 컨벤션

디렉토리·계층 책임·`'use cache'` 규칙·가드레일은 [`CLAUDE.md`](./CLAUDE.md) 참조.

## Git

- 브랜치: `prod`(배포·안정) / `dev`(개발·작업). 작업은 `dev`, 릴리스는 `dev → prod` (fast-forward only).
- commit/push/merge는 명시적으로 필요할 때만.
