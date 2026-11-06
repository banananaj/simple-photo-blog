import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

// Issues short-lived client-upload tokens so the browser sends files straight to
// the Blob store (no 4.5 MB function-body limit). Reached only through the
// basic-auth gate in src/proxy.ts.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^[a-z0-9-]+\/(preview\.webp|full\.jpg)$/i.test(pathname)) {
          throw new Error("unexpected pathname");
        }
        return {
          allowedContentTypes: ["image/webp", "image/jpeg"],
          addRandomSuffix: false,
          allowOverwrite: true,
          maximumSizeInBytes: 60 * 1024 * 1024,
          cacheControlMaxAge: 31536000,
        };
      },
      onUploadCompleted: async () => {
        // Metadata is written by /admin/api/catalog once every file of a batch is up.
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
