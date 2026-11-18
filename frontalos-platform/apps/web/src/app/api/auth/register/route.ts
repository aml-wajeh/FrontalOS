/**
 * POST /api/auth/register
 *
 * Thin proxy to services/cortix-api's real POST /auth/register. Does NOT
 * log the user in automatically (no tokens come back from /auth/register —
 * only a created-user summary), so the register page sends people to
 * /login with a success toast rather than pretending to establish a
 * session here.
 *
 * Role-aware registration & why children are excluded:
 * VALID_ROLES on the backend (auth/router.py) includes "child", but this
 * route intentionally only offers parent / doctor / school / admin at the
 * register form (see the (auth)/register/page.tsx role selector and its
 * accompanying comment). A self-service "I am a child, sign me up" flow
 * would let a minor create an account, set their own password, and be
 * discoverable with no guardian ever in the loop — the same shape of risk
 * COPPA-style consent rules exist to prevent. Concretely: a child Patient
 * row here always carries a guardian_id / doctor_id (database/models/
 * clinical.py) that has to be filled in by whoever creates it, so a parent
 * or doctor provisions the child's account (and the linked Patient row)
 * from inside their own portal after they've registered and logged in
 * themselves — never the reverse.
 */
import { NextResponse } from "next/server";
import { cortixApiUrl } from "@/lib/auth/session";

// BUG FIX (staff audit follow-up): kept in sync with
// lib/validation/authSchemas.ts's REGISTERABLE_ROLES — "admin" is
// intentionally not self-registerable (see that file's comment and
// services/cortix-api/auth/router.py's SELF_REGISTERABLE_ROLES).
const REGISTERABLE_ROLES = new Set(["parent", "doctor", "school"]);

export async function POST(request: Request) {
  let body: { email?: string; password?: string; fullName?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }

  if (!body.email || !body.password || !body.fullName || !body.role) {
    return NextResponse.json({ detail: "All fields are required" }, { status: 400 });
  }
  if (!REGISTERABLE_ROLES.has(body.role)) {
    return NextResponse.json(
      { detail: "Child accounts must be created by a parent or doctor, not self-registered" },
      { status: 400 }
    );
  }

  const res = await fetch(`${cortixApiUrl()}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      full_name: body.fullName,
      role: body.role,
    }),
    cache: "no-store",
  });

  const responseBody = await res.json().catch(() => ({}));
  return NextResponse.json(responseBody, { status: res.status });
}
