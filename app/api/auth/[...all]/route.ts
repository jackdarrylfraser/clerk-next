import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/better-auth";
import { isPublicOnlyMode } from "@/lib/auth";

const handlers = toNextJsHandler(auth);

async function handleAuthRequest(
  request: Request,
  handler: (request: Request) => Promise<Response>,
): Promise<Response> {
  const isSignOut =
    request.method === "POST" &&
    new URL(request.url).pathname.endsWith("/sign-out");

  if (isPublicOnlyMode && !isSignOut) {
    return Response.json(
      { error: "Authentication is disabled while the site is public-only." },
      { status: 403 },
    );
  }

  return handler(request);
}

export function GET(request: Request): Promise<Response> {
  return handleAuthRequest(request, handlers.GET);
}

export function POST(request: Request): Promise<Response> {
  return handleAuthRequest(request, handlers.POST);
}
