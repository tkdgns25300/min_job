import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (PPR) 활성화 — 'use cache'/cacheTag/cacheLife 사용 (CLAUDE 아키텍처)
  cacheComponents: true,
};

export default nextConfig;
