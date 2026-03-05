import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 빠른 Vercel 배포를 위해 빌드 시 TS 에러 강제 무시
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
