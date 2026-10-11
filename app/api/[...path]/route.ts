import { handle } from "@/lib/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function route(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return handle(request, path.join("/"));
}
export { route as GET, route as POST };

export async function HEAD(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return route(new Request(request, { method: "GET" }), context);
}
export { route as PUT, route as PATCH, route as DELETE, route as OPTIONS };
