import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

function isHttpUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function extractMetaTag(
  html: string,
  attr: "property" | "name",
  value: string
): string | null {
  const regex = new RegExp(
    `<meta[^>]+${attr}=["']${value}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const match = html.match(regex);
  return match?.[1] ?? null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

/*
 * GET /api/link-preview?url=...
 * 回傳：{ url, title, description, image, siteName }
 *
 * 之後可以在前端這樣使用：
 * const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  if (!isHttpUrl(url)) {
    return NextResponse.json(
      { error: "Only http/https URLs are allowed" },
      { status: 400 }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch url: ${res.status}` },
        { status: 400 }
      );
    }

    const html = await res.text();

    // 優先用 Open Graph
    const ogTitle = extractMetaTag(html, "property", "og:title");
    const ogDescription = extractMetaTag(
      html,
      "property",
      "og:description"
    );
    const ogImage = extractMetaTag(html, "property", "og:image");
    const ogSiteName = extractMetaTag(
      html,
      "property",
      "og:site_name"
    );

    // Fallback meta/標題
    const metaDescription =
      extractMetaTag(html, "name", "description") ?? undefined;
    const titleTag = extractTitle(html) ?? undefined;

    const title = ogTitle || titleTag || url;
    const description = ogDescription || metaDescription || "";
    const image = ogImage || undefined;
    const siteName = ogSiteName || undefined;

    return NextResponse.json(
      {
        url,
        title: title.slice(0, 200),
        description: description.slice(0, 500),
        image,
        siteName,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/link-preview] error:", err);
    return NextResponse.json(
      { error: "Failed to generate link preview" },
      { status: 500 }
    );
  }
}