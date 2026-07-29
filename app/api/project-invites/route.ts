import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type InviteRequestBody = {
  email?: unknown;
  projectId?: unknown;
};

type InviteRow = {
  id: string;
  project_id: string;
  invited_email: string;
  token: string;
  status: "pending" | "accepted" | "revoked";
  created_at: string;
  accepted_at: string | null;
};

type InviteDelivery = "transactional_email" | "supabase_invite" | "manual_link";

type ProjectRow = {
  id: string;
  kind: "personal" | "team";
  name: string;
  owner_id: string;
};

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function cleanEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function getSupabaseEnv() {
  return {
    serviceRoleKey: cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY),
    url: cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
  };
}

function getBaseUrl(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    return siteUrl.replace(/\/+$/, "");
  }

  const origin = request.headers.get("origin") ?? request.nextUrl.origin;
  return origin.replace(/\/+$/, "");
}

function getInviteUrl(baseUrl: string, token: string) {
  return `${baseUrl}/app?invite=${encodeURIComponent(token)}`;
}

function getInviteRedirectUrl(baseUrl: string, token: string) {
  return `${baseUrl}/auth/callback?next=${encodeURIComponent(
    `/app?invite=${token}`,
  )}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeErrorMessage(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = JSON.parse(trimmed) as { message?: unknown; error?: unknown };
    if (typeof parsed.message === "string") {
      return parsed.message;
    }
    if (typeof parsed.error === "string") {
      return parsed.error;
    }
  } catch {
    // The upstream response was plain text.
  }

  return trimmed;
}

async function sendResendInviteEmail({
  email,
  inviteUrl,
  projectName,
}: {
  email: string;
  inviteUrl: string;
  projectName: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL;

  if (!apiKey || !from) {
    return false;
  }

  const escapedProjectName = escapeHtml(projectName);
  const escapedInviteUrl = escapeHtml(inviteUrl);
  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from,
      html: [
        `<p>You have been invited to join <strong>${escapedProjectName}</strong> on Tockli.</p>`,
        "<p>You will join as a read-only project member.</p>",
        `<p><a href="${escapedInviteUrl}">Accept the project invite</a></p>`,
        `<p>If the button does not work, paste this link into your browser:<br>${escapedInviteUrl}</p>`,
      ].join(""),
      subject: `Join ${projectName} on Tockli`,
      text: [
        `You have been invited to join ${projectName} on Tockli.`,
        "You will join as a read-only project member.",
        "",
        "Accept the project invite:",
        inviteUrl,
      ].join("\n"),
      to: [email],
    }),
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      normalizeErrorMessage(detail) ||
        `Resend rejected the invite email with status ${response.status}.`,
    );
  }

  return true;
}

export async function POST(request: NextRequest) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { serviceRoleKey, url } = getSupabaseEnv();
  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "Project invite email delivery is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 },
    );
  }

  let body: InviteRequestBody;
  try {
    body = (await request.json()) as InviteRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid invite request." }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";

  if (!emailPattern.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!uuidPattern.test(projectId)) {
    return NextResponse.json({ error: "Project could not be found." }, { status: 400 });
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(accessToken);

  if (userError || !user) {
    return NextResponse.json(
      { error: "Your session could not be verified. Sign out and log in again." },
      { status: 401 },
    );
  }

  const { data: projectData, error: projectError } = await adminClient
    .from("projects")
    .select("id,kind,name,owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  const project = projectData as ProjectRow | null;
  if (!project) {
    return NextResponse.json({ error: "Project could not be found." }, { status: 404 });
  }

  if (project.owner_id !== user.id) {
    return NextResponse.json(
      { error: "Only the project admin can invite team members." },
      { status: 403 },
    );
  }

  if (project.kind !== "team") {
    return NextResponse.json(
      { error: "Only shared projects can have team members." },
      { status: 400 },
    );
  }

  if (normalizeEmail(user.email) === email) {
    return NextResponse.json(
      { error: "You are already the project admin." },
      { status: 409 },
    );
  }

  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile?.id) {
    const { data: existingMember } = await adminClient
      .from("project_members")
      .select("user_id")
      .eq("project_id", project.id)
      .eq("user_id", existingProfile.id)
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json(
        { error: "That person is already on the project." },
        { status: 409 },
      );
    }
  }

  const { data: inviteData, error: insertError } = await adminClient
    .from("project_invitations")
    .insert({
      invited_by: user.id,
      invited_email: email,
      project_id: project.id,
      role: "viewer",
    })
    .select("id,project_id,invited_email,token,status,created_at,accepted_at")
    .single();

  let invite = inviteData as InviteRow | null;

  if (insertError) {
    const { data: existingInvite, error: existingInviteError } = await adminClient
      .from("project_invitations")
      .select("id,project_id,invited_email,token,status,created_at,accepted_at")
      .eq("project_id", project.id)
      .eq("invited_email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInviteError || !existingInvite) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    invite = existingInvite as InviteRow;
  }

  if (!invite) {
    return NextResponse.json(
      { error: "Project invite could not be created." },
      { status: 500 },
    );
  }

  const baseUrl = getBaseUrl(request);
  const inviteUrl = getInviteUrl(baseUrl, invite.token);
  const redirectTo = getInviteRedirectUrl(baseUrl, invite.token);

  try {
    const sentWithResend = await sendResendInviteEmail({
      email,
      inviteUrl,
      projectName: project.name,
    });

    if (!sentWithResend) {
      const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            invite_project: project.name,
            project_invite_token: invite.token,
          },
          redirectTo,
        },
      );

      if (inviteError) {
        throw new Error(inviteError.message);
      }
    }

    const delivery: InviteDelivery = sentWithResend
      ? "transactional_email"
      : "supabase_invite";

    return NextResponse.json({
      delivery,
      invitation: invite,
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Project invite email could not be sent.";
    return NextResponse.json({
      delivery: "manual_link" satisfies InviteDelivery,
      deliveryError: `${detail} Verify INVITE_FROM_EMAIL in Resend, or copy the invite link manually.`,
      invitation: invite,
    });
  }
}
