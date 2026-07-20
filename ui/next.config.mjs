/** @type {import('next').NextConfig} */
const nextConfig = {
  // API routes spawn long-lived child processes (tshark, tail -F); nothing to tune here.
  reactStrictMode: false,
};

export default nextConfig;
