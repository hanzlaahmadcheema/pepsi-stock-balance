import type { NextConfig } from "next";

const isCloud =
  process.env.APP_ENV === "CLOUD_PROD" ||
  process.env.APP_ENV === "CLOUD_DEV" ||
  process.env.APP_ENV === "CLOUD" ||
  process.env.NEXT_PUBLIC_APP_ENV === "CLOUD" ||
  process.env.NEXT_PUBLIC_APP_ENV === "CLOUD_PROD" ||
  process.env.NEXT_PUBLIC_APP_ENV === "CLOUD_DEV" ||
  process.env.IS_CLOUD === "true" ||
  process.env.NEXT_PUBLIC_IS_CLOUD === "true" ||
  Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.100.143", "localhost:3000"],
  env: {
    NEXT_PUBLIC_IS_CLOUD: isCloud ? "true" : "false",
    NEXT_PUBLIC_APP_ENV: process.env.APP_ENV || (isCloud ? "CLOUD_PROD" : "LOCAL"),
  },
};

export default nextConfig;

