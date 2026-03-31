import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile, writeFile, stat } from "fs/promises";
import { join, resolve } from "path";

// Project root inside the container
const PROJECT_ROOT = process.env.PROJECT_ROOT || "/app";

// Prevent path traversal
function safePath(requestedPath: string): string | null {
  const resolved = resolve(PROJECT_ROOT, requestedPath);
  if (!resolved.startsWith(PROJECT_ROOT)) return null;
  return resolved;
}

// GET — read a file or list directory
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path") || "";
  const resolved = safePath(path);

  if (!resolved) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const stats = await stat(resolved);

    if (stats.isDirectory()) {
      const entries = await readdir(resolved, { withFileTypes: true });
      const items = entries
        .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
        .map((e) => ({
          name: e.name,
          type: e.isDirectory() ? "directory" : "file",
        }));
      return NextResponse.json({ type: "directory", path, items });
    }

    // Limit file reads to 500KB
    if (stats.size > 500 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 500KB)" },
        { status: 413 }
      );
    }

    const content = await readFile(resolved, "utf-8");
    return NextResponse.json({ type: "file", path, content });
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST — write a file
export async function POST(req: NextRequest) {
  try {
    const { path, content } = await req.json();

    if (!path || content === undefined) {
      return NextResponse.json(
        { error: "path and content required" },
        { status: 400 }
      );
    }

    const resolved = safePath(path);
    if (!resolved) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Block writing to sensitive files
    const blocked = [".env", ".env.docker", "prisma/schema.prisma"];
    if (blocked.some((b) => path.includes(b))) {
      return NextResponse.json(
        { error: "Cannot modify protected files" },
        { status: 403 }
      );
    }

    await writeFile(resolved, content, "utf-8");
    return NextResponse.json({ ok: true, path });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
