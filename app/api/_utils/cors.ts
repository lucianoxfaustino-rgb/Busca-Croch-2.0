import { NextResponse } from "next/server";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function okJSON(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS as any });
}

export function noContent() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS as any });
}
