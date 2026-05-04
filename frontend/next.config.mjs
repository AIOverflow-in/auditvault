/** @type {import('next').NextConfig} */
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  // Same-origin proxy for every browser-side call to the Go API.
  //
  // Why: the av_session cookie is set on the Vercel host, so a direct
  // cross-origin fetch from the browser to Render cannot carry it — we'd
  // 401 every interactive action ("unauthenticated" was exactly the error
  // the customer saw on Add Ship). Routing through /api/backend/* keeps
  // the request same-origin to the browser; Vercel rewrites the underlying
  // destination to Render and the Cookie header rides along untouched.
  // Server components keep using NEXT_PUBLIC_API_URL directly because they
  // run in Node and have first-class access to the cookie via cookies().
  async rewrites() {
    return [
      { source: '/api/backend/:path*', destination: `${apiOrigin}/:path*` },
    ];
  },
};

export default nextConfig;
