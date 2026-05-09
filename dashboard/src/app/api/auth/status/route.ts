import { NextResponse } from "next/server";
import { isPasswordSetup } from "@/lib/auth";

export async function GET() {
  try {
    const setupRequired = !(await isPasswordSetup());
    return NextResponse.json({ setupRequired });
  } catch {
    return NextResponse.json(
      { error: "Failed to check auth status" },
      { status: 500 }
    );
  }
}
