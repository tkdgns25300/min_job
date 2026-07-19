# MinJob (민잡)

흩어진 **교회 사역자 청빙 공고**(부목사·전도사 중심, 담임목사 포함)를 한곳에 모아, 구조화된 정보로 교단·지역·직분·부서로 검색·비교하는 채용 플랫폼.

> 문서 — 아키텍처·컨벤션·가드레일 [`CLAUDE.md`](./CLAUDE.md) · 기획 [`docs/SPEC.md`](./docs/SPEC.md) · 데이터 [`docs/DATA.md`](./docs/DATA.md) · 작업 [`docs/ROADMAP.md`](./docs/ROADMAP.md) · 시점 [`docs/SNAPSHOT.md`](./docs/SNAPSHOT.md)
>
> 🔗 **배포(mock)**: https://min-job.vercel.app/ — NHN KCP 심사용, **JSON 더미 데이터**로 동작(실 DB·백엔드는 Phase 1). 정식 오픈 전까지 검색 색인 제외 예정.

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

- **`.env` 단일 파일만 사용** (gitignored). 템플릿은 [`.env.example`](./.env.example) — `cp .env.example .env` 후 값 채우기.
- 현재 배포는 **시크릿 없이 동작**(mock 데이터). **Supabase 클라이언트는 배선됨**(`lib/supabase/*`)이나 아직 **미사용**(데이터 mock). 연결하려면 `.env`(+Vercel env)에 아래를 채운다(값 = Supabase 대시보드 > Settings > API):
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   # 공개 키(RLS 적용) — 구 anon
  SUPABASE_SECRET_KEY=                    # 비밀 키(RLS 우회) — 구 service_role, 서버 전용
  ```
  (`NEXT_PUBLIC_*`만 클라이언트 노출. `SUPABASE_SECRET_KEY`는 절대 노출 금지.)
- 배포(Vercel)는 대시보드 env 사용. 로컬로 당길 땐 `vercel env pull .env`.

## 구조 / 컨벤션

디렉토리·계층 책임·`'use cache'` 규칙·가드레일은 [`CLAUDE.md`](./CLAUDE.md) 참조.

## Git

- 브랜치: `prod`(배포·안정) / `dev`(개발·작업). 작업은 `dev`, 릴리스는 `dev → prod` (fast-forward only).
- commit/push/merge는 명시적으로 필요할 때만.
