/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Bu klasörü proje köküne sabitle (üst dizindeki başka lockfile uyarısını önler)
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
