import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type PortalKind = "parent" | "student";

export type PortalClaimStatus =
  | "already_claimed"
  | "ambiguous"
  | "failed"
  | "linked"
  | "no_match"
  | "unauthenticated";

type AuthClaims = {
  email?: string;
  sub: string;
};

type PortalLink = {
  auth_user_id: string | null;
  branch_id: string;
  email: string;
  id: string;
  institute_id: string;
  status: PortalClaimStatus | "disabled" | "pending";
  student_id: string;
};

type ParentPortalLink = PortalLink & {
  parent_name: string | null;
  phone: string | null;
  relationship: string | null;
};

export type PortalStudent = {
  archived_at: string | null;
  branch_id: string;
  full_name: string;
  id: string;
  institute_id: string;
  parent_email: string | null;
  parent_phone: string | null;
  phone: string | null;
  status: string | null;
  student_email: string | null;
};

export type PortalContext = {
  claims: AuthClaims;
  kind: PortalKind;
  links: Array<PortalLink | ParentPortalLink>;
  status: PortalClaimStatus;
  students: PortalStudent[];
  supabase: Awaited<ReturnType<typeof createClient>>;
};

function getPortalPath(kind: PortalKind) {
  return `/portal/${kind}`;
}

export function getPortalStatusMessage(kind: PortalKind, status: PortalClaimStatus) {
  if (status === "ambiguous") {
    return "We could not safely link this account. Please contact your institute to confirm portal access.";
  }

  if (status === "already_claimed") {
    return "This portal access has already been linked to another account. Please contact your institute.";
  }

  if (status === "failed") {
    return "Portal access is unavailable right now. Please try again later.";
  }

  if (status === "no_match") {
    return kind === "student"
      ? "No student portal access has been assigned to this email."
      : "No parent portal access has been assigned to this email.";
  }

  if (status === "unauthenticated") {
    return "Sign in to access your portal.";
  }

  return "";
}

async function claimPortalAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: PortalKind,
): Promise<PortalClaimStatus> {
  const rpcName =
    kind === "student"
      ? "claim_student_portal_link_result"
      : "claim_parent_portal_links_result";
  const { data, error } = await supabase.rpc(rpcName);

  if (error) {
    console.error("portal claim failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      kind,
      message: error.message,
    });

    return "failed";
  }

  if (
    data === "already_claimed" ||
    data === "ambiguous" ||
    data === "linked" ||
    data === "no_match" ||
    data === "unauthenticated"
  ) {
    return data;
  }

  return "failed";
}

async function getPortalLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: PortalKind,
  userId: string,
) {
  if (kind === "student") {
    const { data, error } = await supabase
      .from("student_portal_links")
      .select("id, student_id, institute_id, branch_id, auth_user_id, email, status")
      .eq("auth_user_id", userId)
      .eq("status", "linked")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("student portal link lookup failed", error);
      return [];
    }

    return (data ?? []) as PortalLink[];
  }

  const { data, error } = await supabase
    .from("parent_portal_links")
    .select(
      "id, student_id, institute_id, branch_id, auth_user_id, email, status, parent_name, phone, relationship",
    )
    .eq("auth_user_id", userId)
    .eq("status", "linked")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("parent portal link lookup failed", error);
    return [];
  }

  return (data ?? []) as ParentPortalLink[];
}

export async function getPortalContext(kind: PortalKind): Promise<PortalContext> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as AuthClaims | undefined;

  if (error || !claims) {
    redirect(`/login?next=${encodeURIComponent(getPortalPath(kind))}`);
  }

  const status = await claimPortalAccess(supabase, kind);
  const links = await getPortalLinks(supabase, kind, claims.sub);
  const studentIds = Array.from(new Set(links.map((link) => link.student_id)));
  let students: PortalStudent[] = [];

  if (studentIds.length) {
    const { data: studentRows, error: studentsError } = await supabase
      .from("students")
      .select(
        "id, institute_id, branch_id, full_name, student_email, phone, parent_email, parent_phone, status, archived_at",
      )
      .in("id", studentIds)
      .order("full_name", { ascending: true });

    if (studentsError) {
      console.error("portal student lookup failed", studentsError);
    } else {
      students = (studentRows ?? []) as PortalStudent[];
    }
  }

  return {
    claims,
    kind,
    links,
    status: links.length ? "linked" : status,
    students,
    supabase,
  };
}
