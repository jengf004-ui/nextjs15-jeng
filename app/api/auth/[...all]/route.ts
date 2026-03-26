// @ts-expect-error - auth module has implicit 'any' type
export const runtime = 'edge';
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let handler: Record<string, any>;

try {
  // @ts-ignore
  handler = toNextJsHandler(auth);
  console.log("✓ Better Auth route handler created successfully");
} catch (error: unknown) {
  console.error("✗ Failed to create route handler:", error instanceof Error ? error.message : error);
  throw error;
}

// ... ส่วนที่เหลือของโค้ดคุณใช้ได้เหมือนเดิมเลยครับ ...

// Wrap the handlers with error logging
const POST = handler.POST
  ? async (req: NextRequest) => {
      console.log(`📝 Auth POST Request: ${req.url}`);
      console.log(`   Headers: ${JSON.stringify(Object.fromEntries(req.headers), null, 2)}`);
      try {
        const response = await handler.POST(req);
        console.log(`✓ Auth POST Success: ${response.status}`);
        return response;
      } catch (error) {
        console.error(`✗ Auth POST Error:`, error);
        return NextResponse.json(
          { error: "Authentication error", details: error instanceof Error ? error.message : undefined },
          { status: 500 }
        );
      }
    }
  : undefined;

const GET = handler.GET
  ? async (req: NextRequest) => {
      console.log(`📖 Auth GET Request: ${req.url}`);
      try {
        const response = await handler.GET(req);
        console.log(`✓ Auth GET Success: ${response.status}`);
        return response;
      } catch (error) {
        console.error(`✗ Auth GET Error:`, error);
        return NextResponse.json(
          { error: "Authentication error", details: error instanceof Error ? error.message : undefined },
          { status: 500 }
        );
      }
    }
  : undefined;

export { POST, GET };
