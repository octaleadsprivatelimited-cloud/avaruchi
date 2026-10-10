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
