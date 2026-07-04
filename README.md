# MinJob (민잡)

흩어진 **부교역자(부목사·전도사) 청빙 공고**를 한곳에 모아 교단·지역·사례비로 검색·비교하는 채용 플랫폼.

> 문서 — 아키텍처·컨벤션·가드레일 [`CLAUDE.md`](./CLAUDE.md) · 기획 [`docs/SPEC.md`](./docs/SPEC.md) · 데이터 [`docs/DATA.md`](./docs/DATA.md) · 작업 [`docs/ROADMAP.md`](./docs/ROADMAP.md)

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

- **`.env` 단일 파일만 사용** (gitignored). `.env.local`·`.env.production` 등은 만들지 않는다.
- 골격 단계라 현재 필요한 시크릿 없음. **Supabase 연동(Phase 1)** 시 `.env`에 추가:
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  ```
  (`NEXT_PUBLIC_*`만 클라이언트 노출. `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 시크릿.)
- 배포(Vercel)는 대시보드 env 사용. 로컬로 당길 땐 `vercel env pull .env`.

## 구조 / 컨벤션

디렉토리·계층 책임·`'use cache'` 규칙·가드레일은 [`CLAUDE.md`](./CLAUDE.md) 참조.

## Git

- 브랜치: `prod`(배포·안정) / `dev`(개발·작업). 작업은 `dev`, 릴리스는 `dev → prod` (fast-forward only).
- commit/push/merge는 명시적으로 필요할 때만.
