import type { NextConfig } from "next";

// Origin of the FastAPI backend. Defaults to the local dev server; set
// BACKEND_ORIGIN in .env.local to run this frontend against a deployed API
// (e.g. the EC2 instance) without changing any committed config.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // Proxy the API through this origin instead of letting the browser call the
  // backend directly. Auth is httpOnly cookies (app/core/cookies.py), and the
  // backend sets them Secure + SameSite=Lax in production — a cookie with
  // those flags is dropped on a cross-site XHR to a plain-http host, so
  // pointing NEXT_PUBLIC_API_URL straight at the instance logs in with a 200
  // and then 401s on every following request. Routing through localhost:3000
  // keeps the cookie first-party, and localhost counts as a secure context so
  // the Secure flag is honored.
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND_ORIGIN}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
