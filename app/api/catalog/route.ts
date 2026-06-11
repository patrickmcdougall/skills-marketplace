import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";

// Cached like the browse page itself; the client fetches this once after
// hydration to enable filtering/search across the full catalog.
export const revalidate = 600;

export async function GET() {
  const catalog = await getCatalog();
  return NextResponse.json(catalog);
}
