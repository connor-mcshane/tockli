"use client";

import {
  Archive,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  FileText,
  FolderKanban,
  Gauge,
  Hash,
  ListChecks,
  LogIn,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Palette,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Tag,
  TimerReset,
  Trash2,
  UserPlus,
  Users,
  UserCircle,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { trackEvent } from "@/lib/analytics";
import { calculateFocusScoreTrend } from "@/lib/focus-score.mjs";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  buildRecentActivityDates,
  moveTaskWithCompletion,
  reorderTaskInList,
  resolveActiveProjectId,
  resolveSelectedTaskId,
  taskIdsAffectedByColumnDeletion,
  taskMatchesSearch,
} from "@/lib/workspace-ui.mjs";

type View = "board" | "timer" | "analytics" | "settings";
type PlanTier = "free" | "pro";
type ProjectKind = "personal" | "team";
type ProjectRole = "owner" | "editor" | "viewer";
type ProjectMemberAccessRole = Exclude<ProjectRole, "owner">;
type ProjectInviteStatus = "pending" | "accepted";
type ProjectInviteDelivery =
  | "transactional_email"
  | "supabase_invite"
  | "manual_link";
type ThemeMode = "light" | "dark";
type TaskStatus = string;
type Priority = "low" | "medium" | "high";
type FocusSound =
  | "brown_noise"
  | "rain"
  | "heavy_rain"
  | "ocean_waves"
  | "thunderstorm"
  | "pulse"
  | "clock_tick";
type CancellationReason =
  | "interrupted"
  | "wrong_task"
  | "need_break"
  | "other";

type Project = {
  id: string;
  ownerId?: string;
  name: string;
  description: string;
  kind: ProjectKind;
  color: string;
  members: number;
  memberEmails?: string[];
  currentUserRole: ProjectRole;
  teamMembers: ProjectMember[];
  pendingInvites: ProjectInvite[];
  columns: BoardColumn[];
};

type ProjectMember = {
  id: string;
  name: string;
  email: string;
  role: ProjectRole;
  joinedAt?: string;
};

type ProjectInvite = {
  id: string;
  email: string;
  token: string;
  role: ProjectMemberAccessRole;
  status: ProjectInviteStatus;
  invitedAt: string;
  acceptedAt?: string;
};

type ProjectDialogMode = "create" | "edit";

type ProjectDialogState = {
  mode: ProjectDialogMode;
  projectId?: string;
  kind?: ProjectKind;
};

type ProjectDialogValues = {
  name: string;
  description: string;
  kind: ProjectKind;
  color: string;
  inviteRole: ProjectMemberAccessRole;
  inviteEmails: string[];
  memberRoles: Record<string, ProjectMemberAccessRole>;
  retainedMemberIds: string[];
  retainedInviteIds: string[];
};

type BoardColumn = {
  id: TaskStatus;
  title: string;
  isDone?: boolean;
  archived?: boolean;
};

type TaskCategory = {
  id: string;
  projectId: string;
  name: string;
  color: string;
};

type SubTask = {
  id: string;
  title: string;
  done: boolean;
};

type TaskComment = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  estimate: number;
  spent: number;
  priority: Priority;
  tags: string[];
  categoryId: string | null;
  subtasks: SubTask[];
  comments: TaskComment[];
  due: string;
  completedAt?: string | null;
};

type FocusSession = {
  id: string;
  userId?: string;
  projectId: string;
  taskId: string | null;
  minutes: number;
  completedAt: string;
  note: string;
};

type PomodoroCancellation = {
  id: string;
  userId?: string;
  projectId: string;
  taskId: string | null;
  durationMinutes: number;
  elapsedMinutes: number;
  reason: CancellationReason;
  cancelledAt: string;
  note: string;
};

type UserSettings = {
  focusMinutes: number;
  breakMinutes: number;
  dailyPomodoroGoal: number;
  workingDays: string[];
  strictMode: boolean;
  soundEnabled: boolean;
  focusSound: FocusSound;
  focusVolume: number;
  showNextUp: boolean;
  themeMode: ThemeMode;
};

type StoredState = {
  projects: Project[];
  categories?: TaskCategory[];
  tasks: Task[];
  sessions: FocusSession[];
  cancellations?: PomodoroCancellation[];
  settings: UserSettings;
  activeProjectId: string;
  selectedTaskId: string;
  focusTaskId?: string;
  onboardingCompleted?: boolean;
  sourceTabId?: string;
  updatedAt?: string;
};

const STORAGE_KEY = "tockli.mvp.v1";
const LEGACY_STORAGE_KEY = "flowtimer.mvp.v1";
const STORAGE_MIGRATION_KEY = "tockli.mvp.v1.user-scoped";
const TIMER_SYNC_INTERVAL_MS = 500;
const currentUser = {
  id: "current-user",
  name: "Connor McShane",
  email: "connor@tockli.local",
};

function readUserMetadata(user: User | null, key: string) {
  const value = user?.user_metadata?.[key];
  return typeof value === "string" ? value : "";
}

const initialProjects: Project[] = [
  {
    id: "project-deep-work",
    ownerId: currentUser.id,
    name: "Deep Work",
    description: "A personal space for focused work.",
    kind: "personal",
    color: "#ff005e",
    members: 1,
    currentUserRole: "owner",
    teamMembers: [
      {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: "owner",
      },
    ],
    pendingInvites: [],
    columns: createDefaultBoardColumns(),
  },
  {
    id: "project-launch",
    ownerId: currentUser.id,
    name: "Launch Crew",
    description: "A shared board for lightweight collaboration.",
    kind: "team",
    color: "#25a565",
    members: 2,
    currentUserRole: "owner",
    teamMembers: [
      {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: "owner",
      },
      {
        id: "launch-readonly-user",
        name: "Launch reviewer",
        email: "reviewer@tockli.local",
        role: "viewer",
      },
    ],
    pendingInvites: [],
    columns: createDefaultBoardColumns(),
  },
];

const initialCategories: TaskCategory[] = [
  {
    id: "category-writing",
    projectId: "project-deep-work",
    name: "Writing",
    color: "#ff005e",
  },
  {
    id: "category-design",
    projectId: "project-deep-work",
    name: "Design",
    color: "#2f6fed",
  },
  {
    id: "category-backend",
    projectId: "project-deep-work",
    name: "Backend",
    color: "#25a565",
  },
  {
    id: "category-review",
    projectId: "project-deep-work",
    name: "Review",
    color: "#b77900",
  },
  {
    id: "category-launch",
    projectId: "project-launch",
    name: "Launch",
    color: "#25a565",
  },
  {
    id: "category-copy",
    projectId: "project-launch",
    name: "Copy",
    color: "#7c5cff",
  },
];

const initialTasks: Task[] = [
  {
    id: "task-positioning",
    projectId: "project-deep-work",
    title: "Draft product positioning notes",
    description: "Clarify the promise for casual focus users.",
    status: "todo",
    estimate: 50,
    spent: 10,
    priority: "high",
    tags: ["writing", "strategy"],
    categoryId: "category-writing",
    subtasks: [
      { id: "subtask-positioning-1", title: "Draft opening promise", done: true },
      { id: "subtask-positioning-2", title: "Trim value props", done: false },
    ],
    comments: [
      {
        id: "comment-positioning-1",
        authorId: "current-user",
        authorName: "Connor McShane",
        body: "The casual-user language should stay clear and direct.",
        createdAt: "2026-07-24T09:15:00.000Z",
      },
    ],
    due: "Today",
  },
  {
    id: "task-wireframes",
    projectId: "project-deep-work",
    title: "Review timer and board wireframes",
    description: "Keep the first screen product-first.",
    status: "active",
    estimate: 75,
    spent: 35,
    priority: "medium",
    tags: ["design"],
    categoryId: "category-design",
    subtasks: [
      { id: "subtask-wireframes-1", title: "Check mobile board density", done: true },
      { id: "subtask-wireframes-2", title: "Review timer notes layout", done: false },
    ],
    comments: [],
    due: "Tomorrow",
  },
  {
    id: "task-supabase",
    projectId: "project-deep-work",
    title: "Map Supabase tables and RLS policies",
    description: "Personal projects now, shared project path later.",
    status: "todo",
    estimate: 50,
    spent: 0,
    priority: "medium",
    tags: ["backend"],
    categoryId: "category-backend",
    subtasks: [
      { id: "subtask-supabase-1", title: "List tables", done: true },
      { id: "subtask-supabase-2", title: "Verify RLS policies", done: false },
    ],
    comments: [],
    due: "Fri",
  },
  {
    id: "task-report",
    projectId: "project-deep-work",
    title: "Summarize the week of focus sessions",
    description: "Daily review is more useful than vanity stats.",
    status: "done",
    completedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    estimate: 25,
    spent: 25,
    priority: "low",
    tags: ["review"],
    categoryId: "category-review",
    subtasks: [
      { id: "subtask-report-1", title: "Collect focus totals", done: true },
      { id: "subtask-report-2", title: "Write summary", done: true },
    ],
    comments: [],
    due: "Done",
  },
  {
    id: "task-shared-plan",
    projectId: "project-launch",
    title: "Plan the shared launch checklist",
    description: "One team project is included on the free plan.",
    status: "active",
    estimate: 50,
    spent: 20,
    priority: "high",
    tags: ["shared", "launch"],
    categoryId: "category-launch",
    subtasks: [
      { id: "subtask-shared-plan-1", title: "Outline milestones", done: true },
      { id: "subtask-shared-plan-2", title: "Assign next owner", done: false },
    ],
    comments: [
      {
        id: "comment-shared-plan-1",
        authorId: "focus-friend",
        authorName: "Focus Friend",
        body: "I added the launch milestones. The invite copy can follow next.",
        createdAt: "2026-07-24T08:40:00.000Z",
      },
      {
        id: "comment-shared-plan-2",
        authorId: "current-user",
        authorName: "Connor McShane",
        body: "Great, I’ll review the owner assignments this afternoon.",
        createdAt: "2026-07-24T09:05:00.000Z",
      },
    ],
    due: "Today",
  },
  {
    id: "task-invite-copy",
    projectId: "project-launch",
    title: "Write invite copy for collaborators",
    description: "Keep collaboration language light and personal.",
    status: "todo",
    estimate: 25,
    spent: 0,
    priority: "medium",
    tags: ["copy"],
    categoryId: "category-copy",
    subtasks: [
      { id: "subtask-invite-copy-1", title: "Draft first pass", done: false },
    ],
    comments: [],
    due: "Thu",
  },
];

function createDemoSessions(referenceTime = Date.now()): FocusSession[] {
  return [
    {
      id: "session-1",
      projectId: "project-deep-work",
      taskId: "task-wireframes",
      minutes: 25,
      completedAt: new Date(referenceTime).toISOString(),
      note: "Refined the timer layout.",
    },
    {
      id: "session-2",
      projectId: "project-deep-work",
      taskId: "task-positioning",
      minutes: 25,
      completedAt: new Date(referenceTime - 86400000).toISOString(),
      note: "Tightened product story.",
    },
    {
      id: "session-3",
      projectId: "project-launch",
      taskId: "task-shared-plan",
      minutes: 50,
      completedAt: new Date(referenceTime - 86400000 * 2).toISOString(),
      note: "Built the shared launch outline.",
    },
    {
      id: "session-4",
      projectId: "project-deep-work",
      taskId: "task-report",
      minutes: 25,
      completedAt: new Date(referenceTime - 86400000 * 3).toISOString(),
      note: "Closed out report draft.",
    },
  ];
}

const initialSettings: UserSettings = {
  focusMinutes: 25,
  breakMinutes: 5,
  dailyPomodoroGoal: 6,
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  strictMode: false,
  soundEnabled: true,
  focusSound: "brown_noise",
  focusVolume: 100,
  showNextUp: false,
  themeMode: "light",
};

const focusSoundLabels: Record<FocusSound, string> = {
  brown_noise: "Brown noise",
  heavy_rain: "Heavy rain",
  clock_tick: "Old clock",
  ocean_waves: "Beach waves",
  pulse: "Low pulse",
  rain: "Soft rain",
  thunderstorm: "Thunderstorm",
};
const focusSoundOptions: FocusSound[] = [
  "brown_noise",
  "clock_tick",
  "rain",
  "heavy_rain",
  "ocean_waves",
  "thunderstorm",
  "pulse",
];
const focusSoundDescriptions: Record<FocusSound, string> = {
  brown_noise: "A low, steady blanket of sound for deep work.",
  clock_tick: "A warm mechanical tick with a quiet wooden body.",
  heavy_rain: "Dense rain with a soft, shifting room tone.",
  ocean_waves: "Slow beach swells with a light wash of foam.",
  pulse: "A restrained low-frequency pulse.",
  rain: "A gentle, close rain texture.",
  thunderstorm: "Distant rain and occasional low thunder.",
};

const cancellationReasonLabels: Record<CancellationReason, string> = {
  interrupted: "I was interrupted",
  wrong_task: "I picked the wrong task",
  need_break: "I need a break",
  other: "Something else",
};

const categoryColorOptions = [
  "#ff005e",
  "#25a565",
  "#2f6fed",
  "#b77900",
  "#7c5cff",
  "#e05d2f",
];
const projectColorOptions = categoryColorOptions;

const planLabels: Record<PlanTier, string> = {
  free: "Free",
  pro: "Pro",
};

const projectRoleLabels: Record<ProjectRole, string> = {
  owner: "Admin",
  editor: "Editor",
  viewer: "Read-only",
};
const memberAccessOptions: ProjectMemberAccessRole[] = ["editor", "viewer"];

function createDefaultBoardColumns(): BoardColumn[] {
  return [
    { id: "todo", title: "To do" },
    { id: "active", title: "Doing" },
    { id: "done", title: "Done", isDone: true },
  ];
}

const navItems: Array<{ id: View; label: string; icon: typeof FolderKanban }> = [
  { id: "board", label: "Board", icon: FolderKanban },
  { id: "timer", label: "Focus Timer", icon: Clock3 },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekdayLabels: Record<string, string> = {
  Fri: "Friday",
  Mon: "Monday",
  Sat: "Saturday",
  Sun: "Sunday",
  Thu: "Thursday",
  Tue: "Tuesday",
  Wed: "Wednesday",
};

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function toDateInputValue(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (value === "Today") {
    return isoDate();
  }

  if (value === "Tomorrow") {
    return isoDate(1);
  }

  return "";
}

function formatDueDate(value: string) {
  if (!value) {
    return "No due date";
  }

  if (value === "Done") {
    return "Done";
  }

  const inputValue = toDateInputValue(value);
  if (!inputValue) {
    return value;
  }

  const today = isoDate();
  const tomorrow = isoDate(1);
  if (inputValue === today) {
    return "Today";
  }

  if (inputValue === tomorrow) {
    return "Tomorrow";
  }

  return new Date(`${inputValue}T12:00:00`).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder
    .toString()
    .padStart(2, "0")}`;
}

function getRemainingTimerSeconds(deadline: number) {
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

function formatHours(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatCommentDate(value: string) {
  return new Date(value).toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isToday(date: string) {
  const value = new Date(date);
  const today = new Date();
  return value.toDateString() === today.toDateString();
}

function priorityClass(priority: Priority) {
  if (priority === "high") {
    return "bg-[var(--accent-soft)] text-[var(--danger)] border-[var(--accent-border)]";
  }

  if (priority === "medium") {
    return "bg-[var(--amber-soft)] text-[var(--amber-strong)] border-[var(--amber-border)]";
  }

  return "bg-[var(--green-soft)] text-[var(--green-strong)] border-[var(--green-border)]";
}

function createId(prefix: string) {
  return `${prefix}-${createUuid()}`;
}

function createUuid() {
  const cryptoProvider =
    typeof globalThis.crypto === "undefined" ? null : globalThis.crypto;

  if (cryptoProvider?.randomUUID) {
    return cryptoProvider.randomUUID();
  }

  if (cryptoProvider?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoProvider.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
      12,
      16,
    )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
    (
      Number(char) ^
      (Math.random() * 16) >> (Number(char) / 4)
    ).toString(16),
  );
}

function createInviteToken() {
  if (typeof crypto !== "undefined") {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(normalizeEmail(value));
}

function uniqueEmails(values: string[]) {
  return Array.from(new Set(values.map(normalizeEmail))).filter(isValidEmail);
}

function relationOne<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function createCurrentUserMember(
  userId = currentUser.id,
  name = currentUser.name,
  email = currentUser.email,
): ProjectMember {
  return {
    id: userId,
    name,
    email,
    role: "owner",
  };
}

function normalizeProjectRole(role?: string | null): ProjectRole {
  if (role === "owner" || role === "editor") {
    return role;
  }

  return "viewer";
}

function normalizeMemberAccessRole(
  role?: string | null,
): ProjectMemberAccessRole {
  return normalizeProjectRole(role) === "viewer" ? "viewer" : "editor";
}

function normalizeStoredProjectRole(project: Partial<Project>): ProjectRole {
  if (project.currentUserRole === "owner") {
    return "owner";
  }

  if (!project.id || !isUuid(project.id)) {
    return "owner";
  }

  return normalizeProjectRole(project.currentUserRole);
}

function normalizeProjectMembers(
  members: Array<Partial<ProjectMember>> | undefined,
  fallbackCount = 1,
): ProjectMember[] {
  const normalized: ProjectMember[] = (members ?? [])
    .map((member, index) => {
      const normalizedMember: ProjectMember = {
        id: member.id?.trim() || createId("member"),
        name:
          member.name?.trim() ||
          member.email?.split("@")[0] ||
          `Project user ${index + 1}`,
        email: normalizeEmail(member.email ?? ""),
        role: normalizeProjectRole(member.role),
      };

      if (member.joinedAt) {
        normalizedMember.joinedAt = member.joinedAt;
      }

      return normalizedMember;
    })
    .filter((member) => member.name || member.email);

  if (!normalized.length) {
    normalized.push(createCurrentUserMember());
  }

  if (fallbackCount > normalized.length) {
    normalized.push({
      id: "local-readonly-user",
      name: "Read-only teammate",
      email: "teammate@tockli.local",
      role: "viewer",
    });
  }

  const ownerIndex = normalized.findIndex((member) => member.role === "owner");
  const owner = ownerIndex >= 0 ? normalized[ownerIndex] : normalized[0];
  return normalized.map((member) => ({
    ...member,
    role:
      member.id === owner.id
        ? "owner"
        : normalizeMemberAccessRole(member.role),
  }));
}

function normalizeProjectInvites(
  invites?: Array<Partial<ProjectInvite>>,
): ProjectInvite[] {
  return (invites ?? [])
    .map((invite) => {
      const normalizedInvite: ProjectInvite = {
        id: invite.id ?? createId("invite"),
        email: normalizeEmail(invite.email ?? ""),
        role: normalizeMemberAccessRole(invite.role),
        token: invite.token ?? createInviteToken(),
        status: invite.status === "accepted" ? "accepted" : "pending",
        invitedAt: invite.invitedAt ?? new Date().toISOString(),
      };

      if (invite.acceptedAt) {
        normalizedInvite.acceptedAt = invite.acceptedAt;
      }

      return normalizedInvite;
    })
    .filter((invite) => isValidEmail(invite.email));
}

function getProjectMemberCount(project: Project) {
  return Math.max(
    1,
    project.teamMembers.filter((member) =>
      ["owner", "editor", "viewer"].includes(member.role),
    ).length,
  );
}

function getInviteUrl(token: string) {
  if (typeof window === "undefined") {
    return `/app?invite=${encodeURIComponent(token)}`;
  }

  return `${window.location.origin}/app?invite=${encodeURIComponent(token)}`;
}

function getInviteAccessLine(role: ProjectMemberAccessRole) {
  return role === "editor"
    ? "Open this invite link to sign in and join the project with editor access:"
    : "Open this invite link to sign in and join the project with read-only access:";
}

function openInviteEmailDraft(
  email: string,
  projectName: string,
  token: string,
  role: ProjectMemberAccessRole,
) {
  if (typeof window === "undefined") {
    return;
  }

  const inviteUrl = getInviteUrl(token);
  const subject = encodeURIComponent(`Join ${projectName} on Tockli`);
  const body = encodeURIComponent(
    [
      `You have been invited to join ${projectName} on Tockli.`,
      "",
      getInviteAccessLine(role),
      inviteUrl,
    ].join("\n"),
  );
  window.open(`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`);
}

function normalizeThemeMode(themeMode?: string): ThemeMode {
  return themeMode === "dark" ? "dark" : "light";
}

function normalizeVolume(volume?: number) {
  if (!Number.isFinite(volume)) {
    return initialSettings.focusVolume;
  }

  return Math.min(100, Math.max(0, Math.round(volume ?? 0)));
}

function normalizeInteger(
  value: number | null | undefined,
  min: number,
  max: number,
  fallback: number,
) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value ?? fallback)));
}

function normalizeFocusSound(sound?: string | null): FocusSound {
  return focusSoundOptions.includes(sound as FocusSound)
    ? (sound as FocusSound)
    : initialSettings.focusSound;
}

function normalizeSettings(settings?: Partial<UserSettings>): UserSettings {
  const normalized = {
    ...initialSettings,
    ...settings,
  };

  return {
    ...normalized,
    breakMinutes: normalizeInteger(
      settings?.breakMinutes,
      3,
      30,
      initialSettings.breakMinutes,
    ),
    dailyPomodoroGoal: normalizeInteger(
      settings?.dailyPomodoroGoal,
      1,
      16,
      initialSettings.dailyPomodoroGoal,
    ),
    focusMinutes: normalizeInteger(
      settings?.focusMinutes,
      5,
      180,
      initialSettings.focusMinutes,
    ),
    focusSound: normalizeFocusSound(settings?.focusSound),
    focusVolume: normalizeVolume(settings?.focusVolume),
    showNextUp: Boolean(normalized.showNextUp),
    soundEnabled: Boolean(normalized.soundEnabled),
    strictMode: Boolean(normalized.strictMode),
    themeMode: normalizeThemeMode(settings?.themeMode),
    workingDays: normalized.workingDays?.filter((day) => weekdays.includes(day))?.length
      ? normalized.workingDays.filter((day) => weekdays.includes(day))
      : initialSettings.workingDays,
  };
}

function mapRemoteSettings(row?: RemoteSettingsRow | null): UserSettings {
  if (!row) {
    return initialSettings;
  }

  return normalizeSettings({
    breakMinutes: row.break_minutes ?? initialSettings.breakMinutes,
    dailyPomodoroGoal: row.daily_pomodoro_goal ?? initialSettings.dailyPomodoroGoal,
    focusMinutes: row.focus_minutes ?? initialSettings.focusMinutes,
    focusVolume: row.focus_volume ?? initialSettings.focusVolume,
    focusSound: row.focus_sound ?? initialSettings.focusSound,
    showNextUp: row.show_next_up ?? initialSettings.showNextUp,
    soundEnabled: row.sound_enabled ?? initialSettings.soundEnabled,
    strictMode: row.strict_mode ?? initialSettings.strictMode,
    themeMode: row.theme_mode ?? initialSettings.themeMode,
    workingDays: row.working_days ?? initialSettings.workingDays,
  });
}

function mapSettingsForRemote(userId: string, settings: UserSettings) {
  return {
    break_minutes: normalizeInteger(
      settings.breakMinutes,
      3,
      30,
      initialSettings.breakMinutes,
    ),
    daily_pomodoro_goal: normalizeInteger(
      settings.dailyPomodoroGoal,
      1,
      16,
      initialSettings.dailyPomodoroGoal,
    ),
    focus_minutes: normalizeInteger(
      settings.focusMinutes,
      5,
      90,
      initialSettings.focusMinutes,
    ),
    focus_sound: normalizeFocusSound(settings.focusSound),
    focus_volume: normalizeVolume(settings.focusVolume),
    show_next_up: settings.showNextUp,
    sound_enabled: settings.soundEnabled,
    strict_mode: settings.strictMode,
    theme_mode: normalizeThemeMode(settings.themeMode),
    updated_at: new Date().toISOString(),
    user_id: userId,
    working_days: settings.workingDays.filter((day) => weekdays.includes(day)),
  };
}

function mapRemoteCategory(row: RemoteCategoryRow): TaskCategory {
  return {
    color: row.color || categoryColorOptions[0],
    id: row.id,
    name: row.name?.trim() || "New Category",
    projectId: row.project_id,
  };
}

function mapRemoteTask(row: RemoteTaskRow): Task {
  const tags = (row.task_tags ?? [])
    .map((tag) => normalizeTag(tag.label))
    .filter(Boolean)
    .sort();
  const subtasks = [...(row.task_subtasks ?? [])]
    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))
    .map((subtask) => ({
      done: Boolean(subtask.is_done),
      id: subtask.id,
      title: subtask.title?.trim() || "Untitled subtask",
    }));
  const comments = [...(row.task_comments ?? [])]
    .sort(
      (left, right) =>
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
    )
    .map((comment) => {
      const profile = relationOne(comment.profiles);
      const email = normalizeEmail(profile?.email ?? "");
      return {
        authorId: comment.author_id,
        authorName:
          profile?.display_name?.trim() ||
          email.split("@")[0] ||
          "Tockli user",
        body: comment.body,
        createdAt: comment.created_at,
        id: comment.id,
      };
    });

  return {
    categoryId: row.category_id ?? null,
    comments,
    completedAt: row.completed_at ?? null,
    description: row.note ?? "",
    due: row.due_label ?? "",
    estimate: row.estimate_minutes,
    id: row.id,
    priority: row.priority ?? "medium",
    projectId: row.project_id,
    spent: row.spent_minutes,
    status: row.status || "todo",
    subtasks,
    tags,
    title: row.title?.trim() || "Untitled task",
  };
}

function mapRemoteSession(row: RemoteSessionRow): FocusSession {
  return {
    completedAt: row.completed_at,
    id: row.id,
    minutes: row.minutes,
    note: row.note ?? "",
    projectId: row.project_id,
    taskId: row.task_id ?? null,
    userId: row.user_id,
  };
}

function mapRemoteCancellation(row: RemoteCancellationRow): PomodoroCancellation {
  return {
    cancelledAt: row.cancelled_at,
    durationMinutes: row.duration_minutes,
    elapsedMinutes: row.elapsed_minutes,
    id: row.id,
    note: row.note ?? "",
    projectId: row.project_id,
    reason: row.reason,
    taskId: row.task_id ?? null,
    userId: row.user_id,
  };
}

function workspaceContentScore(
  workspace: Pick<
    WorkspaceSnapshot,
    "categories" | "tasks" | "sessions" | "cancellations"
  >,
) {
  return (
    workspace.categories.length +
    workspace.tasks.length * 3 +
    workspace.sessions.length +
    workspace.cancellations.length
  );
}

function storedStateToWorkspace(parsed: StoredState): WorkspaceSnapshot {
  const settings = normalizeSettings(parsed.settings);
  return {
    activeProjectId: parsed.activeProjectId ?? initialProjects[0].id,
    cancellations: parsed.cancellations ?? [],
    categories: normalizeCategories(parsed.categories),
    focusTaskId: parsed.focusTaskId ?? "",
    projects: normalizeProjects(parsed.projects),
    selectedTaskId: parsed.selectedTaskId ?? "task-wireframes",
    sessions: parsed.sessions ?? createDemoSessions(),
    settings,
    tasks: normalizeTasks(parsed.tasks),
  };
}

function workspaceToStoredState(
  snapshot: WorkspaceSnapshot,
): Omit<StoredState, "sourceTabId" | "updatedAt"> {
  return {
    activeProjectId: snapshot.activeProjectId,
    cancellations: snapshot.cancellations,
    categories: snapshot.categories,
    focusTaskId: snapshot.focusTaskId,
    onboardingCompleted: true,
    projects: snapshot.projects,
    selectedTaskId: snapshot.selectedTaskId,
    sessions: snapshot.sessions,
    settings: snapshot.settings,
    tasks: snapshot.tasks,
  };
}

async function loadRemoteWorkspaceSnapshot(
  authUser: User,
  preferredProjectId?: string,
  preferredTaskId?: string,
): Promise<{ snapshot: WorkspaceSnapshot | null; plan: PlanTier; error?: string }> {
  if (!supabase) {
    return { plan: "free", snapshot: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", authUser.id)
    .maybeSingle();

  const plan = !profileError && (profile?.plan === "free" || profile?.plan === "pro")
    ? profile.plan
    : "free";

  const { data: membershipData, error: membershipError } = await supabase
    .from("project_members")
    .select(
      "project_id,user_id,role,profiles(id,email,display_name),projects(id,owner_id,name,description,kind,color,board_columns)",
    )
    .eq("user_id", authUser.id);

  if (membershipError) {
    return { error: membershipError.message, plan, snapshot: null };
  }

  const membershipRows = (membershipData ?? []) as RemoteMembershipRow[];
  const remoteProjects = membershipRows
    .map((membership): Project | null => {
      const remoteProject = relationOne(membership.projects);
      if (!remoteProject) {
        return null;
      }

      const columns = Array.isArray(remoteProject.board_columns)
        ? (remoteProject.board_columns as Array<Partial<BoardColumn>>)
        : undefined;

      return {
        color: remoteProject.color || "#ff005e",
        columns: normalizeBoardColumns(columns),
        currentUserRole: normalizeProjectRole(membership.role),
        description: remoteProject.description ?? "",
        id: remoteProject.id,
        kind: remoteProject.kind,
        members: 1,
        name: remoteProject.name,
        ownerId: remoteProject.owner_id,
        pendingInvites: [],
        teamMembers: [],
      };
    })
    .filter((project): project is Project => Boolean(project));

  if (!remoteProjects.length) {
    const { data: settingsData } = await supabase
      .from("user_settings")
      .select(
        "focus_minutes,break_minutes,daily_pomodoro_goal,working_days,strict_mode,sound_enabled,focus_sound,focus_volume,show_next_up,theme_mode",
      )
      .eq("user_id", authUser.id)
      .maybeSingle();

    return {
      plan,
      snapshot: {
        activeProjectId: initialProjects[0].id,
        cancellations: [],
        categories: [],
        focusTaskId: "",
        hasRemoteContent: false,
        projects: [],
        selectedTaskId: "",
        sessions: [],
        settings: mapRemoteSettings(settingsData as RemoteSettingsRow | null),
        tasks: [],
      },
    };
  }

  const projectIds = remoteProjects.map((project) => project.id);
  const ownedProjectIds = remoteProjects
    .filter((project) => project.currentUserRole === "owner")
    .map((project) => project.id);

  const [
    allMembershipResult,
    inviteResult,
    categoryResult,
    taskResult,
    sessionResult,
    cancellationResult,
    settingsResult,
  ] = await Promise.all([
    supabase
      .from("project_members")
      .select("project_id,user_id,role,profiles(id,email,display_name)")
      .in("project_id", projectIds),
    ownedProjectIds.length
      ? supabase
          .from("project_invitations")
          .select("id,project_id,invited_email,role,token,status,created_at,accepted_at")
          .in("project_id", ownedProjectIds)
          .eq("status", "pending")
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("task_categories")
      .select("id,project_id,name,color")
      .in("project_id", projectIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select(
        "id,project_id,category_id,title,note,status,priority,estimate_minutes,spent_minutes,due_label,sort_order,created_at,completed_at,task_tags(label),task_subtasks(id,title,is_done,sort_order),task_comments(id,author_id,body,created_at,profiles(id,email,display_name))",
      )
      .in("project_id", projectIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("focus_sessions")
      .select("id,user_id,project_id,task_id,minutes,note,completed_at")
      .in("project_id", projectIds)
      .order("completed_at", { ascending: false }),
    supabase
      .from("pomodoro_cancellations")
      .select("id,user_id,project_id,task_id,duration_minutes,elapsed_minutes,reason,note,cancelled_at")
      .in("project_id", projectIds)
      .order("cancelled_at", { ascending: false }),
    supabase
      .from("user_settings")
      .select(
        "focus_minutes,break_minutes,daily_pomodoro_goal,working_days,strict_mode,sound_enabled,focus_sound,focus_volume,show_next_up,theme_mode",
      )
      .eq("user_id", authUser.id)
      .maybeSingle(),
  ]);

  const loadError =
    allMembershipResult.error?.message ||
    inviteResult.error?.message ||
    categoryResult.error?.message ||
    taskResult.error?.message ||
    sessionResult.error?.message ||
    cancellationResult.error?.message ||
    settingsResult.error?.message;

  if (loadError) {
    return { error: loadError, plan, snapshot: null };
  }

  const membersByProjectId = new Map<string, ProjectMember[]>();
  ((allMembershipResult.data ?? []) as RemoteMembershipRow[]).forEach((memberRow) => {
    const members = membersByProjectId.get(memberRow.project_id) ?? [];
    members.push(mapRemoteMember(memberRow));
    membersByProjectId.set(memberRow.project_id, members);
  });

  const invitesByProjectId = new Map<string, ProjectInvite[]>();
  ((inviteResult.data ?? []) as RemoteInviteRow[]).forEach((inviteRow) => {
    const invites = invitesByProjectId.get(inviteRow.project_id) ?? [];
    invites.push(mapRemoteInvite(inviteRow));
    invitesByProjectId.set(inviteRow.project_id, invites);
  });

  const projects = remoteProjects.map((project) => {
    const teamMembers = normalizeProjectMembers(
      membersByProjectId.get(project.id),
      1,
    );
    return {
      ...project,
      members: teamMembers.length,
      pendingInvites: invitesByProjectId.get(project.id) ?? [],
      teamMembers,
    };
  });
  const categories = ((categoryResult.data ?? []) as RemoteCategoryRow[]).map(
    mapRemoteCategory,
  );
  const tasks = ((taskResult.data ?? []) as RemoteTaskRow[]).map(mapRemoteTask);
  const sessions = ((sessionResult.data ?? []) as RemoteSessionRow[]).map(
    mapRemoteSession,
  );
  const cancellations = (
    (cancellationResult.data ?? []) as RemoteCancellationRow[]
  ).map(mapRemoteCancellation);
  const activeProjectId = resolveActiveProjectId(projects, preferredProjectId);
  const doneColumnId =
    projects
      .find((project) => project.id === activeProjectId)
      ?.columns.find((column) => column.isDone)?.id ?? "done";
  const selectedTaskId = resolveSelectedTaskId(
    tasks,
    activeProjectId,
    preferredTaskId,
    doneColumnId,
  );

  return {
    plan,
    snapshot: {
      activeProjectId,
      cancellations,
      categories,
      focusTaskId: "",
      hasRemoteContent:
        categories.length > 0 ||
        tasks.length > 0 ||
        sessions.length > 0 ||
        cancellations.length > 0,
      projects,
      selectedTaskId,
      sessions,
      settings: mapRemoteSettings(settingsResult.data as RemoteSettingsRow | null),
      tasks,
    },
  };
}

function normalizeProjects(projects?: Array<Partial<Project>>): Project[] {
  if (!projects) {
    return initialProjects;
  }

  return projects.map((project) => {
    const memberEmails = project.memberEmails?.filter(Boolean) ?? [];
    const legacyMembers: ProjectMember[] = memberEmails.map((email) => ({
      id: `legacy-${normalizeEmail(email)}`,
      name: normalizeEmail(email).split("@")[0] || "Project user",
      email: normalizeEmail(email),
      role: "viewer",
    }));
    const teamMembers = normalizeProjectMembers(
      project.teamMembers?.length
        ? project.teamMembers
        : [createCurrentUserMember(), ...legacyMembers],
      project.members,
    );

    return {
      id: project.id ?? createUuid(),
      ownerId: project.ownerId ?? currentUser.id,
      name: project.name?.trim() || "New Project",
      description: project.description?.trim() ?? "",
      kind: project.kind ?? "personal",
      color: project.color || "#ff005e",
      memberEmails,
      currentUserRole: normalizeStoredProjectRole(project),
      teamMembers,
      pendingInvites: normalizeProjectInvites(project.pendingInvites),
      members: Math.max(project.members ?? 1, teamMembers.length),
      columns: normalizeBoardColumns(project.columns),
    };
  });
}

function normalizeBoardColumns(columns?: Array<Partial<BoardColumn>>): BoardColumn[] {
  if (!columns?.length) {
    return createDefaultBoardColumns();
  }

  const normalized = columns
    .filter((column) => Boolean(column.id))
    .map((column, index) => ({
      id: column.id as TaskStatus,
      title: column.title?.trim() || `Column ${index + 1}`,
      isDone: Boolean(column.isDone || column.id === "done"),
      archived: Boolean(column.archived),
    }));

  return normalized.length ? normalized : createDefaultBoardColumns();
}

function normalizeCategories(categories?: TaskCategory[]) {
  if (!categories) {
    return initialCategories;
  }

  return categories.map((category) => ({
    ...category,
    color: category.color || categoryColorOptions[0],
  }));
}

function normalizeTasks(tasks?: Array<Partial<Task> & { note?: string }>): Task[] {
  if (!tasks) {
    return initialTasks;
  }

  return tasks.map((task) => ({
    completedAt: task.completedAt ?? null,
    id: task.id ?? createUuid(),
    projectId: task.projectId ?? initialProjects[0].id,
    title: task.title?.trim() || "Untitled task",
    description: task.description ?? task.note ?? "",
    status: task.status ?? "todo",
    estimate: task.estimate ?? initialSettings.focusMinutes,
    spent: task.spent ?? 0,
    priority: task.priority ?? "medium",
    tags: task.tags?.map(normalizeTag).filter(Boolean) ?? [],
    categoryId: task.categoryId ?? null,
    subtasks:
      task.subtasks?.map((subtask) => ({
        id: subtask.id ?? createUuid(),
        title: subtask.title?.trim() || "Untitled subtask",
        done: Boolean(subtask.done),
      })) ?? [],
    comments:
      task.comments?.map((comment) => ({
        id: comment.id ?? createUuid(),
        authorId: comment.authorId ?? "unknown-user",
        authorName: comment.authorName?.trim() || "Tockli user",
        body: comment.body ?? "",
        createdAt: comment.createdAt ?? new Date().toISOString(),
      })) ?? [],
    due: task.due ?? "",
  }));
}

type RemoteProfileRow = {
  id?: string | null;
  email?: string | null;
  display_name?: string | null;
};

type RemoteProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  description?: string | null;
  kind: ProjectKind;
  color: string;
  board_columns?: unknown;
};

type RemoteMembershipRow = {
  project_id: string;
  user_id: string;
  role: string;
  profiles?: RemoteProfileRow | RemoteProfileRow[] | null;
  projects?: RemoteProjectRow | RemoteProjectRow[] | null;
};

type RemoteInviteRow = {
  id: string;
  project_id: string;
  invited_email: string;
  role?: string | null;
  token: string;
  status: string;
  created_at: string;
  accepted_at?: string | null;
};

type RemoteCategoryRow = {
  id: string;
  project_id: string;
  name: string;
  color: string;
};

type RemoteTagRow = {
  label: string;
};

type RemoteSubtaskRow = {
  id: string;
  task_id?: string;
  title: string;
  is_done: boolean;
  sort_order?: number | null;
};

type RemoteCommentRow = {
  id: string;
  task_id?: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles?: RemoteProfileRow | RemoteProfileRow[] | null;
};

type RemoteTaskRow = {
  id: string;
  project_id: string;
  category_id?: string | null;
  title: string;
  note?: string | null;
  status: string;
  priority: Priority;
  estimate_minutes: number;
  spent_minutes: number;
  due_label?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
  completed_at?: string | null;
  task_tags?: RemoteTagRow[] | null;
  task_subtasks?: RemoteSubtaskRow[] | null;
  task_comments?: RemoteCommentRow[] | null;
};

type RemoteSessionRow = {
  id: string;
  user_id: string;
  project_id: string;
  task_id?: string | null;
  minutes: number;
  note?: string | null;
  completed_at: string;
};

type RemoteCancellationRow = {
  id: string;
  user_id: string;
  project_id: string;
  task_id?: string | null;
  duration_minutes: number;
  elapsed_minutes: number;
  reason: CancellationReason;
  note?: string | null;
  cancelled_at: string;
};

type RemoteSettingsRow = {
  focus_minutes?: number | null;
  break_minutes?: number | null;
  daily_pomodoro_goal?: number | null;
  working_days?: string[] | null;
  strict_mode?: boolean | null;
  sound_enabled?: boolean | null;
  focus_sound?: FocusSound | null;
  focus_volume?: number | null;
  show_next_up?: boolean | null;
  theme_mode?: ThemeMode | null;
};

type WorkspaceSnapshot = {
  projects: Project[];
  categories: TaskCategory[];
  tasks: Task[];
  sessions: FocusSession[];
  cancellations: PomodoroCancellation[];
  settings: UserSettings;
  activeProjectId: string;
  selectedTaskId: string;
  focusTaskId: string;
  hasRemoteContent?: boolean;
};

function mapRemoteMember(row: RemoteMembershipRow): ProjectMember {
  const profile = relationOne(row.profiles);
  const email = normalizeEmail(profile?.email ?? "");
  return {
    id: row.user_id,
    name: profile?.display_name?.trim() || email.split("@")[0] || "Tockli user",
    email,
    role: normalizeProjectRole(row.role),
  };
}

function mapRemoteInvite(row: RemoteInviteRow): ProjectInvite {
  return {
    id: row.id,
    email: normalizeEmail(row.invited_email),
    role: normalizeMemberAccessRole(row.role),
    token: row.token,
    status: row.status === "accepted" ? "accepted" : "pending",
    invitedAt: row.created_at,
    acceptedAt: row.accepted_at ?? undefined,
  };
}

function normalizeTag(tag: string) {
  return tag.trim().replace(/^#/, "").toLowerCase();
}

function parseTagsInput(value: string) {
  return Array.from(value.matchAll(/#?([a-zA-Z0-9_-]+)/g))
    .map((match) => normalizeTag(match[1]))
    .filter(Boolean);
}

function insertMarkdown(value: string, kind: "heading" | "bold" | "italic" | "list" | "check" | "quote") {
  const snippets = {
    heading: "\n## Heading\n",
    bold: "**bold text**",
    italic: "_italic text_",
    list: "\n- List item",
    check: "\n- [ ] Action item",
    quote: "\n> Reflection",
  };

  return `${value}${snippets[kind]}`.replace(/^\n/, "");
}

function applyTaskUpdates(task: Task, updates: Partial<Task>) {
  return {
    ...task,
    ...updates,
    tags: updates.tags
      ? Array.from(new Set(updates.tags.map(normalizeTag).filter(Boolean)))
      : task.tags,
  };
}

function prepareTaskForSave(task: Task) {
  return {
    ...task,
    title: task.title.trim() || "Untitled task",
  };
}

export default function Home() {
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [view, setView] = useState<View>("board");
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [categories, setCategories] = useState<TaskCategory[]>(initialCategories);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [cancellations, setCancellations] = useState<PomodoroCancellation[]>([]);
  const [settings, setSettings] = useState<UserSettings>(initialSettings);
  const [profilePlan, setProfilePlan] = useState<PlanTier>("free");
  const [activeProjectId, setActiveProjectId] = useState(initialProjects[0].id);
  const [selectedTaskId, setSelectedTaskId] = useState("task-wireframes");
  const [focusTaskId, setFocusTaskId] = useState("");
  const [projectDialog, setProjectDialog] = useState<ProjectDialogState | null>(
    null,
  );
  const [projectNotice, setProjectNotice] = useState("");
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState<Task | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [remoteSyncRequestId, setRemoteSyncRequestId] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sessionNote, setSessionNote] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(
    initialSettings.focusMinutes,
  );
  const [remainingSeconds, setRemainingSeconds] = useState(
    initialSettings.focusMinutes * 60,
  );
  const timerDeadlineRef = useRef<number | null>(null);
  const timerCompletionHandledRef = useRef(false);
  const lastRemoteSyncJsonRef = useRef("");
  const tabIdRef = useRef(createId("tab"));
  const lastAppliedStorageUpdatedAtRef = useRef("");
  const lastLocalStorageWorkspaceJsonRef = useRef("");
  const fullRemoteSyncNeededRef = useRef(false);
  const dirtyProjectIdsRef = useRef(new Set<string>());
  const dirtyCategoryIdsRef = useRef(new Set<string>());
  const dirtyTaskIdsRef = useRef(new Set<string>());
  const committedDraftTaskIdsRef = useRef(new Set<string>());
  const remoteSyncInFlightRef = useRef(false);
  const remoteSyncQueuedRef = useRef(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelStep, setCancelStep] = useState<"confirm" | "reason">("confirm");
  const [cancelReason, setCancelReason] = useState<CancellationReason | "">("");
  const [hydrated, setHydrated] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioPreviewTimeoutRef = useRef<number | null>(null);
  const audioNodeRef = useRef<{
    gain: GainNode;
    oscillator?: OscillatorNode;
    source?: AudioBufferSourceNode;
  } | null>(null);
  const authDisplayName =
    readUserMetadata(authUser, "display_name") ||
    readUserMetadata(authUser, "full_name") ||
    authUser?.email?.split("@")[0] ||
    (isSupabaseConfigured ? "Tockli user" : "Demo user");
  const authEmail = authUser?.email ?? currentUser.email;
  const authInitial = authDisplayName.trim().charAt(0).toUpperCase() || "T";
  const appUserId = authUser?.id ?? currentUser.id;
  const appUserName = authDisplayName || currentUser.name;

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let alive = true;

    async function checkSession() {
      const { data, error } = await supabase!.auth.getSession();

      if (!alive) {
        return;
      }

      if (error) {
        setAuthMessage(error.message);
        setAuthReady(true);
        return;
      }

      if (!data.session) {
        const nextPath = `${window.location.pathname}${window.location.search}`;
        window.location.replace(
          `/login?next=${encodeURIComponent(
            nextPath,
          )}&message=Please%20log%20in%20to%20open%20Tockli.`,
        );
        return;
      }

      setAuthUser((current) =>
        current?.id === data.session!.user.id ? current : data.session!.user,
      );
      setAuthReady(true);
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) {
        return;
      }

      if (!session) {
        const nextPath = `${window.location.pathname}${window.location.search}`;
        window.location.replace(`/login?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      setAuthUser((current) =>
        current?.id === session.user.id ? current : session.user,
      );
      setAuthReady(true);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  const storageKey = authUser ? `${STORAGE_KEY}:${authUser.id}` : STORAGE_KEY;

  const applyWorkspaceSnapshot = useCallback(
    (
      snapshot: WorkspaceSnapshot,
      options?: {
        preserveSelection?: boolean;
        preserveTimer?: boolean;
        requireFullRemoteSync?: boolean;
      },
    ) => {
      const normalizedSettings = normalizeSettings(snapshot.settings);
      dirtyProjectIdsRef.current.clear();
      dirtyCategoryIdsRef.current.clear();
      dirtyTaskIdsRef.current.clear();
      fullRemoteSyncNeededRef.current = Boolean(options?.requireFullRemoteSync);
      setProjects(snapshot.projects);
      setCategories(snapshot.categories);
      setTasks(snapshot.tasks);
      setSessions(snapshot.sessions);
      setCancellations(snapshot.cancellations);
      setSettings(normalizedSettings);
      if (options?.preserveSelection) {
        setActiveProjectId((current) =>
          snapshot.projects.some((project) => project.id === current)
            ? current
            : snapshot.activeProjectId,
        );
        setSelectedTaskId((current) =>
          snapshot.tasks.some((task) => task.id === current)
            ? current
            : snapshot.selectedTaskId,
        );
      } else {
        setActiveProjectId(snapshot.activeProjectId);
        setSelectedTaskId(snapshot.selectedTaskId);
      }
      if (!options?.preserveTimer) {
        setFocusTaskId(snapshot.focusTaskId);
        setRemainingSeconds(normalizedSettings.focusMinutes * 60);
        setSessionDurationMinutes(normalizedSettings.focusMinutes);
      }
      if (!options?.preserveSelection) {
        setTaskDraft(null);
      }
      setOnboardingOpen(false);
      setHydrated(true);
    },
    [],
  );

  useEffect(() => {
    if (!authReady || (isSupabaseConfigured && !authUser)) {
      return;
    }

    let alive = true;
    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      const inviteToken = params.get("invite");
      const onboardingRequested = params.get("onboarding") === "1" && !inviteToken;

      function readStoredWorkspace() {
        const stored = window.localStorage.getItem(storageKey);
        const canMigrateLegacyState =
          Boolean(authUser) &&
          !window.localStorage.getItem(STORAGE_MIGRATION_KEY);
        const legacyStored = canMigrateLegacyState
          ? window.localStorage.getItem(STORAGE_KEY) ??
            window.localStorage.getItem(LEGACY_STORAGE_KEY)
          : null;

        if (!stored && !legacyStored) {
          return null;
        }

        try {
          const parsed = JSON.parse(stored ?? legacyStored ?? "{}") as StoredState;
          return {
            legacyStored: Boolean(legacyStored),
            parsed,
            workspace: storedStateToWorkspace(parsed),
          };
        } catch {
          window.localStorage.removeItem(storageKey);
          return null;
        }
      }

      async function hydrateWorkspace() {
        const storedWorkspace = readStoredWorkspace();

        if (supabase && authUser) {
          const { error, plan, snapshot: remoteWorkspace } =
            await loadRemoteWorkspaceSnapshot(
              authUser,
              storedWorkspace?.workspace.activeProjectId,
              storedWorkspace?.workspace.selectedTaskId,
            );

          if (!alive) {
            return;
          }

          setProfilePlan(plan);
          if (error) {
            setProjectNotice(error);
          }

          const localScore = storedWorkspace
            ? workspaceContentScore(storedWorkspace.workspace)
            : 0;
          const shouldMigrateLocalWorkspace = Boolean(
            storedWorkspace &&
              storedWorkspace.workspace.projects.length > 0 &&
              (!remoteWorkspace?.projects.length ||
                (!remoteWorkspace.hasRemoteContent && localScore > 0)),
          );

          if (shouldMigrateLocalWorkspace && storedWorkspace) {
            applyWorkspaceSnapshot(storedWorkspace.workspace, {
              requireFullRemoteSync: true,
            });
            if (storedWorkspace.legacyStored) {
              const updatedAt = new Date().toISOString();
              window.localStorage.setItem(
                storageKey,
                JSON.stringify({
                  ...storedWorkspace.parsed,
                  onboardingCompleted: true,
                  sourceTabId: tabIdRef.current,
                  updatedAt,
                }),
              );
              lastAppliedStorageUpdatedAtRef.current = updatedAt;
              window.localStorage.setItem(STORAGE_MIGRATION_KEY, "true");
            }
            return;
          }

          if (remoteWorkspace?.projects.length) {
            applyWorkspaceSnapshot(remoteWorkspace);
            return;
          }
        }

        if (storedWorkspace?.workspace.projects.length) {
          applyWorkspaceSnapshot(storedWorkspace.workspace);
          return;
        }

        if (inviteToken) {
          applyWorkspaceSnapshot({
            activeProjectId: "",
            cancellations: [],
            categories: [],
            focusTaskId: "",
            projects: [],
            selectedTaskId: "",
            sessions: [],
            settings: initialSettings,
            tasks: [],
          });
          return;
        }

        applyWorkspaceSnapshot({
          activeProjectId: "",
          cancellations: [],
          categories: [],
          focusTaskId: "",
          projects: [],
          selectedTaskId: "",
          sessions: [],
          settings: initialSettings,
          tasks: [],
        });
        setOnboardingOpen(!inviteToken || onboardingRequested);
      }

      void hydrateWorkspace();
    });

    return () => {
      alive = false;
      window.cancelAnimationFrame(frame);
    };
  }, [applyWorkspaceSnapshot, authReady, authUser, storageKey]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    function closeMobileMenu(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    }

    function closeMobileMenuAtDesktopWidth() {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    }

    window.addEventListener("keydown", closeMobileMenu);
    window.addEventListener("resize", closeMobileMenuAtDesktopWidth);
    return () => {
      window.removeEventListener("keydown", closeMobileMenu);
      window.removeEventListener("resize", closeMobileMenuAtDesktopWidth);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const state = workspaceToStoredState({
      activeProjectId,
      cancellations,
      categories,
      focusTaskId,
      projects,
      selectedTaskId,
      sessions,
      settings,
      tasks,
    });
    const workspaceJson = JSON.stringify(state);

    if (workspaceJson === lastLocalStorageWorkspaceJsonRef.current) {
      return;
    }

    const updatedAt = new Date().toISOString();
    const storedState: StoredState = {
      ...state,
      sourceTabId: tabIdRef.current,
      updatedAt,
    };

    lastAppliedStorageUpdatedAtRef.current = updatedAt;
    lastLocalStorageWorkspaceJsonRef.current = workspaceJson;
    window.localStorage.setItem(storageKey, JSON.stringify(storedState));
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, [
    activeProjectId,
    cancellations,
    categories,
    focusTaskId,
    hydrated,
    projects,
    selectedTaskId,
    sessions,
    settings,
    storageKey,
    tasks,
  ]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== storageKey || !event.newValue) {
        return;
      }

      try {
        const parsed = JSON.parse(event.newValue) as StoredState;

        if (parsed.sourceTabId === tabIdRef.current) {
          return;
        }

        if (
          parsed.updatedAt &&
          lastAppliedStorageUpdatedAtRef.current &&
          parsed.updatedAt <= lastAppliedStorageUpdatedAtRef.current
        ) {
          return;
        }

        const workspace = storedStateToWorkspace(parsed);
        lastAppliedStorageUpdatedAtRef.current =
          parsed.updatedAt ?? new Date().toISOString();
        const appliedWorkspace = isRunning
          ? { ...workspace, focusTaskId }
          : workspace;
        lastLocalStorageWorkspaceJsonRef.current = JSON.stringify(
          workspaceToStoredState(appliedWorkspace),
        );
        applyWorkspaceSnapshot(workspace, {
          preserveSelection: true,
          preserveTimer: isRunning,
        });
      } catch {
        setProjectNotice("Another Tockli tab sent state this tab could not read.");
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [applyWorkspaceSnapshot, focusTaskId, hydrated, isRunning, storageKey]);

  useEffect(() => {
    if (!hydrated || !supabase || !authUser || !projects.length) {
      return;
    }

    const syncAuthUser = authUser;
    let cancelled = false;
    const snapshotJson = JSON.stringify({
      activeProjectId,
      cancellations,
      categories,
      focusTaskId,
      projects,
      selectedTaskId,
      sessions,
      settings,
      tasks,
    });

    if (snapshotJson === lastRemoteSyncJsonRef.current) {
      return;
    }

    function mapId(value: string, idMap: Map<string, string>) {
      return idMap.get(value) ?? value;
    }

    async function syncWorkspaceToRemote() {
      if (remoteSyncInFlightRef.current) {
        remoteSyncQueuedRef.current = true;
        return;
      }

      remoteSyncInFlightRef.current = true;

      try {
        const projectIdMap = new Map<string, string>();
        const categoryIdMap = new Map<string, string>();
        const taskIdMap = new Map<string, string>();
        const subtaskIdMap = new Map<string, string>();
        const commentIdMap = new Map<string, string>();
        const sessionIdMap = new Map<string, string>();
        const cancellationIdMap = new Map<string, string>();
        const ownedLocalProjectIds = new Set(
          projects
            .filter((project) => project.currentUserRole === "owner")
            .map((project) => project.id),
        );
        const editableLocalProjectIds = new Set(
          projects
            .filter((project) => project.currentUserRole !== "viewer")
            .map((project) => project.id),
        );
        const dirtyProjectIds = new Set(dirtyProjectIdsRef.current);
        const dirtyCategoryIds = new Set(dirtyCategoryIdsRef.current);
        const dirtyTaskIds = new Set(dirtyTaskIdsRef.current);
        const shouldSyncAllWorkspace = fullRemoteSyncNeededRef.current;

        const profileResult = await supabase!.from("profiles").upsert(
          {
            display_name: appUserName,
            email: syncAuthUser.email ?? authEmail,
            id: syncAuthUser.id,
          },
          { onConflict: "id" },
        );
        if (profileResult.error) {
          throw new Error(profileResult.error.message);
        }

        const settingsResult = await supabase!
          .from("user_settings")
          .upsert(mapSettingsForRemote(syncAuthUser.id, settings), {
            onConflict: "user_id",
          });
        if (settingsResult.error) {
          throw new Error(settingsResult.error.message);
        }

        for (const project of projects) {
          if (!ownedLocalProjectIds.has(project.id)) {
            continue;
          }

          const shouldSyncProject =
            shouldSyncAllWorkspace ||
            !isUuid(project.id) ||
            dirtyProjectIds.has(project.id);

          if (!shouldSyncProject) {
            continue;
          }

          const projectPayload = {
            board_columns: project.columns,
            color: project.color,
            description: project.description,
            kind: project.kind,
            name: project.name,
            owner_id: syncAuthUser.id,
          };

          if (isUuid(project.id)) {
            const { error } = await supabase!
              .from("projects")
              .upsert(
                {
                  id: project.id,
                  ...projectPayload,
                },
                { onConflict: "id" },
              );
            if (error) {
              throw new Error(error.message);
            }
          } else {
            const { data, error } = await supabase!
              .from("projects")
              .insert(projectPayload)
              .select("id")
              .single();
            if (error) {
              throw new Error(error.message);
            }
            if (data?.id) {
              projectIdMap.set(project.id, data.id);
            }
          }
        }

        function remoteProjectId(projectId: string) {
          return mapId(projectId, projectIdMap);
        }

        for (const category of categories) {
          if (!editableLocalProjectIds.has(category.projectId)) {
            continue;
          }

          const projectId = remoteProjectId(category.projectId);
          if (!isUuid(projectId)) {
            continue;
          }

          const shouldSyncCategory =
            shouldSyncAllWorkspace ||
            !isUuid(category.id) ||
            dirtyCategoryIds.has(category.id) ||
            projectIdMap.has(category.projectId);

          if (!shouldSyncCategory) {
            continue;
          }

          const categoryPayload = {
            color: category.color,
            created_by: syncAuthUser.id,
            name: category.name,
            project_id: projectId,
          };

          if (isUuid(category.id)) {
            const { error } = await supabase!
              .from("task_categories")
              .upsert(
                {
                  id: category.id,
                  ...categoryPayload,
                },
                { onConflict: "id" },
              );
            if (error) {
              throw new Error(error.message);
            }
          } else {
            const { data, error } = await supabase!
              .from("task_categories")
              .insert(categoryPayload)
              .select("id")
              .single();
            if (error) {
              throw new Error(error.message);
            }
            if (data?.id) {
              categoryIdMap.set(category.id, data.id);
            }
          }
        }

        const syncedEditableTasks: Task[] = [];

        for (const [sortOrder, task] of tasks.entries()) {
          if (!editableLocalProjectIds.has(task.projectId)) {
            continue;
          }

          const projectId = remoteProjectId(task.projectId);
          if (!isUuid(projectId)) {
            continue;
          }

          const shouldSyncTask =
            shouldSyncAllWorkspace ||
            !isUuid(task.id) ||
            dirtyTaskIds.has(task.id) ||
            projectIdMap.has(task.projectId) ||
            Boolean(task.categoryId && categoryIdMap.has(task.categoryId));

          if (!shouldSyncTask) {
            continue;
          }

          const mappedCategoryId = task.categoryId
            ? mapId(task.categoryId, categoryIdMap)
            : null;
          const taskPayload = {
            category_id: mappedCategoryId && isUuid(mappedCategoryId)
              ? mappedCategoryId
              : null,
            completed_at: task.completedAt ?? null,
            created_by: syncAuthUser.id,
            due_label: task.due || null,
            estimate_minutes: normalizeInteger(task.estimate, 1, 480, settings.focusMinutes),
            note: task.description,
            priority: task.priority,
            project_id: projectId,
            sort_order: sortOrder,
            spent_minutes: Math.max(0, Math.round(task.spent)),
            status: task.status || "todo",
            title: task.title || "Untitled task",
          };

          if (isUuid(task.id)) {
            const { error } = await supabase!
              .from("tasks")
              .upsert(
                {
                  id: task.id,
                  ...taskPayload,
                },
                { onConflict: "id" },
              );
            if (error) {
              throw new Error(error.message);
            }
          } else {
            const { data, error } = await supabase!
              .from("tasks")
              .insert(taskPayload)
              .select("id")
              .single();
            if (error) {
              throw new Error(error.message);
            }
            if (data?.id) {
              taskIdMap.set(task.id, data.id);
            }
          }

          syncedEditableTasks.push(task);
        }

        const syncedTaskIds = syncedEditableTasks
          .map((task) => mapId(task.id, taskIdMap))
          .filter(isUuid);

        if (syncedTaskIds.length) {
          const tagDelete = await supabase!
            .from("task_tags")
            .delete()
            .in("task_id", syncedTaskIds);
          if (tagDelete.error) {
            throw new Error(tagDelete.error.message);
          }

          const tagRows = syncedEditableTasks.flatMap((task) => {
            const taskId = mapId(task.id, taskIdMap);
            return Array.from(new Set(task.tags.map(normalizeTag).filter(Boolean))).map(
              (label) => ({
                label,
                task_id: taskId,
              }),
            );
          });

          if (tagRows.length) {
            const { error } = await supabase!
              .from("task_tags")
              .upsert(tagRows, { onConflict: "task_id,label" });
            if (error) {
              throw new Error(error.message);
            }
          }

          const subtaskDelete = await supabase!
            .from("task_subtasks")
            .delete()
            .in("task_id", syncedTaskIds);
          if (subtaskDelete.error) {
            throw new Error(subtaskDelete.error.message);
          }

          const subtaskRefs: Array<{
            localId: string;
            sortOrder: number;
            taskId: string;
          }> = [];
          const subtaskRows = syncedEditableTasks.flatMap((task) => {
            const taskId = mapId(task.id, taskIdMap);
            return task.subtasks.map((subtask, sortOrder) => {
              subtaskRefs.push({
                localId: subtask.id,
                sortOrder,
                taskId,
              });
              return {
                ...(isUuid(subtask.id) ? { id: subtask.id } : {}),
                is_done: subtask.done,
                sort_order: sortOrder,
                task_id: taskId,
                title: subtask.title || "Untitled subtask",
              };
            });
          });

          if (subtaskRows.length) {
            const { data, error } = await supabase!
              .from("task_subtasks")
              .upsert(subtaskRows, { onConflict: "id" })
              .select("id,task_id,sort_order");
            if (error) {
              throw new Error(error.message);
            }

            const remoteSubtasks = (data ?? []) as Array<{
              id: string;
              sort_order: number;
              task_id: string;
            }>;
            const localSubtaskByRemotePosition = new Map(
              subtaskRefs.map((subtask) => [
                `${subtask.taskId}:${subtask.sortOrder}`,
                subtask.localId,
              ]),
            );

            remoteSubtasks.forEach((remoteSubtask) => {
              const localId = localSubtaskByRemotePosition.get(
                `${remoteSubtask.task_id}:${remoteSubtask.sort_order}`,
              );
              if (localId && !isUuid(localId)) {
                subtaskIdMap.set(localId, remoteSubtask.id);
              }
            });
          }
        }

        for (const task of syncedEditableTasks) {
          const taskId = mapId(task.id, taskIdMap);
          if (!isUuid(taskId)) {
            continue;
          }

          for (const comment of task.comments) {
            const isCurrentUserComment =
              comment.authorId === syncAuthUser.id ||
              comment.authorId === currentUser.id;

            if (!isCurrentUserComment) {
              continue;
            }

            const commentPayload = {
              author_id: syncAuthUser.id,
              body: comment.body,
              created_at: comment.createdAt,
              task_id: taskId,
            };

            if (isUuid(comment.id)) {
              const { error } = await supabase!
                .from("task_comments")
                .upsert(
                  {
                    id: comment.id,
                    ...commentPayload,
                  },
                  { onConflict: "id" },
                );
              if (error) {
                throw new Error(error.message);
              }
            } else {
              const { data, error } = await supabase!
                .from("task_comments")
                .insert(commentPayload)
                .select("id")
                .single();
              if (error) {
                throw new Error(error.message);
              }
              if (data?.id) {
                commentIdMap.set(comment.id, data.id);
              }
            }
          }
        }

        for (const session of sessions) {
          if (session.userId && session.userId !== syncAuthUser.id) {
            continue;
          }

          const projectId = remoteProjectId(session.projectId);
          if (!isUuid(projectId)) {
            continue;
          }

          const mappedTaskId = session.taskId ? mapId(session.taskId, taskIdMap) : null;
          const sessionPayload = {
            completed_at: session.completedAt,
            minutes: normalizeInteger(session.minutes, 1, 480, settings.focusMinutes),
            note: session.note,
            project_id: projectId,
            task_id: mappedTaskId && isUuid(mappedTaskId) ? mappedTaskId : null,
            user_id: syncAuthUser.id,
          };

          if (isUuid(session.id)) {
            const { error } = await supabase!
              .from("focus_sessions")
              .upsert(
                {
                  id: session.id,
                  ...sessionPayload,
                },
                { onConflict: "id" },
              );
            if (error) {
              throw new Error(error.message);
            }
          } else {
            const { data, error } = await supabase!
              .from("focus_sessions")
              .insert(sessionPayload)
              .select("id")
              .single();
            if (error) {
              throw new Error(error.message);
            }
            if (data?.id) {
              sessionIdMap.set(session.id, data.id);
            }
          }
        }

        for (const cancellation of cancellations) {
          if (cancellation.userId && cancellation.userId !== syncAuthUser.id) {
            continue;
          }

          const projectId = remoteProjectId(cancellation.projectId);
          if (!isUuid(projectId)) {
            continue;
          }

          const mappedTaskId = cancellation.taskId
            ? mapId(cancellation.taskId, taskIdMap)
            : null;
          const durationMinutes = normalizeInteger(
            cancellation.durationMinutes,
            5,
            180,
            settings.focusMinutes,
          );
          const cancellationPayload = {
            cancelled_at: cancellation.cancelledAt,
            duration_minutes: durationMinutes,
            elapsed_minutes: Math.min(
              durationMinutes,
              Math.max(0, Math.round(cancellation.elapsedMinutes)),
            ),
            note: cancellation.note,
            project_id: projectId,
            reason: cancellation.reason,
            task_id: mappedTaskId && isUuid(mappedTaskId) ? mappedTaskId : null,
            user_id: syncAuthUser.id,
          };

          if (isUuid(cancellation.id)) {
            const { error } = await supabase!
              .from("pomodoro_cancellations")
              .upsert(
                {
                  id: cancellation.id,
                  ...cancellationPayload,
                },
                { onConflict: "id" },
              );
            if (error) {
              throw new Error(error.message);
            }
          } else {
            const { data, error } = await supabase!
              .from("pomodoro_cancellations")
              .insert(cancellationPayload)
              .select("id")
              .single();
            if (error) {
              throw new Error(error.message);
            }
            if (data?.id) {
              cancellationIdMap.set(cancellation.id, data.id);
            }
          }
        }

        const hasMappedIds = [
          projectIdMap,
          categoryIdMap,
          taskIdMap,
          subtaskIdMap,
          commentIdMap,
          sessionIdMap,
          cancellationIdMap,
        ].some((idMap) => idMap.size > 0);

        if (cancelled) {
          return;
        }

        fullRemoteSyncNeededRef.current = false;
        dirtyProjectIds.forEach((projectId) => {
          dirtyProjectIdsRef.current.delete(projectId);
        });
        dirtyCategoryIds.forEach((categoryId) => {
          dirtyCategoryIdsRef.current.delete(categoryId);
        });
        dirtyTaskIds.forEach((taskId) => {
          dirtyTaskIdsRef.current.delete(taskId);
        });

        if (hasMappedIds) {
          setProjects((current) =>
            current.map((project) => ({
              ...project,
              id: mapId(project.id, projectIdMap),
              ownerId:
                project.currentUserRole === "owner"
                  ? syncAuthUser.id
                  : project.ownerId,
              teamMembers: project.teamMembers.map((member) =>
                member.role === "owner" &&
                (member.id === currentUser.id || member.id === project.ownerId)
                  ? {
                      ...member,
                      email: authEmail,
                      id: syncAuthUser.id,
                      name: appUserName,
                    }
                  : member,
              ),
            })),
          );
          setCategories((current) =>
            current.map((category) => ({
              ...category,
              id: mapId(category.id, categoryIdMap),
              projectId: mapId(category.projectId, projectIdMap),
            })),
          );
          setTasks((current) =>
            current.map((task) => ({
              ...task,
              categoryId: task.categoryId
                ? mapId(task.categoryId, categoryIdMap)
                : null,
              comments: task.comments.map((comment) => ({
                ...comment,
                authorId:
                  comment.authorId === currentUser.id
                    ? syncAuthUser.id
                    : comment.authorId,
                authorName:
                  comment.authorId === currentUser.id ? appUserName : comment.authorName,
                id: mapId(comment.id, commentIdMap),
              })),
              id: mapId(task.id, taskIdMap),
              projectId: mapId(task.projectId, projectIdMap),
              subtasks: task.subtasks.map((subtask) => ({
                ...subtask,
                id: mapId(subtask.id, subtaskIdMap),
              })),
            })),
          );
          setSessions((current) =>
            current.map((session) => ({
              ...session,
              id: mapId(session.id, sessionIdMap),
              projectId: mapId(session.projectId, projectIdMap),
              taskId: session.taskId ? mapId(session.taskId, taskIdMap) : null,
              userId: session.userId ?? syncAuthUser.id,
            })),
          );
          setCancellations((current) =>
            current.map((cancellation) => ({
              ...cancellation,
              id: mapId(cancellation.id, cancellationIdMap),
              projectId: mapId(cancellation.projectId, projectIdMap),
              taskId: cancellation.taskId
                ? mapId(cancellation.taskId, taskIdMap)
                : null,
              userId: cancellation.userId ?? syncAuthUser.id,
            })),
          );
          setActiveProjectId((current) => mapId(current, projectIdMap));
          setSelectedTaskId((current) => mapId(current, taskIdMap));
          setFocusTaskId((current) => mapId(current, taskIdMap));
        } else {
          lastRemoteSyncJsonRef.current = snapshotJson;
        }
      } catch (error) {
        if (!cancelled) {
          setProjectNotice(
            error instanceof Error
              ? `Sync issue: ${error.message}`
              : "Sync issue: your latest changes stayed in this browser.",
          );
        }
      } finally {
        remoteSyncInFlightRef.current = false;
        if (remoteSyncQueuedRef.current) {
          remoteSyncQueuedRef.current = false;
          setRemoteSyncRequestId((current) => current + 1);
        }
      }
    }

    const timeout = window.setTimeout(() => {
      void syncWorkspaceToRemote();
    }, 900);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    activeProjectId,
    appUserName,
    authEmail,
    authUser,
    cancellations,
    categories,
    focusTaskId,
    hydrated,
    projects,
    remoteSyncRequestId,
    selectedTaskId,
    sessions,
    settings,
    tasks,
  ]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.themeMode;
    document.documentElement.style.colorScheme = settings.themeMode;

    return () => {
      document.documentElement.removeAttribute("data-theme");
      document.documentElement.style.colorScheme = "";
    };
  }, [settings.themeMode]);

  const refreshRemoteWorkspace = useCallback(
    async (preferredProjectId?: string) => {
      if (!supabase || !authUser) {
        return;
      }

      const { error, plan, snapshot } = await loadRemoteWorkspaceSnapshot(
        authUser,
        preferredProjectId,
      );
      setProfilePlan(plan);

      if (error) {
        setProjectNotice(error);
        return;
      }

      if (snapshot?.projects.length) {
        applyWorkspaceSnapshot(snapshot);
      }
    },
    [applyWorkspaceSnapshot, authUser],
  );

  useEffect(() => {
    if (!authReady || !hydrated) {
      return;
    }

    const token = new URL(window.location.href).searchParams.get("invite");
    if (!token) {
      return;
    }

    let alive = true;

    async function acceptInvite() {
      if (supabase && authUser) {
        const { data, error } = await supabase.rpc("accept_project_invite", {
          invite_token: token,
        });

        if (!alive) {
          return;
        }

        if (error) {
          setProjectNotice(error.message);
          return;
        }

          const acceptedProject = Array.isArray(data) ? data[0] : null;
          if (acceptedProject?.project_id) {
            const acceptedRole = normalizeProjectRole(acceptedProject.role);
            setProjectNotice(
              `You joined ${acceptedProject.project_name} as ${projectRoleLabels[acceptedRole]}.`,
            );
          trackEvent("project_invite_accepted", {
            project_id: acceptedProject.project_id,
          });
          await refreshRemoteWorkspace(acceptedProject.project_id);
        }
      } else {
        let acceptedProjectId = "";
        let acceptedProjectName = "";
        const invitedEmail = normalizeEmail(authEmail);

        setProjects((currentProjects) =>
          currentProjects.map((project) => {
            const invite = project.pendingInvites.find(
              (item) =>
                item.token === token &&
                (!isValidEmail(invitedEmail) || item.email === invitedEmail),
            );

            if (!invite) {
              return project;
            }

              const member: ProjectMember = {
                id: createId("member"),
                name: invite.email.split("@")[0] || "Tockli teammate",
                email: invite.email,
                role: invite.role,
                joinedAt: new Date().toISOString(),
              };
            const teamMembers = normalizeProjectMembers([
              ...project.teamMembers,
              member,
            ]);
            const acceptedProject: Project = {
              ...project,
              kind: "team",
              teamMembers,
              members: teamMembers.length,
              pendingInvites: project.pendingInvites.filter(
                (item) => item.id !== invite.id,
              ),
            };
            acceptedProjectId = acceptedProject.id;
            acceptedProjectName = acceptedProject.name;
            return acceptedProject;
          }),
        );

        if (acceptedProjectId) {
          setActiveProjectId(acceptedProjectId);
          setProjectNotice(`Invite accepted for ${acceptedProjectName}.`);
        } else {
          setProjectNotice("This invite link was not found in this browser.");
        }
      }

      if (alive) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }

    void acceptInvite();

    return () => {
      alive = false;
    };
  }, [authEmail, authReady, authUser, hydrated, refreshRemoteWorkspace]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId),
    [activeProjectId, projects],
  );
  const activeBoardColumns = (
    activeProject?.columns ?? createDefaultBoardColumns()
  ).filter((column) => !column.archived);
  const archivedBoardColumns = (activeProject?.columns ?? []).filter(
    (column) => column.archived,
  );
  const activeDoneColumnId =
    activeBoardColumns.find((column) => column.isDone)?.id ?? "done";

  const projectTasks = useMemo(
    () => tasks.filter((task) => task.projectId === activeProjectId),
    [activeProjectId, tasks],
  );

  const activeProjectCategories = useMemo(
    () => categories.filter((category) => category.projectId === activeProjectId),
    [activeProjectId, categories],
  );

  const allProjectTags = useMemo(
    () =>
      Array.from(new Set(projectTasks.flatMap((task) => task.tags.map(normalizeTag))))
        .filter(Boolean)
        .sort(),
    [projectTasks],
  );

  const filteredProjectTasks = useMemo(() => {
    return projectTasks.filter((task) => {
      const matchesTags =
        !selectedTags.length ||
        selectedTags.some((tag) =>
          task.tags.map(normalizeTag).includes(tag),
        );
      const categoryName = activeProjectCategories.find(
        (category) => category.id === task.categoryId,
      )?.name;

      return (
        matchesTags && taskMatchesSearch(task, taskSearchQuery, categoryName)
      );
    });
  }, [activeProjectCategories, projectTasks, selectedTags, taskSearchQuery]);

  const selectedTask = useMemo(
    () =>
      projectTasks.find((task) => task.id === selectedTaskId) ??
      projectTasks.find((task) => task.status !== activeDoneColumnId) ??
      projectTasks[0],
    [activeDoneColumnId, projectTasks, selectedTaskId],
  );
  const taskDrawerTask = taskDraft ?? selectedTask;
  const focusTask = useMemo(
    () => tasks.find((task) => task.id === focusTaskId),
    [focusTaskId, tasks],
  );

  const teamProjectCount = projects.filter(
    (project) => project.kind === "team" && project.currentUserRole === "owner",
  ).length;
  const activeProjectCanEdit = activeProject?.currentUserRole !== "viewer";

  function canEditProject(projectId: string) {
    return projects.find((project) => project.id === projectId)?.currentUserRole !== "viewer";
  }

  function markProjectDirty(projectId: string) {
    dirtyProjectIdsRef.current.add(projectId);
  }

  function markCategoryDirty(categoryId: string) {
    dirtyCategoryIdsRef.current.add(categoryId);
  }

  function markTaskDirty(taskId: string) {
    dirtyTaskIdsRef.current.add(taskId);
  }

  const beginPomodoroTimer = useCallback((durationMinutes: number) => {
    const durationSeconds = durationMinutes * 60;
    timerDeadlineRef.current = Date.now() + durationSeconds * 1000;
    timerCompletionHandledRef.current = false;
    setSessionDurationMinutes(durationMinutes);
    setRemainingSeconds(durationSeconds);
    setIsRunning(true);
  }, []);

  const clearPomodoroDeadline = useCallback(() => {
    timerDeadlineRef.current = null;
    timerCompletionHandledRef.current = false;
  }, []);

  const activeGoal = settings.dailyPomodoroGoal;
  const todaysPomodoros = sessions.filter((session) =>
    isToday(session.completedAt),
  ).length;
  const progressPercent = Math.min(100, (todaysPomodoros / activeGoal) * 100);

  const completeFocusSession = useCallback(
    (minutes: number, note: string, completedAt = new Date().toISOString()) => {
      const completedTask = focusTask ?? null;
      const sessionProjectId = completedTask?.projectId ?? activeProjectId;
      const sessionProject = projects.find(
        (project) => project.id === sessionProjectId,
      );
      const session: FocusSession = {
        id: createUuid(),
        userId: appUserId,
        projectId: sessionProjectId,
        taskId: completedTask?.id ?? null,
        minutes,
        completedAt,
        note: note.trim() || "Focused session completed.",
      };

      trackEvent("session_completed", {
        has_task: Boolean(completedTask),
        minutes,
        project_kind: sessionProject?.kind ?? "unknown",
      });

      setSessions((current) => [session, ...current]);

      const canUpdateCompletedTask =
        completedTask &&
        projects.find((project) => project.id === completedTask.projectId)
          ?.currentUserRole !== "viewer";

      if (completedTask && canUpdateCompletedTask) {
        dirtyTaskIdsRef.current.add(completedTask.id);
        setTasks((current) =>
          current.map((task) =>
            task.id === completedTask.id
              ? {
                  ...task,
                  spent: task.spent + minutes,
                }
              : task,
          ),
        );
      }

      clearPomodoroDeadline();
      setSessionNote("");
      setIsRunning(false);
      setSessionDurationMinutes(settings.focusMinutes);
      setRemainingSeconds(settings.focusMinutes * 60);
      setCancelDialogOpen(false);
      setCancelStep("confirm");
      setCancelReason("");
    },
    [
      activeProjectId,
      appUserId,
      clearPomodoroDeadline,
      focusTask,
      projects,
      settings.focusMinutes,
    ],
  );

  const playSuccessChime = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextConstructor) {
      return;
    }

    const context = audioContextRef.current ?? new AudioContextConstructor();
    audioContextRef.current = context;
    void context.resume();

    const now = context.currentTime;

    const playNote = (frequency: number, startTime: number, duration: number) => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    // A friendly success chime (C5 -> E5 -> G5)
    playNote(523.25, now, 0.4);
    playNote(659.25, now + 0.15, 0.4);
    playNote(783.99, now + 0.3, 0.6);
  }, []);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    if (timerDeadlineRef.current === null) {
      timerDeadlineRef.current =
        Date.now() + sessionDurationMinutes * 60 * 1000;
      timerCompletionHandledRef.current = false;
    }

    function syncTimerWithClock() {
      const deadline = timerDeadlineRef.current;

      if (deadline === null || timerCompletionHandledRef.current) {
        return;
      }

      const nextRemainingSeconds = getRemainingTimerSeconds(deadline);
      setRemainingSeconds(nextRemainingSeconds);

      if (nextRemainingSeconds > 0) {
        return;
      }

      timerCompletionHandledRef.current = true;
      timerDeadlineRef.current = null;
      playSuccessChime();
      completeFocusSession(
        sessionDurationMinutes,
        sessionNote,
        new Date(deadline).toISOString(),
      );
    }

    syncTimerWithClock();
    const interval = window.setInterval(
      syncTimerWithClock,
      TIMER_SYNC_INTERVAL_MS,
    );
    document.addEventListener("visibilitychange", syncTimerWithClock);
    window.addEventListener("focus", syncTimerWithClock);
    window.addEventListener("pageshow", syncTimerWithClock);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", syncTimerWithClock);
      window.removeEventListener("focus", syncTimerWithClock);
      window.removeEventListener("pageshow", syncTimerWithClock);
    };
  }, [
    completeFocusSession,
    isRunning,
    playSuccessChime,
    sessionDurationMinutes,
    sessionNote,
  ]);

  function addTask(status: TaskStatus) {
    if (!activeProjectCanEdit) {
      return;
    }

    const task = moveTaskWithCompletion({
      id: createUuid(),
      projectId: activeProjectId,
      title: "Untitled task",
      status,
      estimate: settings.focusMinutes,
      spent: 0,
      priority: "medium",
      tags: [],
      description: "",
      categoryId: activeProjectCategories[0]?.id ?? null,
      subtasks: [],
      comments: [],
      due: "",
    }, status, activeBoardColumns) as Task;

    committedDraftTaskIdsRef.current.delete(task.id);
    setTaskDraft(task);
    setSelectedTaskId(task.id);
    setTaskDrawerOpen(true);
  }

  function toggleTag(tag: string) {
    const normalized = normalizeTag(tag);
    setSelectedTags((current) =>
      current.includes(normalized)
        ? current.filter((item) => item !== normalized)
        : [...current, normalized],
    );
  }

  function moveTask(
    taskId: string,
    status: TaskStatus,
    targetTaskId?: string,
    placement: "before" | "after" = "before",
  ) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || !canEditProject(task.projectId)) {
      return;
    }

    if (task.status === status && targetTaskId === taskId) {
      return;
    }

    setTasks((current) =>
      reorderTaskInList(
        current,
        taskId,
        status,
        activeBoardColumns,
        targetTaskId ?? null,
        placement,
      ),
    );
    tasks
      .filter((item) => item.projectId === task.projectId)
      .forEach((item) => markTaskDirty(item.id));

    if (task.status !== status) {
      trackEvent("task_status_changed", {
        from_status: task.status,
        project_kind: activeProject?.kind ?? "unknown",
        to_status: status,
      });
    }

    if (status === "active") {
      setSelectedTaskId(taskId);
    }
  }

  function renameBoardColumn(columnId: string, title: string) {
    if (!activeProjectCanEdit) {
      return;
    }

    const nextTitle = title.trim();

    if (!nextTitle) {
      return;
    }

    setProjects((current) =>
      current.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              columns: project.columns.map((column) =>
                column.id === columnId
                  ? { ...column, title: nextTitle }
                  : column,
              ),
            }
          : project,
      ),
    );
    markProjectDirty(activeProjectId);
  }

  function addBoardColumn(title: string) {
    if (!activeProjectCanEdit) {
      return;
    }

    const nextTitle = title.trim();

    if (!nextTitle) {
      return;
    }

    const column: BoardColumn = {
      id: createId("column"),
      title: nextTitle,
    };

    setProjects((current) =>
      current.map((project) =>
        project.id === activeProjectId
          ? { ...project, columns: [...project.columns, column] }
          : project,
      ),
    );
    markProjectDirty(activeProjectId);
    trackEvent("board_column_created", {
      project_kind: activeProject?.kind ?? "unknown",
    });
  }

  function reorderBoardColumn(sourceColumnId: string, targetColumnId: string) {
    if (!activeProjectCanEdit) {
      return;
    }

    setProjects((current) =>
      current.map((project) => {
        if (project.id !== activeProjectId) {
          return project;
        }

        const sourceIndex = project.columns.findIndex(
          (column) => column.id === sourceColumnId,
        );
        const targetIndex = project.columns.findIndex(
          (column) => column.id === targetColumnId,
        );

        if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
          return project;
        }

        const columns = [...project.columns];
        const [movedColumn] = columns.splice(sourceIndex, 1);
        columns.splice(targetIndex, 0, movedColumn);
        return { ...project, columns };
      }),
    );
    markProjectDirty(activeProjectId);
  }

  function archiveBoardColumn(columnId: string) {
    if (!activeProjectCanEdit) {
      return;
    }

    const project = projects.find((item) => item.id === activeProjectId);
    const activeColumns =
      project?.columns.filter((column) => !column.archived) ?? [];

    if (activeColumns.length <= 1) {
      return;
    }

    setProjects((current) =>
      current.map((item) =>
        item.id === activeProjectId
          ? {
              ...item,
              columns: item.columns.map((column) =>
                column.id === columnId
                  ? { ...column, archived: true }
                  : column,
              ),
            }
          : item,
      ),
    );
    markProjectDirty(activeProjectId);
  }

  function restoreBoardColumn(columnId: string) {
    if (!activeProjectCanEdit) {
      return;
    }

    setProjects((current) =>
      current.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              columns: project.columns.map((column) =>
                column.id === columnId
                  ? { ...column, archived: false }
                  : column,
              ),
            }
          : project,
      ),
    );
    markProjectDirty(activeProjectId);
  }

  function deleteBoardColumn(columnId: string) {
    if (!activeProjectCanEdit) {
      return;
    }

    const project = projects.find((item) => item.id === activeProjectId);
    const activeColumns =
      project?.columns.filter((column) => !column.archived) ?? [];

    if (!project || activeColumns.length <= 1) {
      return;
    }

    const deletedIndex = activeColumns.findIndex(
      (column) => column.id === columnId,
    );

    if (deletedIndex === -1) {
      return;
    }

    const deletedColumn = activeColumns[deletedIndex];
    const remainingActiveColumns = activeColumns.filter(
      (column) => column.id !== columnId,
    );
    const fallbackColumn =
      remainingActiveColumns[
        Math.min(deletedIndex, remainingActiveColumns.length - 1)
      ];

    let promotedDoneColumnId: string | null = null;
    if (
      deletedColumn.isDone &&
      !remainingActiveColumns.some((column) => column.isDone)
    ) {
      const promotedDoneColumn = remainingActiveColumns.at(-1)!;
      promotedDoneColumnId = promotedDoneColumn.id;
      remainingActiveColumns[remainingActiveColumns.length - 1] = {
        ...promotedDoneColumn,
        isDone: true,
      };
    }
    const remainingColumnById = new Map(
      remainingActiveColumns.map((column) => [column.id, column]),
    );
    const remainingColumns = project.columns
      .filter((column) => column.id !== columnId)
      .map((column) => remainingColumnById.get(column.id) ?? column);
    const affectedTaskIds = taskIdsAffectedByColumnDeletion(
      tasks,
      activeProjectId,
      columnId,
      promotedDoneColumnId,
    );

    setProjects((current) =>
      current.map((item) =>
        item.id === activeProjectId
          ? { ...item, columns: remainingColumns }
          : item,
      ),
    );
    setTasks((current) =>
      current.map((task) =>
        task.projectId === activeProjectId
          ? moveTaskWithCompletion(
              task,
              task.status === columnId ? fallbackColumn.id : task.status,
              remainingActiveColumns,
            )
          : task,
      ),
    );
    markProjectDirty(activeProjectId);
    affectedTaskIds.forEach(markTaskDirty);
    trackEvent("board_column_deleted", {
      moved_tasks: tasks.filter(
        (task) =>
          task.projectId === activeProjectId && task.status === columnId,
      ).length,
      project_kind: project.kind,
    });
  }

  function selectTaskForEdit(taskId: string) {
    setTaskDraft(null);
    setSelectedTaskId(taskId);
    setTaskDrawerOpen(true);
  }

  function updateTaskDraft(taskId: string, updates: Partial<Task>) {
    setTaskDraft((current) =>
      current?.id === taskId ? applyTaskUpdates(current, updates) : current,
    );
  }

  function updateTask(taskId: string, updates: Partial<Task>) {
    const existingTask = tasks.find((task) => task.id === taskId);
    if (!existingTask || !canEditProject(existingTask.projectId)) {
      return;
    }

    markTaskDirty(taskId);
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? moveTaskWithCompletion(
              applyTaskUpdates(task, updates),
              updates.status ?? task.status,
              projects.find((project) => project.id === task.projectId)?.columns ??
                createDefaultBoardColumns(),
            )
          : task,
      ),
    );
  }

  function closeTaskDrawer(pendingUpdates?: Partial<Task>) {
    if (taskDraft) {
      if (committedDraftTaskIdsRef.current.has(taskDraft.id)) {
        setTaskDraft(null);
        setTaskDrawerOpen(false);
        return;
      }

      const task = prepareTaskForSave(
        applyTaskUpdates(taskDraft, pendingUpdates ?? {}),
      );
      committedDraftTaskIdsRef.current.add(task.id);
      markTaskDirty(task.id);
      setTasks((current) =>
        current.some((item) => item.id === task.id) ? current : [task, ...current],
      );
      setSelectedTaskId(task.id);
      setTaskDraft(null);
      setTaskDrawerOpen(false);
      trackEvent("task_created", {
        project_kind: activeProject?.kind ?? "unknown",
        status: task.status,
      });
      return;
    }

    if (pendingUpdates && selectedTask) {
      updateTask(selectedTask.id, pendingUpdates);
    }

    setTaskDrawerOpen(false);
  }

  function handleDeleteTask(taskId: string) {
    if (taskDraft?.id === taskId) {
      setTaskDraft(null);
      setTaskDrawerOpen(false);
      setSelectedTaskId(projectTasks[0]?.id ?? "");
      return;
    }

    void deleteTask(taskId);
  }

  async function deleteTask(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || !canEditProject(task.projectId)) {
      return;
    }

    if (isRunning && focusTaskId === taskId) {
      return;
    }

    if (supabase && authUser && isUuid(task.id)) {
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);

      if (error) {
        setProjectNotice(error.message);
        return;
      }
    }

    setTasks((current) => current.filter((task) => task.id !== taskId));
    setSessions((current) =>
      current.map((session) =>
        session.taskId === taskId ? { ...session, taskId: null } : session,
      ),
    );

    if (selectedTaskId === taskId) {
      const fallbackTask = projectTasks.find((task) => task.id !== taskId);
      setSelectedTaskId(fallbackTask?.id ?? "");
      setTaskDrawerOpen(false);
    }

    if (focusTaskId === taskId) {
      setFocusTaskId("");
    }
  }

  function createCategory(name: string, color: string) {
    if (!activeProjectCanEdit) {
      return activeProjectCategories[0]?.id ?? "";
    }

    const category: TaskCategory = {
      id: createUuid(),
      projectId: activeProjectId,
      name: name.trim() || "New Category",
      color,
    };

    markCategoryDirty(category.id);
    setCategories((current) => [...current, category]);
    return category.id;
  }

  function openCreateProjectDialog(kind: ProjectKind = "personal") {
    setProjectDialog({ mode: "create", kind });
  }

  function openEditProjectDialog(projectId = activeProjectId) {
    const project = projects.find((item) => item.id === projectId);
    if (!project || project.currentUserRole !== "owner") {
      return;
    }

    setProjectDialog({ mode: "edit", projectId });
  }

  async function ensureRemoteProject(project: Project) {
    if (!supabase || !authUser) {
      return project;
    }

    const projectPayload = {
      board_columns: project.columns,
      color: project.color,
      description: project.description,
      kind: project.kind,
      name: project.name,
      owner_id: authUser.id,
    };
    const { data, error } = isUuid(project.id)
      ? await supabase
          .from("projects")
          .upsert(
            {
              id: project.id,
              ...projectPayload,
            },
            { onConflict: "id" },
          )
          .select("id,owner_id,name,description,kind,color,board_columns")
          .single()
      : await supabase
          .from("projects")
          .insert(projectPayload)
          .select("id,owner_id,name,description,kind,color,board_columns")
          .single();

    if (error) {
      throw new Error(error.message);
    }

    const remoteProject = data as RemoteProjectRow;
    const migratedProject: Project = {
      ...project,
      id: remoteProject.id,
      ownerId: remoteProject.owner_id,
      currentUserRole: "owner",
      teamMembers: [
        createCurrentUserMember(appUserId, appUserName, authEmail),
      ],
      members: 1,
      pendingInvites: [],
    };

    setProjects((current) =>
      current.map((item) => (item.id === project.id ? migratedProject : item)),
    );
    setCategories((current) =>
      current.map((category) =>
        category.projectId === project.id
          ? { ...category, projectId: migratedProject.id }
          : category,
      ),
    );
    setTasks((current) =>
      current.map((task) =>
        task.projectId === project.id
          ? { ...task, projectId: migratedProject.id }
          : task,
      ),
    );
    setSessions((current) =>
      current.map((session) =>
        session.projectId === project.id
          ? { ...session, projectId: migratedProject.id }
          : session,
      ),
    );
    setCancellations((current) =>
      current.map((cancellation) =>
        cancellation.projectId === project.id
          ? { ...cancellation, projectId: migratedProject.id }
          : cancellation,
      ),
    );
    setActiveProjectId((current) =>
      current === project.id ? migratedProject.id : current,
    );

    return migratedProject;
  }

  async function sendRemoteProjectInvite(
    project: Project,
    email: string,
    role: ProjectMemberAccessRole,
  ) {
    const { data, error } = await supabase!.auth.getSession();

    if (error) {
      throw new Error(error.message);
    }

    const accessToken = data.session?.access_token;
    if (!accessToken) {
      throw new Error("Log in again before inviting team members.");
    }

    const response = await fetch("/api/project-invites", {
      body: JSON.stringify({
        email,
        projectId: project.id,
        role,
      }),
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response
      .json()
      .catch(() => null)) as {
      delivery?: ProjectInviteDelivery;
      deliveryError?: string;
      error?: string;
      invitation?: RemoteInviteRow;
    } | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? "Project invite email could not be sent.");
    }

    if (!payload?.invitation) {
      throw new Error("Project invite email could not be sent.");
    }

    return {
      delivery: payload.delivery ?? "transactional_email",
      deliveryError: payload.deliveryError,
      invite: mapRemoteInvite(payload.invitation),
    };
  }

  async function deliverLocalInviteEmail(
    email: string,
    projectName: string,
    token: string,
    role: ProjectMemberAccessRole,
  ) {
    openInviteEmailDraft(email, projectName, token, role);
    return "draft";
  }

  async function createProjectInvites(
    project: Project,
    emails: string[],
    role: ProjectMemberAccessRole,
  ) {
    const existingEmails = new Set([
      ...project.teamMembers.map((member) => normalizeEmail(member.email)),
      ...project.pendingInvites.map((invite) => normalizeEmail(invite.email)),
    ]);
    const inviteEmails = uniqueEmails(emails).filter(
      (email) => !existingEmails.has(email),
    );
    const createdInvites: ProjectInvite[] = [];
    let draftCount = 0;
    let manualLinkCount = 0;
    let manualLinkReason = "";
    let sentCount = 0;

    for (const email of inviteEmails) {
      if (supabase && authUser && isUuid(project.id)) {
        const result = await sendRemoteProjectInvite(project, email, role);
        createdInvites.push(result.invite);
        if (result.delivery === "manual_link") {
          manualLinkCount += 1;
          manualLinkReason ||= result.deliveryError ?? "";
        } else {
          sentCount += 1;
        }
      } else {
        const invite: ProjectInvite = {
          id: createId("invite"),
          email,
          role,
          token: createInviteToken(),
          status: "pending",
          invitedAt: new Date().toISOString(),
        };
        createdInvites.push(invite);
        await deliverLocalInviteEmail(
          email,
          project.name,
          invite.token,
          role,
        );
        draftCount += 1;
      }
    }

    if (sentCount || draftCount || manualLinkCount) {
      const notices = [];
      if (sentCount) {
        notices.push(`${sentCount} invite email${sentCount === 1 ? "" : "s"} sent.`);
      }
      if (manualLinkCount) {
        notices.push(
          `${manualLinkCount} invite link${
            manualLinkCount === 1 ? "" : "s"
          } created; email delivery needs attention, so use the copy link button.${
            manualLinkReason ? ` ${manualLinkReason}` : ""
          }`,
        );
      }
      if (draftCount) {
        notices.push(
          `${draftCount} invite email draft${draftCount === 1 ? "" : "s"} opened.`,
        );
      }
      setProjectNotice(notices.join(" "));
    }

    return createdInvites;
  }

  async function saveProjectFromDialog(values: ProjectDialogValues) {
    const name = values.name.trim() || "New Project";
    const creatingTeam = projectDialog?.mode === "create" && values.kind === "team";
    const existingProject =
      projectDialog?.mode === "edit"
        ? projects.find((project) => project.id === projectDialog.projectId)
        : null;
    const convertingToTeam =
      existingProject?.kind !== "team" && values.kind === "team";

    if (
      profilePlan === "free" &&
      teamProjectCount >= 1 &&
      (creatingTeam || convertingToTeam)
    ) {
      throw new Error("Free accounts can own one shared project.");
    }

    if (projectDialog?.mode === "edit") {
      if (!existingProject || existingProject.currentUserRole !== "owner") {
        throw new Error("Only the project admin can edit team members.");
        }

        const project = await ensureRemoteProject(existingProject);
        const retainedMemberIds = new Set(values.retainedMemberIds);
        const retainedInviteIds = new Set(values.retainedInviteIds);
        const retainedMemberRoleUpdates = project.teamMembers
          .filter(
            (member) =>
              member.role !== "owner" &&
              values.kind === "team" &&
              retainedMemberIds.has(member.id),
          )
          .map((member) => ({
            ...member,
            role: normalizeMemberAccessRole(values.memberRoles[member.id] ?? member.role),
          }));
        const removedMemberIds = project.teamMembers
          .filter(
            (member) =>
              member.role !== "owner" &&
            (values.kind !== "team" || !retainedMemberIds.has(member.id)),
        )
        .map((member) => member.id);
      const removedInviteIds = project.pendingInvites
        .filter(
          (invite) => values.kind !== "team" || !retainedInviteIds.has(invite.id),
        )
        .map((invite) => invite.id);

      if (supabase && authUser && isUuid(project.id)) {
        const { error } = await supabase
          .from("projects")
          .update({
            board_columns: project.columns,
            color: values.color,
            description: values.description.trim(),
            kind: values.kind,
            name,
          })
          .eq("id", project.id);

        if (error) {
            throw new Error(error.message);
          }

          if (removedMemberIds.length) {
            const { error: memberError } = await supabase
              .from("project_members")
              .delete()
              .eq("project_id", project.id)
              .in("user_id", removedMemberIds);

            if (memberError) {
              throw new Error(memberError.message);
            }
          }

          for (const member of retainedMemberRoleUpdates) {
            const { error: roleError } = await supabase
              .from("project_members")
              .update({ role: member.role })
              .eq("project_id", project.id)
              .eq("user_id", member.id);

            if (roleError) {
              throw new Error(roleError.message);
            }
          }

          if (removedInviteIds.length) {
          const { error: inviteError } = await supabase
            .from("project_invitations")
            .update({
              revoked_at: new Date().toISOString(),
              status: "revoked",
            })
            .eq("project_id", project.id)
            .in("id", removedInviteIds);

          if (inviteError) {
            throw new Error(inviteError.message);
          }
          }
        }

        const teamMembers =
          values.kind === "team"
            ? normalizeProjectMembers(
                project.teamMembers
                  .filter(
                    (member) =>
                      member.role === "owner" || retainedMemberIds.has(member.id),
                  )
                  .map((member) =>
                    member.role === "owner"
                      ? member
                      : {
                          ...member,
                          role: normalizeMemberAccessRole(
                            values.memberRoles[member.id] ?? member.role,
                          ),
                        },
                  ),
                1,
              )
            : project.teamMembers.filter((member) => member.role === "owner");
      const retainedInvites =
        values.kind === "team"
          ? project.pendingInvites.filter((invite) => retainedInviteIds.has(invite.id))
          : [];
      const nextProject: Project = {
        ...project,
        name,
        description: values.description.trim(),
        kind: values.kind,
        color: values.color,
        teamMembers,
        members: teamMembers.length,
          pendingInvites: retainedInvites,
        };
        const newInvites =
          values.kind === "team"
            ? await createProjectInvites(
                nextProject,
                values.inviteEmails,
                values.inviteRole,
              )
            : [];
      const finalProject = {
        ...nextProject,
        pendingInvites: [...nextProject.pendingInvites, ...newInvites],
      };

      setProjects((current) =>
        current.map((item) => (item.id === finalProject.id ? finalProject : item)),
      );
      markProjectDirty(finalProject.id);
      setActiveProjectId(finalProject.id);
      setProjectDialog(null);
      trackEvent("project_updated", {
        kind: values.kind,
        invited_members: newInvites.length,
        removed_members: removedMemberIds.length,
      });

      return;
    }

    const owner = createCurrentUserMember(appUserId, appUserName, authEmail);
    let project: Project = {
      id: createUuid(),
      ownerId: appUserId,
      name,
      description: values.description.trim(),
      kind: values.kind,
      color: values.color,
      currentUserRole: "owner",
      teamMembers: [owner],
      members: 1,
      pendingInvites: [],
      columns: createDefaultBoardColumns(),
    };

    if (supabase && authUser) {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          id: project.id,
          board_columns: project.columns,
          color: project.color,
          description: project.description,
          kind: project.kind,
          name: project.name,
          owner_id: authUser.id,
        })
        .select("id,owner_id,name,description,kind,color,board_columns")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const remoteProject = data as RemoteProjectRow;
      project = {
        ...project,
        id: remoteProject.id,
        ownerId: remoteProject.owner_id,
      };
    }

      const newInvites =
        values.kind === "team"
          ? await createProjectInvites(project, values.inviteEmails, values.inviteRole)
          : [];
    project = {
      ...project,
      pendingInvites: newInvites,
    };
    const defaultCategory: TaskCategory = {
      id: createUuid(),
      projectId: project.id,
      name: values.kind === "team" ? "Shared" : "Focus",
      color: project.color,
    };

    setProjects((current) => [...current, project]);
    markProjectDirty(project.id);
    markCategoryDirty(defaultCategory.id);
    setCategories((current) => [...current, defaultCategory]);
    setActiveProjectId(project.id);
    setSelectedTags([]);
    setTaskDraft(null);
    setTaskDrawerOpen(false);
    setProjectDialog(null);
    setView("board");
    trackEvent("project_created", {
      kind: values.kind,
      invited_members: newInvites.length,
    });

  }

  async function deleteProject(projectId: string) {
    const project = projects.find((item) => item.id === projectId);

    if (
      !project ||
      projects.length <= 1 ||
      (isRunning && focusTask?.projectId === projectId)
    ) {
      return;
    }

    if (supabase && authUser && isUuid(project.id)) {
      const { error } = await supabase.from("projects").delete().eq("id", project.id);

      if (error) {
        throw new Error(error.message);
      }
    }

    const nextProject = projects.find((item) => item.id !== projectId);
    setProjects((current) => current.filter((item) => item.id !== projectId));
    setCategories((current) =>
      current.filter((category) => category.projectId !== projectId),
    );
    setTasks((current) => current.filter((task) => task.projectId !== projectId));
    setSessions((current) =>
      current.filter((session) => session.projectId !== projectId),
    );
    setCancellations((current) =>
      current.filter((cancellation) => cancellation.projectId !== projectId),
    );

    if (activeProjectId === projectId && nextProject) {
      setActiveProjectId(nextProject.id);
      setSelectedTaskId("");
      setSelectedTags([]);
      setTaskDraft(null);
      setTaskDrawerOpen(false);
    }

    setProjectDialog(null);
    trackEvent("project_deleted", { kind: project.kind });
  }

  function finishOnboarding(choice: "examples" | "blank") {
    if (choice === "examples") {
      setProjects(initialProjects);
      setCategories(initialCategories);
      setTasks(initialTasks);
      setSessions(createDemoSessions());
      setCancellations([]);
      setActiveProjectId(initialProjects[0].id);
      setSelectedTaskId("task-wireframes");
    } else {
      const project: Project = {
        id: createUuid(),
        ownerId: appUserId,
        name: "My first board",
        description: "",
        kind: "personal",
        color: "#ff005e",
        currentUserRole: "owner",
        teamMembers: [createCurrentUserMember(appUserId, appUserName, authEmail)],
        members: 1,
        pendingInvites: [],
        columns: createDefaultBoardColumns(),
      };

      setProjects([project]);
      markProjectDirty(project.id);
      setCategories([]);
      setTasks([]);
      setSessions([]);
      setCancellations([]);
      setActiveProjectId(project.id);
      setSelectedTaskId("");
    }

    setFocusTaskId("");
    setSelectedTags([]);
    setTaskDraft(null);
    setTaskDrawerOpen(false);
    setView("board");
    setOnboardingOpen(false);
    setHydrated(true);
    window.history.replaceState({}, "", window.location.pathname);
    trackEvent("onboarding_completed", { board_choice: choice });
  }

  function updateFocusMinutes(minutes: number) {
    if (
      isRunning ||
      remainingSeconds < settings.focusMinutes * 60
    ) {
      return;
    }

    const focusMinutes = Math.min(180, Math.max(5, Math.round(minutes) || 5));
    setSettings((current) => ({ ...current, focusMinutes }));
    setSessionDurationMinutes(focusMinutes);
    setRemainingSeconds(focusMinutes * 60);
    trackEvent("settings_updated", {
      field: "focus_minutes",
      value: focusMinutes,
    });
  }

  function startTask(taskId: string, requestedMinutes: number) {
    setTaskDraft(null);
    setTaskDrawerOpen(false);
    setFocusTaskId(taskId);

    if (isRunning) {
      if (focusTaskId !== taskId) {
        trackEvent("focus_task_changed", {
          project_kind: activeProject?.kind ?? "unknown",
        });
      }
      return;
    }

    const durationMinutes = Math.min(
      180,
      Math.max(5, Math.round(requestedMinutes) || settings.focusMinutes),
    );
    beginPomodoroTimer(durationMinutes);
    trackEvent("timer_started", {
      focus_minutes: durationMinutes,
      has_task: true,
      project_kind: activeProject?.kind ?? "unknown",
    });
  }

  function startSelectedPomodoro() {
    if (isRunning || !focusTask) {
      return;
    }

    beginPomodoroTimer(settings.focusMinutes);
    trackEvent("timer_started", {
      focus_minutes: settings.focusMinutes,
      has_task: true,
      project_kind:
        projects.find((project) => project.id === focusTask.projectId)?.kind ??
        "unknown",
    });
  }

  function cancelPomodoro(reason: CancellationReason) {
    if (!isRunning) {
      return;
    }

    const task = focusTask ?? null;
    const projectId = task?.projectId ?? activeProjectId;
    const syncedRemainingSeconds =
      timerDeadlineRef.current === null
        ? remainingSeconds
        : getRemainingTimerSeconds(timerDeadlineRef.current);
    const elapsedSeconds = Math.max(
      0,
      sessionDurationMinutes * 60 - syncedRemainingSeconds,
    );
    const cancellation: PomodoroCancellation = {
      id: createUuid(),
      userId: appUserId,
      projectId,
      taskId: task?.id ?? null,
      durationMinutes: sessionDurationMinutes,
      elapsedMinutes: Math.floor(elapsedSeconds / 60),
      reason,
      cancelledAt: new Date().toISOString(),
      note: sessionNote.trim(),
    };

    setCancellations((current) => [cancellation, ...current]);
    trackEvent("timer_cancelled", {
      elapsed_minutes: cancellation.elapsedMinutes,
      focus_minutes: sessionDurationMinutes,
      has_task: Boolean(task),
      reason,
    });
    clearPomodoroDeadline();
    setIsRunning(false);
    setSessionNote("");
    setSessionDurationMinutes(settings.focusMinutes);
    setRemainingSeconds(settings.focusMinutes * 60);
    setCancelDialogOpen(false);
    setCancelStep("confirm");
    setCancelReason("");
  }


  function stopFocusSound() {
    if (audioPreviewTimeoutRef.current !== null) {
      window.clearTimeout(audioPreviewTimeoutRef.current);
      audioPreviewTimeoutRef.current = null;
    }

    try {
      audioNodeRef.current?.oscillator?.stop();
      audioNodeRef.current?.source?.stop();
    } catch {
      // Nodes can already be stopped during React effect cleanup.
    }

    audioNodeRef.current?.gain.disconnect();
    audioNodeRef.current = null;
  }

  function startFocusSound(sound: FocusSound, volume: number) {
    if (audioNodeRef.current || typeof window === "undefined") {
      return;
    }

    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextConstructor) {
      return;
    }

    const context = audioContextRef.current ?? new AudioContextConstructor();
    audioContextRef.current = context;
    void context.resume();

    const gain = context.createGain();
    const soundGain: Record<FocusSound, number> = {
      brown_noise: 0.018,
      clock_tick: 0.12,
      heavy_rain: 0.024,
      ocean_waves: 0.035,
      pulse: 0.025,
      rain: 0.018,
      thunderstorm: 0.04,
    };
    gain.gain.value = soundGain[sound] * (normalizeVolume(volume) / 100);
    gain.connect(context.destination);

    if (sound === "pulse") {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = 96;
      oscillator.connect(gain);
      oscillator.start();
      audioNodeRef.current = { gain, oscillator };
      return;
    }

    const bufferSeconds =
      sound === "clock_tick"
        ? 1
        : sound === "ocean_waves"
          ? 14
          : sound === "thunderstorm"
            ? 18
            : sound === "heavy_rain"
              ? 8
              : 2;
    const bufferSize = context.sampleRate * bufferSeconds;
    const buffer = context.createBuffer(2, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);
    let lastValue = 0;
    let lastRightValue = 0;

    for (let index = 0; index < bufferSize; index += 1) {
      const time = index / context.sampleRate;
      const white = Math.random() * 2 - 1;

      if (sound === "clock_tick") {
        const tickTime = time % 1;
        const mechanicalClick =
          (Math.sin(tickTime * Math.PI * 2 * 1760) * 0.7 +
            Math.sin(tickTime * Math.PI * 2 * 920) * 0.28) *
          Math.exp(-tickTime / 0.012);
        const woodenBody =
          Math.sin(tickTime * Math.PI * 2 * 174) *
          Math.exp(-tickTime / 0.075) *
          0.38;
        const tickNoise =
          white * Math.exp(-tickTime / 0.018) * 0.22;
        data[index] = mechanicalClick + woodenBody + tickNoise;
        rightData[index] =
          mechanicalClick * 0.94 + woodenBody * 0.82 + tickNoise * 0.7;
        continue;
      }

      lastValue = (lastValue + 0.02 * white) / 1.02;
      const rightWhite = Math.random() * 2 - 1;
      lastRightValue = (lastRightValue + 0.02 * rightWhite) / 1.02;

      if (sound === "brown_noise") {
        data[index] = lastValue * 0.8;
      } else if (sound === "rain") {
        data[index] = white * 0.18 + lastValue * 0.08;
      } else if (sound === "heavy_rain") {
        const gust = 0.72 + Math.sin(time * 0.8) * 0.12;
        data[index] = white * 0.3 * gust + lastValue * 0.14;
      } else if (sound === "ocean_waves") {
        const swell =
          0.08 +
          Math.pow(
            0.5 +
              0.5 *
                Math.sin(time * 0.58 + Math.sin(time * 0.13) * 0.8),
            2,
          ) *
            0.92;
        const foam = Math.max(0, swell - 0.58) * white * 0.15;
        data[index] = (lastValue * 0.72 + white * 0.035 + foam) * swell;
        rightData[index] =
          (lastRightValue * 0.72 + rightWhite * 0.035 + foam * 0.7) *
          Math.min(1, swell * 0.94 + 0.05);
        continue;
      } else if (sound === "thunderstorm") {
        let rumble = 0;

        for (const strikeTime of [3.2, 11.4]) {
          const sinceStrike = time - strikeTime;
          if (sinceStrike >= 0 && sinceStrike < 4.5) {
            rumble +=
              Math.sin(sinceStrike * Math.PI * 2 * 42) *
              Math.exp(-sinceStrike / 1.6) *
              0.55;
            rumble += lastValue * Math.exp(-sinceStrike / 2.4) * 0.8;
          }
        }

        data[index] = white * 0.1 + lastValue * 0.12 + rumble;
      }

      rightData[index] = data[index] * 0.82 + lastRightValue * 0.1 + rightWhite * 0.025;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value =
      sound === "clock_tick" ? 3600 : sound === "thunderstorm" ? 1500 : 2400;
    filter.Q.value = sound === "clock_tick" ? 0.45 : 0.2;
    source.connect(filter);
    filter.connect(gain);
    source.start();
    audioNodeRef.current = { gain, source };
  }

  function previewFocusSound(sound: FocusSound) {
    if (isRunning) {
      return;
    }

    stopFocusSound();
    startFocusSound(sound, settings.focusVolume);
    audioPreviewTimeoutRef.current = window.setTimeout(() => {
      audioPreviewTimeoutRef.current = null;
      stopFocusSound();
    }, 5000);
  }

  useEffect(() => {
    if (isRunning && settings.soundEnabled) {
      startFocusSound(settings.focusSound, settings.focusVolume);
    } else {
      stopFocusSound();
    }

    return stopFocusSound;
  }, [
    isRunning,
    settings.focusSound,
    settings.focusVolume,
    settings.soundEnabled,
  ]);

  const totalSessionSeconds = Math.max(1, sessionDurationMinutes * 60);
  const timerProgress = Math.min(
    100,
    Math.max(
      0,
      ((totalSessionSeconds - remainingSeconds) / totalSessionSeconds) * 100,
    ),
  );
  const isDarkTheme = settings.themeMode === "dark";

  async function signOut() {
    trackEvent("cta_clicked", {
      cta: "sign_out",
      destination: "/login",
      surface: "app_account",
    });

    if (supabase) {
      await supabase.auth.signOut();
    }

    window.location.assign("/login");
  }

  if (!authReady) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 text-[var(--foreground)]"
        data-theme={settings.themeMode}
      >
        <section className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-card)]">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-[var(--accent)] text-white">
            <TimerReset size={22} aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-xl font-semibold">Checking your session</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Tockli will open your workspace once login is confirmed.
          </p>
        </section>
      </main>
    );
  }

  if (authMessage) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 text-[var(--foreground)]"
        data-theme={settings.themeMode}
      >
        <section className="w-full max-w-md rounded-lg border border-[var(--accent-border)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-card)]">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--danger)]">
            <LogIn size={22} aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-xl font-semibold">Login could not be verified</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{authMessage}</p>
          <Link
            className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
            href="/login?next=/app"
          >
            Return to login
          </Link>
        </section>
      </main>
    );
  }

  if (!hydrated) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 text-[var(--foreground)]"
        data-theme={settings.themeMode}
      >
        <section
          aria-live="polite"
          className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-card)]"
        >
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
            <FolderKanban size={22} aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-xl font-semibold">Loading your workspace</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Your projects and tasks will appear once they are ready.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-[var(--background)] text-[var(--foreground)]"
      data-theme={settings.themeMode}
    >
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-[var(--overlay)]"
            type="button"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside
            aria-label="Project and workspace navigation"
            aria-modal="true"
            className="relative flex h-full w-[min(88vw,320px)] flex-col border-r border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-modal)]"
            id="mobile-navigation"
            role="dialog"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--accent)] text-white">
                  <TimerReset size={20} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Tockli</p>
                  <p className="text-xs text-[var(--muted)]">
                    {planLabels[profilePlan]} plan
                  </p>
                </div>
              </div>
              <button
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface-hover)]"
                type="button"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <label className="flex h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--muted)]">
                <Search size={16} aria-hidden="true" />
                <span className="sr-only">Search tasks</span>
                <input
                  aria-label="Search tasks"
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--subtle)]"
                  placeholder="Search tasks"
                  type="search"
                  value={taskSearchQuery}
                  onChange={(event) => setTaskSearchQuery(event.target.value)}
                />
              </label>

              <div className="mb-6 mt-6">
                <div className="mb-2 flex items-center justify-between px-2 text-xs font-semibold uppercase text-[var(--muted)]">
                  <span>Projects</span>
                  <button
                    aria-label="Create personal project"
                    title="Create personal project"
                    className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--accent)]"
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openCreateProjectDialog("personal");
                    }}
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </div>

                <div className="space-y-1">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className={`group flex w-full items-center gap-1 rounded-md text-sm transition ${
                        activeProjectId === project.id
                          ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
                          : "text-[var(--muted)] hover:bg-[var(--surface-soft)]"
                      }`}
                    >
                      <button
                        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
                        type="button"
                        onClick={() => {
                          setActiveProjectId(project.id);
                          setSelectedTags([]);
                          setTaskDraft(null);
                          setTaskDrawerOpen(false);
                          setMobileMenuOpen(false);
                        }}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: project.color }}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {project.name}
                        </span>
                        {project.kind === "team" ? (
                          <Users className="shrink-0" size={15} aria-hidden="true" />
                        ) : null}
                      </button>
                      <button
                        aria-label={`Manage ${project.name}`}
                        title={`Manage ${project.name}`}
                        className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--muted)] transition enabled:hover:bg-[var(--surface)] enabled:hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30"
                        disabled={project.currentUserRole !== "owner"}
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          openEditProjectDialog(project.id);
                        }}
                      >
                        <MoreHorizontal size={16} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <nav aria-label="Workspace views" className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.id === view;

                  return (
                    <button
                      key={item.id}
                      aria-current={active ? "page" : undefined}
                      className={`flex w-full items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition ${
                        active
                          ? "border-[var(--accent)] bg-[var(--surface-hover)] text-[var(--foreground)]"
                          : "border-transparent text-[var(--muted)] hover:bg-[var(--surface-soft)]"
                      }`}
                      type="button"
                      onClick={() => {
                        setView(item.id);
                        setMobileMenuOpen(false);
                      }}
                    >
                      <Icon size={18} aria-hidden="true" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>
        </div>
      ) : null}
      <div className="flex min-h-screen">
        <aside className="hidden w-[280px] shrink-0 border-r border-[var(--border)] bg-[var(--surface)] lg:flex lg:flex-col">
          <div className="border-b border-[var(--border)] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--accent)] text-white">
                <TimerReset size={20} aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Tockli</h1>
                <p className="text-xs text-[var(--muted)]">{planLabels[profilePlan]} plan</p>
              </div>
            </div>

          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between px-2 text-xs font-semibold uppercase text-[var(--muted)]">
                <span>Projects</span>
                <button
                  aria-label="Create personal project"
                  title="Create personal project"
                  className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--accent)]"
                  type="button"
                  onClick={() => openCreateProjectDialog("personal")}
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-1">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className={`group flex w-full items-center gap-1 rounded-md text-sm transition ${
                      activeProjectId === project.id
                        ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
                        : "text-[var(--muted)] hover:bg-[var(--surface-soft)]"
                    }`}
                  >
                    <button
                      className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
                      type="button"
                      onClick={() => {
                        setActiveProjectId(project.id);
                        setSelectedTags([]);
                        setTaskDraft(null);
                        setTaskDrawerOpen(false);
                      }}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: project.color }}
                      />
                      <span className="min-w-0 flex-1 truncate">{project.name}</span>
                      {project.kind === "team" ? (
                        <Users className="shrink-0" size={15} aria-hidden="true" />
                      ) : null}
                    </button>
                    <button
                      aria-label={`Manage ${project.name}`}
                      title={`Manage ${project.name}`}
                      className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--muted)] opacity-0 transition enabled:hover:bg-[var(--surface)] enabled:hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30 group-hover:opacity-100 focus:opacity-100"
                      disabled={project.currentUserRole !== "owner"}
                      type="button"
                      onClick={() => openEditProjectDialog(project.id)}
                    >
                      <MoreHorizontal size={16} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.id === view;

                return (
                  <button
                    key={item.id}
                    className={`flex w-full items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition ${
                      active
                        ? "border-[var(--accent)] bg-[var(--surface-hover)] text-[var(--foreground)]"
                        : "border-transparent text-[var(--muted)] hover:bg-[var(--surface-soft)]"
                    }`}
                    type="button"
                    onClick={() => setView(item.id)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-[var(--border)] p-4">
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Share2 size={16} aria-hidden="true" />
                1 shared project
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {profilePlan === "free"
                  ? `${teamProjectCount}/1 used on Free`
                  : `${teamProjectCount} shared projects`}
              </p>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface-translucent)] px-4 py-3 backdrop-blur md:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <button
                  aria-controls="mobile-navigation"
                  aria-expanded={mobileMenuOpen}
                  aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                  title={mobileMenuOpen ? "Close menu" : "Open menu"}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted)] lg:hidden"
                  type="button"
                  onClick={() => setMobileMenuOpen((current) => !current)}
                >
                  <Menu size={19} aria-hidden="true" />
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                    {activeProject?.kind === "team" ? "Shared Project" : "Personal Project"}
                  </p>
                  <h2 className="truncate text-2xl font-semibold">
                    {activeProject?.name ?? "Tockli"}
                  </h2>
                  {activeProject?.currentUserRole === "viewer" ? (
                    <p className="mt-0.5 text-xs font-semibold text-[var(--muted)]">
                      Read-only access
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isRunning ? (
                  <div className="flex h-11 min-w-0 overflow-hidden rounded-md border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--danger)]">
                    <button
                      aria-label={`Open Pomodoro for ${
                        focusTask?.title ?? "focus session"
                      }, ${formatTimer(remainingSeconds)} remaining`}
                      className="flex min-w-0 items-center gap-2 px-3 text-left transition hover:bg-[var(--accent-soft-hover)]"
                      type="button"
                      onClick={() => setView("timer")}
                    >
                      <Clock3
                        className="shrink-0 animate-pulse motion-reduce:animate-none"
                        size={17}
                        aria-hidden="true"
                      />
                      <span className="hidden min-w-0 max-w-40 sm:block">
                        <span className="block truncate text-xs font-semibold">
                          {focusTask?.title ?? "Focus session"}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                        {formatTimer(remainingSeconds)}
                      </span>
                    </button>
                    <button
                      aria-label="Cancel Pomodoro"
                      title="Cancel Pomodoro"
                      className="flex w-9 shrink-0 items-center justify-center border-l border-[var(--accent-border)] transition hover:bg-[var(--accent-border)]"
                      type="button"
                      onClick={() => {
                        setCancelStep("confirm");
                        setCancelReason("");
                        setCancelDialogOpen(true);
                      }}
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
                <label className="hidden h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--muted)] md:flex">
                  <Search size={16} aria-hidden="true" />
                  <span className="sr-only">Search tasks</span>
                  <input
                    aria-label="Search tasks"
                    className="w-44 bg-transparent outline-none placeholder:text-[var(--subtle)]"
                    placeholder="Search tasks"
                    type="search"
                    value={taskSearchQuery}
                    onChange={(event) => setTaskSearchQuery(event.target.value)}
                  />
                </label>
                {activeProjectCanEdit ? (
                  <button
                    aria-label="Edit project"
                    title="Edit project"
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    type="button"
                    onClick={() => openEditProjectDialog()}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                ) : null}
                <button
                  aria-label={isDarkTheme ? "Switch to light mode" : "Switch to dark mode"}
                  title={isDarkTheme ? "Switch to light mode" : "Switch to dark mode"}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  type="button"
                  onClick={() =>
                    setSettings((current) => ({
                      ...current,
                      themeMode: current.themeMode === "dark" ? "light" : "dark",
                    }))
                  }
                >
                  {isDarkTheme ? (
                    <Sun size={16} aria-hidden="true" />
                  ) : (
                    <Moon size={16} aria-hidden="true" />
                  )}
                </button>
                <button
                  aria-label="Notifications"
                  title="Notifications"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:text-[var(--accent)]"
                  type="button"
                >
                  <Bell size={17} aria-hidden="true" />
                </button>
                <button
                  aria-label="Sign out"
                  title="Sign out"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  type="button"
                  onClick={signOut}
                >
                  <LogOut size={16} aria-hidden="true" />
                </button>
                <Link
                  aria-label="Manage account"
                  className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--accent)] text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
                  href="/account"
                  title={authEmail}
                >
                  {authInitial}
                </Link>
              </div>
            </div>

            <div className="mt-3 flex gap-1 overflow-x-auto lg:hidden">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.id === view;

                return (
                  <button
                    key={item.id}
                    className={`flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm ${
                      active
                        ? "bg-[var(--accent)] text-white"
                        : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
                    }`}
                    type="button"
                    onClick={() => setView(item.id)}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </header>

          <div className="flex-1 p-4 md:p-8">
            {projectNotice ? (
              <section className="mb-4 flex items-start gap-3 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] p-3 text-sm text-[var(--foreground-soft)]">
                <Mail className="mt-0.5 shrink-0 text-[var(--accent)]" size={17} aria-hidden="true" />
                <p className="min-w-0 flex-1 leading-6">{projectNotice}</p>
                <button
                  aria-label="Dismiss project notice"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface-hover)]"
                  type="button"
                  onClick={() => setProjectNotice("")}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </section>
            ) : null}

            {view === "board" ? (
              <>
                <BoardView
                  activeGoal={activeGoal}
                  allTags={allProjectTags}
                  canEdit={activeProjectCanEdit}
                  categories={activeProjectCategories}
                  columns={activeBoardColumns}
                  defaultFocusMinutes={settings.focusMinutes}
                  focusTaskId={focusTaskId}
                  isTimerRunning={isRunning}
                  onAddColumn={addBoardColumn}
                  onAddTask={addTask}
                  onArchiveColumn={archiveBoardColumn}
                  onDeleteColumn={deleteBoardColumn}
                  onRenameColumn={renameBoardColumn}
                  onReorderColumn={reorderBoardColumn}
                  onRestoreColumn={restoreBoardColumn}
                  onSelectTask={selectTaskForEdit}
                  onStartTask={startTask}
                  onTaskStatusChange={moveTask}
                  onToggleTag={toggleTag}
                  progressPercent={progressPercent}
                  projectTasks={filteredProjectTasks}
                  searchQuery={taskSearchQuery}
                  archivedColumns={archivedBoardColumns}
                  selectedTags={selectedTags}
                  selectedTaskId={taskDraft ? undefined : selectedTask?.id}
                  todaysPomodoros={todaysPomodoros}
                />

                {taskDrawerOpen && taskDrawerTask ? (
                  <TaskDetailModal
                    key={taskDrawerTask.id}
                    categories={activeProjectCategories}
                    columns={activeBoardColumns}
                    currentUserId={appUserId}
                    currentUserName={appUserName}
                    deleteDisabled={
                      isRunning && focusTaskId === taskDrawerTask.id
                    }
                    onClose={closeTaskDrawer}
                    onCreateCategory={createCategory}
                    onDeleteTask={handleDeleteTask}
                    onUpdateTask={taskDraft ? updateTaskDraft : updateTask}
                    readOnly={!activeProjectCanEdit}
                    task={taskDrawerTask}
                  />
                ) : null}
              </>
            ) : null}

            {view === "timer" ? (
              <TimerView
                isRunning={isRunning}
                onFocusMinutesChange={updateFocusMinutes}
                onStart={startSelectedPomodoro}
                remainingSeconds={remainingSeconds}
                selectedTask={focusTask}
                sessionNote={sessionNote}
                setSessionNote={setSessionNote}
                settings={settings}
                timerMinutes={sessionDurationMinutes}
                timerProgress={timerProgress}
              />
            ) : null}

            {view === "analytics" ? (
              <AnalyticsView
                cancellations={cancellations}
                categories={categories}
                projects={projects}
                sessions={sessions}
                settings={settings}
                tasks={tasks}
                userId={appUserId}
              />
            ) : null}

            {view === "settings" ? (
              <SettingsView
                activeProject={activeProject}
                createProject={openCreateProjectDialog}
                onEditProject={openEditProjectDialog}
                onFocusMinutesChange={updateFocusMinutes}
                onPreviewSound={previewFocusSound}
                profilePlan={profilePlan}
                settings={settings}
                setSettings={setSettings}
                teamProjectCount={teamProjectCount}
                timerLocked={
                  isRunning ||
                  remainingSeconds < sessionDurationMinutes * 60
                }
              />
            ) : null}
          </div>
        </section>
      </div>

      {cancelDialogOpen && isRunning ? (
        <CancelPomodoroModal
          focusTaskTitle={focusTask?.title ?? "Focus session"}
          reason={cancelReason}
          remainingSeconds={remainingSeconds}
          step={cancelStep}
          onCancel={() => {
            if (cancelReason) {
              cancelPomodoro(cancelReason);
            }
          }}
          onClose={() => {
            setCancelDialogOpen(false);
            setCancelStep("confirm");
            setCancelReason("");
          }}
          onReasonChange={setCancelReason}
          onStepChange={setCancelStep}
        />
      ) : null}

      {projectDialog ? (
        <ProjectDialog
          canDelete={projects.length > 1}
          currentUserEmail={authEmail}
          currentUserId={appUserId}
          currentUserName={appUserName}
          deleteDisabled={
            projectDialog.projectId
              ? isRunning && focusTask?.projectId === projectDialog.projectId
              : false
          }
          mode={projectDialog.mode}
          onClose={() => setProjectDialog(null)}
          onDelete={deleteProject}
          onSave={saveProjectFromDialog}
          planTier={profilePlan}
          project={
            projectDialog.mode === "edit"
              ? projects.find((project) => project.id === projectDialog.projectId)
              : undefined
          }
          teamProjectCount={teamProjectCount}
          initialKind={projectDialog.kind ?? "personal"}
        />
      ) : null}

      {onboardingOpen ? <OnboardingModal onChoose={finishOnboarding} /> : null}
    </main>
  );
}

function CancelPomodoroModal({
  focusTaskTitle,
  onCancel,
  onClose,
  onReasonChange,
  onStepChange,
  reason,
  remainingSeconds,
  step,
}: {
  focusTaskTitle: string;
  onCancel: () => void;
  onClose: () => void;
  onReasonChange: (reason: CancellationReason) => void;
  onStepChange: (step: "confirm" | "reason") => void;
  reason: CancellationReason | "";
  remainingSeconds: number;
  step: "confirm" | "reason";
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-[1px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-label="Cancel Pomodoro"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-modal)]"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[var(--danger)]">
              {formatTimer(remainingSeconds)} remaining
            </p>
            <h2 className="mt-1 text-2xl font-bold">
              {step === "confirm" ? "Cancel Pomodoro?" : "Why are you cancelling?"}
            </h2>
            <p className="mt-2 truncate text-sm text-[var(--muted)]">
              {focusTaskTitle}
            </p>
          </div>
          <button
            aria-label="Close cancellation dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface-hover)]"
            type="button"
            onClick={onClose}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        {step === "confirm" ? (
          <>
            <p className="mt-5 text-sm leading-6 text-[var(--muted)]">
              The current Pomodoro will be discarded and no focus time will be
              added to the task.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                className="h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-muted)]"
                type="button"
                onClick={onClose}
              >
                Keep working
              </button>
              <button
                className="h-11 rounded-md bg-[var(--danger-bg)] text-sm font-semibold text-white transition hover:bg-[var(--danger-bg-hover)]"
                type="button"
                onClick={() => onStepChange("reason")}
              >
                Yes, cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-5 grid gap-2">
              {(Object.keys(cancellationReasonLabels) as CancellationReason[]).map(
                (value) => (
                  <button
                    key={value}
                    aria-pressed={reason === value}
                    className={`flex min-h-11 items-center gap-3 rounded-md border px-3 text-left text-sm font-semibold transition ${
                      reason === value
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--danger)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)]"
                    }`}
                    type="button"
                    onClick={() => onReasonChange(value)}
                  >
                    <span
                      className={`h-3 w-3 shrink-0 rounded-full border ${
                        reason === value
                          ? "border-[var(--accent)] bg-[var(--accent)]"
                          : "border-[var(--border-strong)] bg-[var(--surface)]"
                      }`}
                    />
                    {cancellationReasonLabels[value]}
                  </button>
                ),
              )}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                className="h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-muted)]"
                type="button"
                onClick={() => onStepChange("confirm")}
              >
                Back
              </button>
              <button
                className="h-11 rounded-md bg-[var(--danger-bg)] text-sm font-semibold text-white transition enabled:hover:bg-[var(--danger-bg-hover)] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={!reason}
                type="button"
                onClick={onCancel}
              >
                Cancel session
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ProjectDialog({
  canDelete,
  currentUserEmail,
  currentUserId,
  currentUserName,
  deleteDisabled,
  initialKind,
  mode,
  onClose,
  onDelete,
  onSave,
  planTier,
  project,
  teamProjectCount,
}: {
  canDelete: boolean;
  currentUserEmail: string;
  currentUserId: string;
  currentUserName: string;
  deleteDisabled: boolean;
  initialKind: ProjectKind;
  mode: ProjectDialogMode;
  onClose: () => void;
  onDelete: (projectId: string) => Promise<void>;
  onSave: (values: ProjectDialogValues) => Promise<void>;
  planTier: PlanTier;
  project?: Project;
  teamProjectCount: number;
}) {
  const owner =
    project?.teamMembers.find((member) => member.role === "owner") ??
    createCurrentUserMember(currentUserId, currentUserName, currentUserEmail);
  const teamLocked =
    planTier === "free" &&
    teamProjectCount >= 1 &&
    !(mode === "edit" && project?.kind === "team");
  const [name, setName] = useState(
    project?.name ?? (initialKind === "team" ? "Shared Project" : "New Project"),
  );
  const [description, setDescription] = useState(project?.description ?? "");
  const [kind, setKind] = useState<ProjectKind>(
    teamLocked && initialKind === "team" ? "personal" : project?.kind ?? initialKind,
  );
  const [color, setColor] = useState(
    project?.color ?? (initialKind === "team" ? "#25a565" : "#ff005e"),
  );
  const [inviteInput, setInviteInput] = useState("");
  const [inviteRole, setInviteRole] =
    useState<ProjectMemberAccessRole>("editor");
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [memberRoles, setMemberRoles] = useState<
    Record<string, ProjectMemberAccessRole>
  >(() =>
    Object.fromEntries(
      (project?.teamMembers ?? [])
        .filter((member) => member.role !== "owner")
        .map((member) => [member.id, normalizeMemberAccessRole(member.role)]),
    ),
  );
  const [retainedMemberIds, setRetainedMemberIds] = useState(
    () => new Set(project?.teamMembers.map((member) => member.id) ?? [owner.id]),
  );
  const [retainedInviteIds, setRetainedInviteIds] = useState(
    () => new Set(project?.pendingInvites.map((invite) => invite.id) ?? []),
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const teamSectionDisabled = kind !== "team" || teamLocked;
  const visibleMembers =
    project?.teamMembers.filter(
      (member) => member.role !== "owner" && retainedMemberIds.has(member.id),
    ) ?? [];
  const visibleInvites =
    project?.pendingInvites.filter((invite) => retainedInviteIds.has(invite.id)) ?? [];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  function addInviteEmails() {
    if (teamSectionDisabled) {
      return;
    }

    const emails = uniqueEmails(inviteInput.split(/[,\s]+/));
    if (!emails.length) {
      setMessage("Enter a valid email address.");
      return;
    }

    const blockedEmails = new Set([
      normalizeEmail(owner.email),
      ...visibleMembers.map((member) => normalizeEmail(member.email)),
      ...visibleInvites.map((invite) => normalizeEmail(invite.email)),
      ...inviteEmails,
    ]);
    const nextEmails = emails.filter((email) => !blockedEmails.has(email));

    if (!nextEmails.length) {
      setMessage("Those people are already on the project or already invited.");
      return;
    }

    setInviteEmails((current) => [...current, ...nextEmails]);
    setInviteInput("");
    setMessage("");
  }

  async function copyInviteLink(token: string) {
    const inviteUrl = getInviteUrl(token);
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setMessage("Invite link copied.");
    } catch {
      setMessage(inviteUrl);
    }
  }

  async function submitProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (kind === "team" && teamLocked) {
      setMessage("Free accounts can own one shared project.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      await onSave({
        color,
        description,
        inviteRole,
        inviteEmails: kind === "team" ? inviteEmails : [],
        kind,
        memberRoles,
        name,
        retainedInviteIds: Array.from(retainedInviteIds),
        retainedMemberIds: [owner.id, ...Array.from(retainedMemberIds)],
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Project could not be saved.");
      setSaving(false);
    }
  }

  async function deleteCurrentProject() {
    if (!project || !canDelete || deleteDisabled) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      await onDelete(project.id);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Project could not be deleted.",
      );
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-[var(--overlay)] p-4 backdrop-blur-[1px] sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-label={mode === "create" ? "Create project" : "Edit project"}
        aria-modal="true"
        className="my-auto w-full max-w-2xl rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-modal)] sm:p-6"
        role="dialog"
      >
        <form onSubmit={submitProject}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--danger)]">
                {mode === "create" ? "New project" : "Project settings"}
              </p>
              <h2 className="mt-1 text-2xl font-bold">
                {mode === "create" ? "Create project" : "Edit project"}
              </h2>
            </div>
            <button
              aria-label="Close project dialog"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface-hover)]"
              type="button"
              onClick={onClose}
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_180px]">
            <label className="block">
              <span className="text-sm font-semibold text-[var(--muted)]">
                Project name
              </span>
              <input
                autoFocus
                className="mt-2 h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm outline-none transition focus:border-[var(--accent)]"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>

            <div>
              <span className="text-sm font-semibold text-[var(--muted)]">Color</span>
              <div className="mt-2 flex h-11 items-center gap-2">
                {projectColorOptions.map((option) => (
                  <button
                    key={option}
                    aria-label={`Use project color ${option}`}
                    aria-pressed={color === option}
                    className={`h-8 w-8 rounded-full border-2 ${
                      color === option ? "border-[var(--foreground)]" : "border-[var(--surface)]"
                    } shadow-[0_0_0_1px_var(--border-strong)]`}
                    style={{ backgroundColor: option }}
                    type="button"
                    onClick={() => setColor(option)}
                  />
                ))}
              </div>
            </div>
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-semibold text-[var(--muted)]">
              Description
            </span>
            <textarea
              className="mt-2 min-h-20 w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-[var(--subtle)] focus:border-[var(--accent)]"
              placeholder="What is this project for?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <div className="mt-5">
            <span className="text-sm font-semibold text-[var(--muted)]">Project type</span>
            <div
              aria-label="Project type"
              className="mt-2 grid grid-cols-2 gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-1"
              role="group"
            >
              {(["personal", "team"] as ProjectKind[]).map((option) => {
                const disabled = option === "team" && teamLocked;
                const active = kind === option;
                return (
                  <button
                    key={option}
                    aria-pressed={active}
                    className={`flex h-10 items-center justify-center gap-2 rounded text-sm font-semibold capitalize transition ${
                      active
                        ? "bg-[var(--foreground)] text-[var(--background)]"
                        : "text-[var(--muted)] enabled:hover:bg-[var(--surface)]"
                    } disabled:cursor-not-allowed disabled:opacity-45`}
                    disabled={disabled}
                    type="button"
                    onClick={() => setKind(option)}
                  >
                    {option === "team" ? (
                      <Users size={16} aria-hidden="true" />
                    ) : (
                      <UserCircle size={16} aria-hidden="true" />
                    )}
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <section
            className={`mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4 ${
              teamSectionDisabled ? "opacity-55" : ""
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <UserPlus size={17} aria-hidden="true" />
                    Team members
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {teamLocked
                      ? "Free plan limit reached"
                      : "One admin, teammates can edit or view only"}
                  </p>
              </div>
              <span className="rounded-md bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--muted)]">
                {planLabels[planTier]} plan
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
                  <ShieldCheck size={17} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{owner.name}</p>
                  <p className="truncate text-xs text-[var(--muted)]">{owner.email}</p>
                </div>
                <span className="rounded bg-[var(--surface-hover)] px-2 py-1 text-xs font-semibold text-[var(--muted)]">
                  {projectRoleLabels.owner}
                </span>
              </div>

              {visibleMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--green-soft)] text-[var(--green)]">
                    <Users size={16} aria-hidden="true" />
                  </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{member.name}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{member.email}</p>
                    </div>
                    <label className="shrink-0">
                      <span className="sr-only">Access for {member.email}</span>
                      <select
                        className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface-hover)] px-2 text-xs font-semibold text-[var(--muted)] outline-none transition focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={teamSectionDisabled}
                        value={memberRoles[member.id] ?? normalizeMemberAccessRole(member.role)}
                        onChange={(event) =>
                          setMemberRoles((current) => ({
                            ...current,
                            [member.id]: normalizeMemberAccessRole(event.target.value),
                          }))
                        }
                      >
                        {memberAccessOptions.map((option) => (
                          <option key={option} value={option}>
                            {projectRoleLabels[option]}
                          </option>
                        ))}
                      </select>
                    </label>
                  <button
                    aria-label={`Remove ${member.email}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                    disabled={teamSectionDisabled}
                    type="button"
                    onClick={() =>
                      setRetainedMemberIds((current) => {
                        const next = new Set(current);
                        next.delete(member.id);
                        return next;
                      })
                    }
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}

              {visibleInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center gap-3 rounded-md border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-3"
                >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--amber-soft)] text-[var(--amber)]">
                      <Mail size={16} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{invite.email}</p>
                      <p className="truncate text-xs text-[var(--muted)]">
                        Invite pending - {projectRoleLabels[invite.role]}
                      </p>
                    </div>
                  <button
                    aria-label={`Copy invite link for ${invite.email}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--accent)]"
                    disabled={teamSectionDisabled}
                    type="button"
                    onClick={() => copyInviteLink(invite.token)}
                  >
                    <Copy size={15} aria-hidden="true" />
                  </button>
                  <button
                    aria-label={`Revoke invite for ${invite.email}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                    disabled={teamSectionDisabled}
                    type="button"
                    onClick={() =>
                      setRetainedInviteIds((current) => {
                        const next = new Set(current);
                        next.delete(invite.id);
                        return next;
                      })
                    }
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}

              {inviteEmails.map((email) => (
                <div
                  key={email}
                  className="flex items-center gap-3 rounded-md border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3"
                >
                  <Mail size={16} className="shrink-0 text-[var(--accent)]" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {email}
                    </span>
                    <span className="rounded bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--danger)]">
                      {projectRoleLabels[inviteRole]}
                    </span>
                  <button
                    aria-label={`Remove invite for ${email}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--danger)] transition hover:bg-[var(--surface)]"
                    disabled={teamSectionDisabled}
                    type="button"
                    onClick={() =>
                      setInviteEmails((current) =>
                        current.filter((item) => item !== email),
                      )
                    }
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="project-invite-email">
                  Invite email
                </label>
                <input
                  id="project-invite-email"
                  className="h-11 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none transition placeholder:text-[var(--subtle)] focus:border-[var(--accent)] disabled:cursor-not-allowed"
                disabled={teamSectionDisabled}
                placeholder="teammate@example.com"
                type="email"
                value={inviteInput}
                onChange={(event) => setInviteInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                      addInviteEmails();
                    }
                  }}
                />
                <label className="sr-only" htmlFor="project-invite-role">
                  Invite access
                </label>
                <select
                  id="project-invite-role"
                  className="h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--muted)] outline-none transition focus:border-[var(--accent)] disabled:cursor-not-allowed"
                  disabled={teamSectionDisabled}
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(normalizeMemberAccessRole(event.target.value))
                  }
                >
                  {memberAccessOptions.map((option) => (
                    <option key={option} value={option}>
                      {projectRoleLabels[option]}
                    </option>
                  ))}
                </select>
                <button
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--muted)] transition enabled:hover:border-[var(--accent)] enabled:hover:text-[var(--accent)] disabled:cursor-not-allowed"
                disabled={teamSectionDisabled}
                type="button"
                onClick={addInviteEmails}
              >
                <Plus size={16} aria-hidden="true" />
                Add
              </button>
            </div>
          </section>

          {message ? (
            <p className="mt-4 rounded-md border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3 text-sm font-semibold text-[var(--danger)]">
              {message}
            </p>
          ) : null}

          {mode === "edit" && project ? (
            <div className="mt-5 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--danger)]">
                    Delete project
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {deleteDisabled
                      ? "Stop the active Pomodoro before deleting this project."
                      : canDelete
                        ? "Tasks, notes, sessions, members, and invites will be removed."
                        : "You need at least one project."}
                  </p>
                </div>
                <button
                  className="flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--accent-border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--danger)] transition enabled:hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={!canDelete || deleteDisabled || saving}
                  type="button"
                  onClick={deleteCurrentProject}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Delete
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-2 gap-2">
            <button
              className="h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-muted)]"
              disabled={saving}
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent)] text-sm font-semibold text-white transition enabled:hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={saving}
              type="submit"
            >
              {saving ? (
                <Clock3 className="animate-pulse motion-reduce:animate-none" size={16} aria-hidden="true" />
              ) : (
                <Check size={16} aria-hidden="true" />
              )}
              {mode === "create" ? "Create project" : "Save project"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function BoardView({
  activeGoal,
  allTags,
  archivedColumns,
  canEdit,
  categories,
  columns,
  defaultFocusMinutes,
  focusTaskId,
  isTimerRunning,
  onAddColumn,
  onAddTask,
  onArchiveColumn,
  onDeleteColumn,
  onRenameColumn,
  onReorderColumn,
  onRestoreColumn,
  onSelectTask,
  onStartTask,
  onTaskStatusChange,
  onToggleTag,
  progressPercent,
  projectTasks,
  searchQuery,
  selectedTags,
  selectedTaskId,
  todaysPomodoros,
}: {
  activeGoal: number;
  allTags: string[];
  archivedColumns: BoardColumn[];
  canEdit: boolean;
  categories: TaskCategory[];
  columns: BoardColumn[];
  defaultFocusMinutes: number;
  focusTaskId: string;
  isTimerRunning: boolean;
  onAddColumn: (title: string) => void;
  onAddTask: (status: TaskStatus) => void;
  onArchiveColumn: (columnId: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onRenameColumn: (columnId: string, title: string) => void;
  onReorderColumn: (sourceColumnId: string, targetColumnId: string) => void;
  onRestoreColumn: (columnId: string) => void;
  onSelectTask: (taskId: string) => void;
  onStartTask: (taskId: string, minutes: number) => void;
  onTaskStatusChange: (
    taskId: string,
    status: TaskStatus,
    targetTaskId?: string,
    placement?: "before" | "after",
  ) => void;
  onToggleTag: (tag: string) => void;
  progressPercent: number;
  projectTasks: Task[];
  searchQuery: string;
  selectedTags: string[];
  selectedTaskId?: string;
  todaysPomodoros: number;
}) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [columnDropTargetId, setColumnDropTargetId] = useState<string | null>(
    null,
  );
  const [taskDropTargetId, setTaskDropTargetId] = useState<string | null>(null);
  const [newColumnOpen, setNewColumnOpen] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [archivedPanelOpen, setArchivedPanelOpen] = useState(false);
  const [openColumnMenuId, setOpenColumnMenuId] = useState<string | null>(null);
  const [renamingColumnId, setRenamingColumnId] = useState<string | null>(null);
  const [columnTitleDraft, setColumnTitleDraft] = useState("");
  const [pendingDeleteColumnId, setPendingDeleteColumnId] = useState<
    string | null
  >(null);
  const pointerTaskIdRef = useRef<string | null>(null);
  const pointerColumnIdRef = useRef<string | null>(null);
  const columnMenuRef = useRef<HTMLDivElement | null>(null);
  const pendingDeleteColumn = columns.find(
    (column) => column.id === pendingDeleteColumnId,
  );
  const pendingDeleteTaskCount = projectTasks.filter(
    (task) => task.status === pendingDeleteColumnId,
  ).length;

  function clearDragState() {
    pointerTaskIdRef.current = null;
    setDraggedTaskId(null);
    setTaskDropTargetId(null);
  }

  function clearColumnDragState() {
    pointerColumnIdRef.current = null;
    setDraggedColumnId(null);
    setColumnDropTargetId(null);
  }

  function beginPointerDrag(taskId: string) {
    pointerTaskIdRef.current = taskId;
    setDraggedTaskId(taskId);
  }

  function submitNewColumn() {
    const title = newColumnTitle.trim();

    if (!title) {
      return;
    }

    onAddColumn(title);
    setNewColumnTitle("");
    setNewColumnOpen(false);
  }

  function startColumnRename(column: BoardColumn) {
    setColumnTitleDraft(column.title);
    setRenamingColumnId(column.id);
    setOpenColumnMenuId(null);
  }

  function saveColumnRename(column: BoardColumn) {
    const title = columnTitleDraft.trim();

    if (title) {
      onRenameColumn(column.id, title);
    }

    setRenamingColumnId(null);
    setColumnTitleDraft("");
  }

  function getTaskDropTarget(event: {
    clientX: number;
    clientY: number;
    target: EventTarget | null;
  }) {
    const pointedElement = document.elementFromPoint(event.clientX, event.clientY);
    const card =
      pointedElement instanceof HTMLElement
        ? pointedElement.closest<HTMLElement>("[data-task-id]")
        : event.target instanceof HTMLElement
          ? event.target.closest<HTMLElement>("[data-task-id]")
          : null;

    if (!card?.dataset.taskId) {
      return { placement: "before" as const, taskId: undefined };
    }

    const bounds = card.getBoundingClientRect();
    return {
      placement:
        event.clientY >= bounds.top + bounds.height / 2
          ? ("after" as const)
          : ("before" as const),
      taskId: card.dataset.taskId,
    };
  }

  function dropTask(
    status: TaskStatus,
    taskId = draggedTaskId,
    targetTaskId?: string,
    placement: "before" | "after" = "before",
  ) {
    const sourceTaskId = taskId ?? pointerTaskIdRef.current;

    if (!sourceTaskId) {
      return;
    }

    onTaskStatusChange(sourceTaskId, status, targetTaskId, placement);
    clearDragState();
  }

  useEffect(() => {
    window.addEventListener("pointerup", clearDragState);
    window.addEventListener("pointercancel", clearDragState);
    window.addEventListener("pointerup", clearColumnDragState);
    window.addEventListener("pointercancel", clearColumnDragState);

    return () => {
      window.removeEventListener("pointerup", clearDragState);
      window.removeEventListener("pointercancel", clearDragState);
      window.removeEventListener("pointerup", clearColumnDragState);
      window.removeEventListener("pointercancel", clearColumnDragState);
    };
  }, []);

  useEffect(() => {
    if (!openColumnMenuId) {
      return;
    }

    function closeColumnMenu(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !columnMenuRef.current?.contains(event.target)
      ) {
        setOpenColumnMenuId(null);
      }
    }

    function closeColumnMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenColumnMenuId(null);
      }
    }

    document.addEventListener("pointerdown", closeColumnMenu);
    window.addEventListener("keydown", closeColumnMenuOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeColumnMenu);
      window.removeEventListener("keydown", closeColumnMenuOnEscape);
    };
  }, [openColumnMenuId]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4 text-[var(--foreground)]">
        <div className="flex flex-wrap items-center gap-4">
          <Gauge
            className="shrink-0 text-[var(--accent)]"
            size={28}
            aria-hidden="true"
          />
          <div className="min-w-32">
            <p className="text-xs font-semibold uppercase text-[var(--danger)]">
              Daily focus
            </p>
            <p className="mt-1 text-xl font-semibold">
              {todaysPomodoros}/{activeGoal} sessions
            </p>
          </div>
          <div className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-[var(--surface)]">
            <div
              className="h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </section>

      {allTags.length ? (
        <section className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="flex items-center gap-2 pr-1 text-sm font-semibold text-[var(--muted)]">
            <Hash size={16} aria-hidden="true" />
            Filter
          </div>
          {allTags.map((tag) => {
            const active = selectedTags.includes(tag);

            return (
              <button
                key={tag}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--danger)]"
                    : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)] hover:border-[var(--accent)]"
                }`}
                type="button"
                onClick={() => onToggleTag(tag)}
              >
                #{tag}
              </button>
            );
          })}
        </section>
      ) : null}

      {searchQuery.trim() && !projectTasks.length ? (
        <section
          aria-live="polite"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]"
        >
          No tasks match “{searchQuery.trim()}”.
        </section>
      ) : null}

      <div className="flex min-h-10 flex-wrap items-start justify-between gap-2">
        {archivedColumns.length ? (
          <button
            aria-expanded={archivedPanelOpen}
            className="flex h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            type="button"
            onClick={() => setArchivedPanelOpen((current) => !current)}
          >
            <Archive size={16} aria-hidden="true" />
            Archived columns ({archivedColumns.length})
          </button>
        ) : (
          <span />
        )}
        {canEdit && newColumnOpen ? (
          <form
            className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2"
            onSubmit={(event) => {
              event.preventDefault();
              submitNewColumn();
            }}
          >
            <input
              autoFocus
              aria-label="New column name"
              className="h-9 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm outline-none transition focus:border-[var(--accent)]"
              placeholder="Column name"
              value={newColumnTitle}
              onChange={(event) => setNewColumnTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setNewColumnTitle("");
                  setNewColumnOpen(false);
                }
              }}
            />
            <button
              aria-label="Save column"
              title="Save column"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] text-white transition hover:bg-[var(--accent-hover)]"
              type="submit"
            >
              <Check size={16} aria-hidden="true" />
            </button>
            <button
              aria-label="Cancel adding column"
              title="Cancel"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface-hover)]"
              type="button"
              onClick={() => {
                setNewColumnTitle("");
                setNewColumnOpen(false);
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </form>
        ) : canEdit ? (
          <button
            className="flex h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            type="button"
            onClick={() => setNewColumnOpen(true)}
          >
            <Plus size={16} aria-hidden="true" />
            Add column
          </button>
        ) : (
          <span className="flex h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--muted)]">
            <Eye size={16} aria-hidden="true" />
            Read-only
          </span>
        )}
      </div>

      {archivedPanelOpen && archivedColumns.length ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="px-1 text-xs font-semibold uppercase text-[var(--subtle)]">
            Archived columns
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {archivedColumns.map((column) => {
              const archivedTaskCount = projectTasks.filter(
                (task) => task.status === column.id,
              ).length;

              return (
                <div
                  key={column.id}
                  className="flex min-h-11 items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {column.title}
                  </span>
                  <span className="text-xs text-[var(--subtle)]">
                    {archivedTaskCount}{" "}
                    {archivedTaskCount === 1 ? "card" : "cards"}
                  </span>
                  <button
                    className="h-8 rounded-md bg-[var(--surface)] px-2 text-xs font-semibold text-[var(--muted)] transition enabled:hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!canEdit}
                    type="button"
                    onClick={() => onRestoreColumn(column.id)}
                  >
                    Restore
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="overflow-x-auto pb-2">
        <div
          className="grid items-start gap-4"
          style={{
            gridTemplateColumns: `repeat(${columns.length}, minmax(280px, 1fr))`,
            minWidth: `${columns.length * 296 - 16}px`,
          }}
        >
        {columns.map((column) => {
          const columnTasks = projectTasks.filter(
            (task) => task.status === column.id,
          );

          return (
            <section
              key={column.id}
              className={`group/column min-h-[360px] rounded-lg border p-3 transition ${
                canEdit ? "cursor-grab active:cursor-grabbing" : ""
              } ${
                columnDropTargetId === column.id &&
                draggedColumnId !== column.id
                  ? "border-[var(--accent)] bg-[var(--accent-wash)] ring-2 ring-[var(--accent-ring-soft)]"
                  : draggedTaskId
                  ? "border-[var(--accent)] bg-[var(--accent-wash)]"
                  : "border-[var(--border)] bg-[var(--surface-soft)]"
              }`}
              draggable={canEdit}
              onDragEnter={() => {
                if (!canEdit) {
                  return;
                }

                if (draggedColumnId) {
                  setColumnDropTargetId(column.id);
                }
              }}
              onDragOver={(event) => {
                if (!canEdit) {
                  return;
                }

                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (draggedTaskId) {
                  const target = getTaskDropTarget(event);
                  setTaskDropTargetId(
                    target.taskId && target.taskId !== draggedTaskId
                      ? target.taskId
                      : null,
                  );
                }
              }}
              onDragEnd={(event) => {
                if (!canEdit) {
                  return;
                }

                if ((event.target as HTMLElement).closest("article")) {
                  return;
                }

                clearColumnDragState();
              }}
              onDragStart={(event) => {
                if (!canEdit) {
                  event.preventDefault();
                  return;
                }

                const target = event.target as HTMLElement;

                if (
                  target.closest(
                    "article, button, input, textarea, select, a, [data-column-menu]",
                  )
                ) {
                  return;
                }

                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(
                  "application/x-tockli-column",
                  column.id,
                );
                setDraggedColumnId(column.id);
                setColumnDropTargetId(column.id);
              }}
              onDrop={(event) => {
                if (!canEdit) {
                  return;
                }

                event.preventDefault();
                const sourceColumnId = event.dataTransfer.getData(
                  "application/x-tockli-column",
                );

                if (sourceColumnId) {
                  onReorderColumn(sourceColumnId, column.id);
                  clearColumnDragState();
                  return;
                }

                const sourceTaskId =
                  event.dataTransfer.getData("text/plain") || draggedTaskId;
                const target = getTaskDropTarget(event);
                dropTask(
                  column.id,
                  sourceTaskId,
                  target.taskId,
                  target.placement,
                );
              }}
              onPointerUp={(event) => {
                if (!canEdit) {
                  return;
                }

                if (pointerColumnIdRef.current) {
                  onReorderColumn(pointerColumnIdRef.current, column.id);
                  clearColumnDragState();
                  return;
                }

                const target = getTaskDropTarget(event);
                dropTask(
                  column.id,
                  pointerTaskIdRef.current ?? draggedTaskId,
                  target.taskId,
                  target.placement,
                );
              }}
              onPointerDown={(event) => {
                if (!canEdit) {
                  return;
                }

                const target = event.target as HTMLElement;

                if (
                  target.closest(
                    "article, button, input, textarea, select, a, [data-column-menu]",
                  )
                ) {
                  return;
                }

                pointerColumnIdRef.current = column.id;
                setDraggedColumnId(column.id);
                setColumnDropTargetId(column.id);
              }}
            >
              <div className="relative mb-3 flex min-h-9 items-center justify-between px-1">
                <div className="flex min-w-0 items-center gap-2">
                  {renamingColumnId === column.id ? (
                    <input
                      autoFocus
                      aria-label={`Rename ${column.title} column`}
                      className="h-9 min-w-0 flex-1 cursor-text rounded-md border border-[var(--accent)] bg-[var(--surface)] px-2 text-lg font-semibold outline-none ring-2 ring-[var(--accent-ring-soft)]"
                      value={columnTitleDraft}
                      onBlur={() => saveColumnRename(column)}
                      onChange={(event) =>
                        setColumnTitleDraft(event.target.value)
                      }
                      onFocus={(event) => event.currentTarget.select()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          saveColumnRename(column);
                        }

                        if (event.key === "Escape") {
                          setRenamingColumnId(null);
                          setColumnTitleDraft("");
                        }
                      }}
                    />
                  ) : (
                    <h3 className="truncate text-lg font-semibold">
                      {column.title}
                    </h3>
                  )}
                  <span className="rounded bg-[var(--surface)] px-2 py-1 text-xs text-[var(--muted)]">
                    {columnTasks.length}
                  </span>
                </div>
                {canEdit ? (
                  <div
                    ref={
                      openColumnMenuId === column.id ? columnMenuRef : undefined
                    }
                    className="relative ml-2 shrink-0"
                    data-column-menu
                  >
                    <button
                      aria-expanded={openColumnMenuId === column.id}
                      aria-label={`Open ${column.title} column menu`}
                      title="Column actions"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                      type="button"
                      onClick={() =>
                        setOpenColumnMenuId((current) =>
                          current === column.id ? null : column.id,
                        )
                      }
                    >
                      <MoreHorizontal size={18} aria-hidden="true" />
                    </button>
                    {openColumnMenuId === column.id ? (
                    <div
                      aria-label={`${column.title} column actions`}
                      className="absolute right-0 top-9 z-30 w-52 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-float)]"
                      role="menu"
                    >
                      <button
                        className="flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-left text-sm text-[var(--foreground)] transition hover:bg-[var(--surface-soft)]"
                        role="menuitem"
                        type="button"
                        onClick={() => startColumnRename(column)}
                      >
                        <Pencil size={15} aria-hidden="true" />
                        Rename column
                      </button>
                      <button
                        className="flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-left text-sm text-[var(--foreground)] transition hover:bg-[var(--surface-soft)]"
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          onAddTask(column.id);
                          setOpenColumnMenuId(null);
                        }}
                      >
                        <Plus size={15} aria-hidden="true" />
                        Add card
                      </button>
                      <button
                        className="flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-left text-sm text-[var(--foreground)] transition enabled:hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={columns.length === 1}
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          onArchiveColumn(column.id);
                          setOpenColumnMenuId(null);
                        }}
                      >
                        <Archive size={15} aria-hidden="true" />
                        Archive column
                      </button>
                      <div className="my-1 border-t border-[var(--border)]" />
                      <button
                        className="flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-left text-sm text-[var(--danger)] transition enabled:hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={columns.length === 1}
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          setPendingDeleteColumnId(column.id);
                          setOpenColumnMenuId(null);
                        }}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        Delete column
                      </button>
                    </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    category={categories.find(
                      (category) => category.id === task.categoryId,
                    )}
                    defaultFocusMinutes={defaultFocusMinutes}
                    isDropTarget={taskDropTargetId === task.id}
                    isFocusTask={isTimerRunning && focusTaskId === task.id}
                    isSelected={selectedTaskId === task.id}
                    isTimerRunning={isTimerRunning}
                    canEdit={canEdit}
                    onDragEnd={clearDragState}
                    onDragStart={() => setDraggedTaskId(task.id)}
                    onPointerStart={beginPointerDrag}
                    onSelectTask={onSelectTask}
                    onStartTask={onStartTask}
                    task={task}
                  />
                ))}
              </div>
              {canEdit ? (
                <button
                  aria-label={`Add task to ${column.title}`}
                  title={`Add task to ${column.title}`}
                  className="mt-2 flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--accent)]"
                  type="button"
                  onClick={() => onAddTask(column.id)}
                >
                  <Plus size={14} aria-hidden="true" />
                  Add card
                </button>
              ) : null}
            </section>
          );
        })}
        </div>
      </div>

      {pendingDeleteColumn ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-[1px]"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPendingDeleteColumnId(null);
            }
          }}
        >
          <section
            aria-label="Delete column"
            aria-modal="true"
            className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-modal)]"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--danger)]">
                  Delete column
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  Delete “{pendingDeleteColumn.title}”?
                </h2>
              </div>
              <button
                aria-label="Close delete column dialog"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface-hover)]"
                type="button"
                onClick={() => setPendingDeleteColumnId(null)}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
              {pendingDeleteTaskCount
                ? `${pendingDeleteTaskCount} ${
                    pendingDeleteTaskCount === 1 ? "card" : "cards"
                  } will move to the nearest remaining column.`
                : "This empty column will be removed from the board."}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                className="h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-muted)]"
                type="button"
                onClick={() => setPendingDeleteColumnId(null)}
              >
                Keep column
              </button>
              <button
                className="h-11 rounded-md bg-[var(--danger-bg)] text-sm font-semibold text-white transition hover:bg-[var(--danger-bg-hover)]"
                type="button"
                onClick={() => {
                  onDeleteColumn(pendingDeleteColumn.id);
                  setPendingDeleteColumnId(null);
                }}
              >
                Delete column
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function TaskCard({
  canEdit,
  category,
  defaultFocusMinutes,
  isDropTarget,
  isFocusTask,
  isSelected,
  isTimerRunning,
  onDragEnd,
  onDragStart,
  onPointerStart,
  onSelectTask,
  onStartTask,
  task,
}: {
  canEdit: boolean;
  category?: TaskCategory;
  defaultFocusMinutes: number;
  isDropTarget: boolean;
  isFocusTask: boolean;
  isSelected: boolean;
  isTimerRunning: boolean;
  onDragEnd: () => void;
  onDragStart: () => void;
  onPointerStart: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
  onStartTask: (taskId: string, minutes: number) => void;
  task: Task;
}) {
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.done).length;
  const subtaskCount = task.subtasks.length;
    const [timerMenuOpen, setTimerMenuOpen] = useState(false);
    const [timerMinutes, setTimerMinutes] = useState(defaultFocusMinutes);
    const [timerMenuPosition, setTimerMenuPosition] = useState<{
      left: number;
      top: number;
    } | null>(null);
    const timerButtonRef = useRef<HTMLButtonElement | null>(null);
    const timerMenuRef = useRef<HTMLDivElement | null>(null);

    const updateTimerMenuPosition = useCallback(() => {
      const anchor = timerButtonRef.current;
      if (!anchor) {
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const menuWidth = timerMenuRef.current?.offsetWidth ?? 256;
      const menuHeight = timerMenuRef.current?.offsetHeight ?? 220;
      const margin = 12;
      const gap = 8;
      const left = Math.min(
        window.innerWidth - menuWidth - margin,
        Math.max(margin, anchorRect.right - menuWidth),
      );
      const hasRoomBelow = window.innerHeight - anchorRect.bottom >= menuHeight + gap;
      const top = hasRoomBelow
        ? anchorRect.bottom + gap
        : Math.max(margin, anchorRect.top - menuHeight - gap);
      const maxTop = Math.max(margin, window.innerHeight - menuHeight - margin);

      setTimerMenuPosition({
        left,
        top: Math.min(maxTop, Math.max(margin, top)),
      });
    }, []);

    useEffect(() => {
      if (!timerMenuOpen) {
        return;
      }

      updateTimerMenuPosition();
      const frame = window.requestAnimationFrame(updateTimerMenuPosition);

      function closeTimerMenu(event: PointerEvent) {
        if (
          event.target instanceof Node &&
          !timerMenuRef.current?.contains(event.target) &&
          !timerButtonRef.current?.contains(event.target)
        ) {
          setTimerMenuOpen(false);
        }
      }

      function closeTimerMenuOnEscape(event: KeyboardEvent) {
        if (event.key === "Escape") {
          setTimerMenuOpen(false);
        }
      }

      document.addEventListener("pointerdown", closeTimerMenu, true);
      window.addEventListener("keydown", closeTimerMenuOnEscape);
      window.addEventListener("resize", updateTimerMenuPosition);
      window.addEventListener("scroll", updateTimerMenuPosition, true);
      return () => {
        window.cancelAnimationFrame(frame);
        document.removeEventListener("pointerdown", closeTimerMenu, true);
        window.removeEventListener("keydown", closeTimerMenuOnEscape);
        window.removeEventListener("resize", updateTimerMenuPosition);
        window.removeEventListener("scroll", updateTimerMenuPosition, true);
      };
    }, [timerMenuOpen, updateTimerMenuPosition]);

    useEffect(() => {
      if (isTimerRunning) {
        const frame = window.requestAnimationFrame(() => setTimerMenuOpen(false));
        return () => window.cancelAnimationFrame(frame);
      }
    }, [isTimerRunning]);

  return (
    <article
      className={`relative overflow-visible rounded-lg border bg-[var(--surface)] transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)] motion-reduce:transform-none ${
        canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${
        isDropTarget
          ? "border-[var(--accent)] ring-2 ring-[var(--accent-ring-soft)]"
          : isFocusTask
          ? "border-[var(--accent)] shadow-[var(--shadow-accent-soft)]"
          : isSelected
          ? "border-[var(--accent)] shadow-[var(--shadow-accent-soft)]"
          : "border-[var(--border)] hover:border-[var(--border-strong)]"
      }`}
      data-task-id={task.id}
      draggable={canEdit}
      style={{
        borderLeftColor: category?.color ?? undefined,
        borderLeftWidth: category ? 4 : undefined,
      }}
      onClick={() => onSelectTask(task.id)}
      onDragEnd={onDragEnd}
      onDragStart={(event) => {
        if (!canEdit) {
          event.preventDefault();
          return;
        }

        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
        onDragStart();
      }}
      onPointerDown={() => {
        if (canEdit) {
          onPointerStart(task.id);
        }
      }}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {category ? (
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)]">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="truncate">{category.name}</span>
              </div>
            ) : null}
            <h4 className="text-sm font-semibold leading-5">{task.title}</h4>
          </div>
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] ${priorityClass(
              task.priority,
            )}`}
          >
            {task.priority}
          </span>
        </div>

        {task.description ? (
          <p className="mt-1 line-clamp-1 text-xs leading-5 text-[var(--muted)]">
            {task.description}
          </p>
        ) : null}

        {task.tags.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 text-[11px] text-[var(--muted)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {task.spent > 0 ? (
              <span className="flex items-center gap-1">
                <Clock3 size={13} aria-hidden="true" />
                {task.spent}m spent
              </span>
            ) : null}
            {subtaskCount > 0 ? (
              <span className="flex items-center gap-1">
                <ListChecks size={13} aria-hidden="true" />
                {completedSubtasks}/{subtaskCount}
              </span>
            ) : null}
            {task.comments.length > 0 ? (
              <span className="flex items-center gap-1">
                <MessageSquare size={13} aria-hidden="true" />
                {task.comments.length}
              </span>
            ) : null}
            {task.due ? (
              <span className="flex items-center gap-1">
                <CalendarDays size={13} aria-hidden="true" />
                {formatDueDate(task.due)}
              </span>
            ) : null}
            </div>
            <button
              ref={timerButtonRef}
              aria-label={
                isFocusTask
                ? `${task.title} is the active Pomodoro task`
                : isTimerRunning
                  ? `Switch Pomodoro to ${task.title}`
                  : `Start Pomodoro for ${task.title}`
            }
            title={
              isFocusTask
                ? "Pomodoro running"
                : isTimerRunning
                  ? "Switch focus task"
                  : "Start Pomodoro"
            }
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white transition ${
              isFocusTask
                ? "bg-[var(--danger-bg)]"
                : "bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
            }`}
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (isTimerRunning) {
                onStartTask(task.id, defaultFocusMinutes);
                  setTimerMenuOpen(false);
                  return;
                }

                setTimerMinutes(defaultFocusMinutes);
                setTimerMenuPosition(null);
                setTimerMenuOpen((current) => !current);
              }}
          >
            {isFocusTask ? (
              <Clock3
                className="animate-pulse motion-reduce:animate-none"
                size={13}
                aria-hidden="true"
              />
            ) : (
              <Play size={13} aria-hidden="true" />
            )}
          </button>
        </div>

          {timerMenuOpen && !isTimerRunning && typeof document !== "undefined"
            ? createPortal(
                <div
                  ref={timerMenuRef}
                  aria-label={`Start Pomodoro for ${task.title}`}
                  className="fixed z-[75] w-64 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] p-3 text-left shadow-[var(--shadow-float-strong)]"
                  role="dialog"
                  style={
                    timerMenuPosition
                      ? {
                          left: timerMenuPosition.left,
                          top: timerMenuPosition.top,
                        }
                      : { left: 0, top: 0, visibility: "hidden" }
                  }
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-[var(--foreground)]">
                      Pomodoro length
                    </p>
                    <button
                      aria-label="Close timer options"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface-hover)]"
                      type="button"
                      onClick={() => setTimerMenuOpen(false)}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {[5, 10, 15, 25, 45, 60].map((minutes) => (
                      <button
                        key={minutes}
                        aria-pressed={timerMinutes === minutes}
                        className={`h-8 rounded-md border text-xs font-semibold transition ${
                          timerMinutes === minutes
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--danger)]"
                            : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)] hover:border-[var(--accent)]"
                        }`}
                        type="button"
                        onClick={() => setTimerMinutes(minutes)}
                      >
                        {minutes}m
                      </button>
                    ))}
                  </div>

                  <label className="mt-3 flex h-9 items-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 text-xs text-[var(--muted)] focus-within:border-[var(--accent)]">
                    <span className="flex-1 font-semibold">Custom</span>
                    <input
                      aria-label="Custom Pomodoro minutes"
                      className="w-12 bg-transparent text-right font-semibold outline-none"
                      max={180}
                      min={5}
                      type="number"
                      value={timerMinutes}
                      onChange={(event) =>
                        setTimerMinutes(
                          Math.min(
                            180,
                            Math.max(
                              5,
                              Math.round(Number(event.target.value)) || 5,
                            ),
                          ),
                        )
                      }
                    />
                    <span className="pl-1">min</span>
                  </label>

                  <button
                    className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
                    type="button"
                    onClick={() => {
                      onStartTask(task.id, timerMinutes);
                      setTimerMenuOpen(false);
                    }}
                  >
                    <Play size={14} fill="currentColor" aria-hidden="true" />
                    Start {timerMinutes} min
                  </button>
                </div>,
                document.body,
              )
            : null}
      </div>
    </article>
  );
}

function TaskDetailModal({
  categories,
  columns,
  currentUserId,
  currentUserName,
  deleteDisabled,
  onClose,
  onCreateCategory,
  onDeleteTask,
  onUpdateTask,
  readOnly,
  task,
}: {
  categories: TaskCategory[];
  columns: BoardColumn[];
  currentUserId: string;
  currentUserName: string;
  deleteDisabled: boolean;
  onClose: (updates?: Partial<Task>) => void;
  onCreateCategory: (name: string, color: string) => string;
  onDeleteTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  readOnly: boolean;
  task: Task;
}) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(categoryColorOptions[0]);
  const [newComment, setNewComment] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(task.description);
  const [activeMetaEditor, setActiveMetaEditor] = useState<
    "category" | "date" | "tags" | null
  >(null);
  const selectedCategory = categories.find(
    (category) => category.id === task.categoryId,
  );
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.done).length;
  const hasUnsavedDescription = descriptionDraft !== task.description;
  const closeWithPendingChanges = useCallback(() => {
    onClose(
      !readOnly && hasUnsavedDescription
        ? { description: descriptionDraft }
        : undefined,
    );
  }, [descriptionDraft, hasUnsavedDescription, onClose, readOnly]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeWithPendingChanges();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeWithPendingChanges]);

  function updateSubtask(subtaskId: string, updates: Partial<SubTask>) {
    if (readOnly) {
      return;
    }

    onUpdateTask(task.id, {
      subtasks: task.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, ...updates } : subtask,
      ),
    });
  }

  function removeSubtask(subtaskId: string) {
    if (readOnly) {
      return;
    }

    onUpdateTask(task.id, {
      subtasks: task.subtasks.filter((subtask) => subtask.id !== subtaskId),
    });
  }

  function addSubtask() {
    if (readOnly) {
      return;
    }

    const title = newSubtaskTitle.trim();

    if (!title) {
      return;
    }

    onUpdateTask(task.id, {
      subtasks: [
        ...task.subtasks,
        {
          id: createUuid(),
          title,
          done: false,
        },
      ],
    });
    setNewSubtaskTitle("");
  }

  function addCategory() {
    if (readOnly) {
      return;
    }

    const name = newCategoryName.trim();

    if (!name) {
      return;
    }

    const categoryId = onCreateCategory(name, newCategoryColor);
    onUpdateTask(task.id, { categoryId });
    setNewCategoryName("");
  }

  function addComment() {
    if (readOnly) {
      return;
    }

    const body = newComment.trim();

    if (!body) {
      return;
    }

    onUpdateTask(task.id, {
      comments: [
        ...task.comments,
        {
          id: createUuid(),
          authorId: currentUserId,
          authorName: currentUserName,
          body,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setNewComment("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--overlay)] p-4 backdrop-blur-[1px] sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeWithPendingChanges();
        }
      }}
    >
      <section
        aria-label="Card details"
        aria-modal="true"
        className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-modal)] sm:p-6"
        role="dialog"
        style={{
          borderTopColor: selectedCategory?.color,
          borderTopWidth: selectedCategory ? 6 : undefined,
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-4">
          <span className="flex h-8 items-center rounded-md border border-[var(--border)] bg-[var(--surface-hover)] px-2 text-xs font-semibold text-[var(--muted)]">
            {columns.find((column) => column.id === task.status)?.title ??
              task.status}
          </span>
          <button
            aria-label="Close card details"
            className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--accent)]"
            type="button"
            onClick={closeWithPendingChanges}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <textarea
          aria-label="Card title"
          autoFocus={task.title === "Untitled task"}
          className={`-mx-1 min-h-20 w-[calc(100%+0.5rem)] resize-none overflow-hidden rounded-md bg-transparent px-1 py-1 text-4xl font-bold leading-tight outline-none transition sm:text-5xl ${
            readOnly
              ? "cursor-default"
              : "hover:bg-[var(--surface-soft)] focus:bg-[var(--surface-muted)] focus:ring-2 focus:ring-[var(--accent-ring)]"
          }`}
          readOnly={readOnly}
          rows={2}
          value={task.title}
          onFocus={(event) => {
            if (task.title === "Untitled task") {
              event.currentTarget.select();
            }
          }}
          onChange={(event) =>
            onUpdateTask(task.id, {
              title: event.target.value,
            })
          }
          onBlur={(event) => {
            if (!event.currentTarget.value.trim()) {
              onUpdateTask(task.id, { title: "Untitled task" });
            }
          }}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            aria-expanded={activeMetaEditor === "category"}
            className="flex h-9 max-w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm font-semibold text-[var(--muted)] transition enabled:hover:border-[var(--border-strong)] enabled:hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-65"
            disabled={readOnly}
            type="button"
            onClick={() =>
              setActiveMetaEditor((current) =>
                current === "category" ? null : "category",
              )
            }
          >
            {selectedCategory ? (
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: selectedCategory.color }}
              />
            ) : (
              <Palette size={15} aria-hidden="true" />
            )}
            <span className="truncate">
              {selectedCategory?.name ?? "Category"}
            </span>
          </button>

          <button
            aria-expanded={activeMetaEditor === "date"}
            className="flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm font-semibold text-[var(--muted)] transition enabled:hover:border-[var(--border-strong)] enabled:hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-65"
            disabled={readOnly}
            type="button"
            onClick={() =>
              setActiveMetaEditor((current) =>
                current === "date" ? null : "date",
              )
            }
          >
            <CalendarDays size={15} aria-hidden="true" />
            {formatDueDate(task.due)}
          </button>

          <button
            aria-expanded={activeMetaEditor === "tags"}
            className="flex h-9 max-w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm font-semibold text-[var(--muted)] transition enabled:hover:border-[var(--border-strong)] enabled:hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-65"
            disabled={readOnly}
            type="button"
            onClick={() =>
              setActiveMetaEditor((current) =>
                current === "tags" ? null : "tags",
              )
            }
          >
            <Tag size={15} className="shrink-0" aria-hidden="true" />
            <span className="truncate">
              {task.tags.length
                ? task.tags.map((tag) => `#${tag}`).join(" ")
                : "Tags"}
            </span>
          </button>

          <select
            aria-label="Priority"
            className={`h-9 rounded-md border px-3 text-sm font-semibold capitalize outline-none transition focus:ring-2 focus:ring-[var(--accent-ring)] ${priorityClass(
              task.priority,
            )}`}
            disabled={readOnly}
            value={task.priority}
            onChange={(event) =>
              onUpdateTask(task.id, {
                priority: event.target.value as Priority,
              })
            }
          >
            <option value="low">Low priority</option>
            <option value="medium">Medium priority</option>
            <option value="high">High priority</option>
          </select>
        </div>

        {activeMetaEditor === "category" ? (
          <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase text-[var(--subtle)]">
                Category
              </span>
              <select
                autoFocus
                className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none transition focus:border-[var(--accent)]"
                disabled={readOnly}
                value={task.categoryId ?? ""}
                onChange={(event) =>
                  onUpdateTask(task.id, {
                    categoryId: event.target.value || null,
                  })
                }
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
              <input
                aria-label="New category name"
                className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none transition placeholder:text-[var(--subtle)] focus:border-[var(--accent)]"
                disabled={readOnly}
                placeholder="Create a new category"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCategory();
                  }
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                {categoryColorOptions.map((color) => (
                  <button
                    key={color}
                    aria-label={`Use category color ${color}`}
                    disabled={readOnly}
                    className={`h-8 w-8 rounded-full border-2 ${
                      newCategoryColor === color
                        ? "border-[var(--foreground)]"
                        : "border-[var(--surface)]"
                    } shadow-[0_0_0_1px_var(--border)]`}
                    style={{ backgroundColor: color }}
                    type="button"
                    onClick={() => setNewCategoryColor(color)}
                  />
                ))}
                <button
                  className="ml-auto h-9 rounded-md bg-[var(--accent)] px-3 text-sm font-semibold text-white transition enabled:hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={readOnly}
                  type="button"
                  onClick={addCategory}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeMetaEditor === "date" ? (
          <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase text-[var(--subtle)]">
                Due date
              </span>
              <input
                autoFocus
                className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none transition focus:border-[var(--accent)]"
                disabled={readOnly}
                type="date"
                value={toDateInputValue(task.due)}
                onChange={(event) =>
                  onUpdateTask(task.id, { due: event.target.value })
                }
                onInput={(event) =>
                  onUpdateTask(task.id, {
                    due: event.currentTarget.value,
                  })
                }
              />
            </label>
          </div>
        ) : null}

        {activeMetaEditor === "tags" ? (
          <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase text-[var(--subtle)]">
                Tags
              </span>
              <input
                autoFocus
                className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none transition placeholder:text-[var(--subtle)] focus:border-[var(--accent)]"
                disabled={readOnly}
                placeholder="#writing #research"
                value={task.tags.map((tag) => `#${tag}`).join(" ")}
                onChange={(event) =>
                  onUpdateTask(task.id, {
                    tags: parseTagsInput(event.target.value),
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setActiveMetaEditor(null);
                  }
                }}
              />
            </label>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
          {task.spent > 0 ? (
            <span className="flex items-center gap-1.5">
              <Clock3 size={14} aria-hidden="true" />
              {task.spent}m spent
            </span>
          ) : null}
          {task.subtasks.length ? (
            <span className="flex items-center gap-1.5">
              <ListChecks size={14} aria-hidden="true" />
              {completedSubtasks}/{task.subtasks.length}
            </span>
          ) : null}
          {task.comments.length ? (
            <span className="flex items-center gap-1.5">
              <MessageSquare size={14} aria-hidden="true" />
              {task.comments.length}
            </span>
          ) : null}
        </div>

        <div className="mt-5 space-y-5">
        <div>
          <div className="flex items-center justify-between gap-3">
            <label
              className="text-sm font-semibold text-[var(--muted)]"
              htmlFor="card-description"
            >
              Description
            </label>
            {readOnly ? null : (
              <button
                className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 text-sm font-semibold text-white transition enabled:hover:bg-[var(--accent-hover)] disabled:bg-[var(--green)]"
                disabled={!hasUnsavedDescription}
                type="button"
                onClick={() =>
                  onUpdateTask(task.id, { description: descriptionDraft })
                }
              >
                <Check size={15} aria-hidden="true" />
                {hasUnsavedDescription ? "Save description" : "Saved"}
              </button>
            )}
          </div>
          <textarea
            id="card-description"
            className="mt-2 min-h-28 w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm leading-6 outline-none transition placeholder:text-[var(--subtle)] focus:border-[var(--accent)] read-only:cursor-default"
            placeholder="Add context, links, or notes for this task."
            readOnly={readOnly}
            value={descriptionDraft}
            onChange={(event) => setDescriptionDraft(event.target.value)}
          />
          {!readOnly && hasUnsavedDescription ? (
            <p className="mt-1 text-xs text-[var(--amber)]">
              Description changes will save when the card closes.
            </p>
          ) : null}
        </div>

        <details className="group rounded-lg border border-[var(--border)] bg-[var(--surface-raised)]">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold text-[var(--muted)] [&::-webkit-details-marker]:hidden">
            <ListChecks size={16} aria-hidden="true" />
            <span className="flex-1">Subtasks</span>
            <span className="rounded bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--muted)]">
              {completedSubtasks}/{task.subtasks.length}
            </span>
            <ChevronDown
              className="transition-transform group-open:rotate-180"
              size={16}
              aria-hidden="true"
            />
          </summary>

          <div className="border-t border-[var(--border)] p-4">
            <div className="space-y-2">
              {task.subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2"
              >
                <button
                  aria-label={
                    subtask.done
                      ? `Mark ${subtask.title} incomplete`
                      : `Mark ${subtask.title} complete`
                  }
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-55 ${
                    subtask.done
                      ? "border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]"
                      : "border-[var(--border-strong)] text-[var(--subtle)]"
                  }`}
                  disabled={readOnly}
                  type="button"
                  onClick={() => updateSubtask(subtask.id, { done: !subtask.done })}
                >
                  {subtask.done ? (
                    <CheckCircle2 size={16} aria-hidden="true" />
                  ) : (
                    <Check size={16} aria-hidden="true" />
                  )}
                </button>
                <input
                  aria-label={`Subtask ${subtask.title}`}
                  className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${
                    subtask.done ? "text-[var(--subtle)] line-through" : ""
                  }`}
                  readOnly={readOnly}
                  value={subtask.title}
                  onChange={(event) =>
                    updateSubtask(subtask.id, {
                      title: event.target.value || "Untitled subtask",
                    })
                  }
                />
                <button
                  aria-label={`Delete subtask ${subtask.title}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--subtle)] transition enabled:hover:bg-[var(--accent-soft)] enabled:hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={readOnly}
                  type="button"
                  onClick={() => removeSubtask(subtask.id)}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
              ))}
            </div>

          {readOnly ? null : (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addSubtask();
              }}
            >
              <input
                aria-label="New subtask"
                className="h-10 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none transition placeholder:text-[var(--subtle)] focus:border-[var(--accent)]"
                placeholder="Add subtask"
                value={newSubtaskTitle}
                onChange={(event) => setNewSubtaskTitle(event.target.value)}
              />
              <button
                aria-label="Add subtask"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] text-white transition hover:bg-[var(--accent-hover)]"
                type="submit"
              >
                <Plus size={17} aria-hidden="true" />
              </button>
            </form>
          )}
          </div>
        </details>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)]">
              <MessageSquare size={16} aria-hidden="true" />
              Comments and activity
            </div>
            <span className="rounded bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--muted)]">
              {task.comments.length}
            </span>
          </div>

          <div className="space-y-4">
            {task.comments.map((comment) => (
              <article key={comment.id} className="flex gap-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{
                    backgroundColor:
                      comment.authorId === currentUserId
                        ? selectedCategory?.color ?? "#ff005e"
                        : "#2f6fed",
                  }}
                >
                  {comment.authorName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold">
                      {comment.authorName}
                    </span>
                    <time
                      className="text-xs text-[var(--subtle)]"
                      dateTime={comment.createdAt}
                    >
                      {formatCommentDate(comment.createdAt)}
                    </time>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground-soft)]">
                    {comment.body}
                  </p>
                </div>
              </article>
            ))}
          </div>

          {readOnly ? null : (
            <form
              className="mt-4 flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addComment();
              }}
            >
              <textarea
                aria-label="Write a comment"
                className="min-h-20 min-w-0 flex-1 resize-none rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-sm leading-5 outline-none transition placeholder:text-[var(--subtle)] focus:border-[var(--accent)]"
                placeholder="Write a comment..."
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
              />
              <button
                aria-label="Add comment"
                className="flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
                type="submit"
              >
                <Send size={15} aria-hidden="true" />
                Comment
              </button>
            </form>
          )}
        </section>

        <div className="border-t border-[var(--border)] pt-5">
          {readOnly ? (
            <div className="flex items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm font-semibold text-[var(--muted)]">
              <Eye size={16} aria-hidden="true" />
              Read-only project
            </div>
          ) : deleteDisabled ? (
            <div className="flex items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm font-semibold text-[var(--muted)]">
              <Clock3 size={16} aria-hidden="true" />
              Pomodoro in progress
            </div>
          ) : confirmDelete ? (
            <div className="space-y-3 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3">
              <p className="text-sm font-semibold text-[var(--danger)]">
                Delete this task?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm font-semibold text-[var(--muted)]"
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
                <button
                  className="flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--accent)] text-sm font-semibold text-white"
                  type="button"
                  onClick={() => onDeleteTask(task.id)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <button
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--accent-border)] bg-[var(--surface)] text-sm font-semibold text-[var(--danger)] transition hover:bg-[var(--accent-soft)]"
              type="button"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={16} aria-hidden="true" />
              Delete task
            </button>
          )}
        </div>
        </div>
      </section>
    </div>
  );
}

function TimerView({
  isRunning,
  onFocusMinutesChange,
  onStart,
  remainingSeconds,
  selectedTask,
  sessionNote,
  setSessionNote,
  settings,
  timerMinutes,
  timerProgress,
}: {
  isRunning: boolean;
  onFocusMinutesChange: (minutes: number) => void;
  onStart: () => void;
  remainingSeconds: number;
  selectedTask?: Task;
  sessionNote: string;
  setSessionNote: (value: string) => void;
  settings: UserSettings;
  timerMinutes: number;
  timerProgress: number;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const circumference = 2 * Math.PI * 45;
  const dashOffset = circumference - (timerProgress / 100) * circumference;
  const timerLocked = isRunning || timerProgress > 0;

  return (
    <div className="grid min-h-[640px] gap-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--foreground)] md:p-8 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="flex min-h-[520px] flex-col items-center justify-center">
        <div className="w-full max-w-md text-center">
          <p className="text-sm font-semibold uppercase text-[var(--danger)]">
            Focus task
          </p>
          <h3 className="mt-2 text-3xl font-bold leading-tight">
            {selectedTask?.title ?? "Choose a task from the board"}
          </h3>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {[5, 10, 15, 25, 45, 60].map((minutes) => (
            <button
              key={minutes}
              aria-label={`Set focus timer to ${minutes} minutes`}
              aria-pressed={timerMinutes === minutes}
              className={`h-9 min-w-11 rounded-md border px-3 text-sm font-semibold transition ${
                timerMinutes === minutes
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--danger)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)]"
              } disabled:cursor-not-allowed disabled:opacity-45`}
              disabled={timerLocked}
              type="button"
              onClick={() => onFocusMinutesChange(minutes)}
            >
              {minutes}
            </button>
          ))}
          <label className="flex h-9 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--muted)] focus-within:border-[var(--accent)]">
            <span className="sr-only">Custom focus minutes</span>
            <input
              aria-label="Custom focus minutes"
              className="w-10 bg-transparent text-center font-semibold outline-none disabled:cursor-not-allowed"
              disabled={timerLocked}
              max={180}
              min={5}
              type="number"
              value={timerMinutes}
              onChange={(event) =>
                onFocusMinutesChange(Number(event.target.value))
              }
            />
            <span className="pl-1 text-xs">min</span>
          </label>
        </div>

        <div className="relative mt-6 flex h-72 w-72 items-center justify-center sm:h-96 sm:w-96">
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full -rotate-90"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              fill="none"
              r="45"
              stroke="var(--border)"
              strokeWidth="2"
            />
            <circle
              cx="50"
              cy="50"
              fill="none"
              r="45"
              stroke="var(--accent)"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeWidth="4"
            />
          </svg>
          <div className="text-center">
            <div className="text-6xl font-semibold sm:text-7xl">
              {formatTimer(remainingSeconds)}
            </div>
            <div className="mt-4 inline-flex rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--danger)]">
              {timerMinutes} min focus
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center">
          <button
            aria-label={
              isRunning
                ? "Pomodoro in progress and cannot be paused"
                : selectedTask
                  ? "Start Pomodoro"
                  : "Choose a task from the board before starting"
            }
            title={
              isRunning
                ? "Pomodoro in progress"
                : selectedTask
                  ? "Start Pomodoro"
                  : "Choose a task from the board"
            }
            className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[var(--shadow-accent)] transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--border-strong)] disabled:shadow-none"
            disabled={isRunning || !selectedTask}
            type="button"
            onClick={onStart}
          >
            {isRunning ? (
              <Clock3
                className="animate-pulse motion-reduce:animate-none"
                size={32}
                aria-hidden="true"
              />
            ) : (
              <Play size={34} fill="currentColor" aria-hidden="true" />
            )}
          </button>
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <section className="flex min-h-[520px] flex-col rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)]">
              <FileText size={17} aria-hidden="true" />
              Session Notes
            </div>
            <div className="flex items-center gap-1">
              {[
                ["heading", "H", "Heading"],
                ["bold", "B", "Bold"],
                ["italic", "I", "Italic"],
                ["list", "-", "Bulleted list"],
                ["check", "[]", "Checklist"],
                ["quote", ">", "Quote"],
              ].map(([kind, label, accessibleLabel]) => (
                <button
                  key={kind}
                  aria-label={accessibleLabel}
                  title={accessibleLabel}
                  className="h-8 min-w-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  type="button"
                  onClick={() =>
                    setSessionNote(
                      insertMarkdown(
                        sessionNote,
                        kind as "heading" | "bold" | "italic" | "list" | "check" | "quote",
                      ),
                    )
                  }
                >
                  {label}
                </button>
              ))}
              <button
                aria-label={showPreview ? "Hide markdown preview" : "Show markdown preview"}
                aria-pressed={showPreview}
                title={showPreview ? "Hide preview" : "Show preview"}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                type="button"
                onClick={() => setShowPreview((current) => !current)}
              >
                {showPreview ? (
                  <EyeOff size={15} aria-hidden="true" />
                ) : (
                  <Eye size={15} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {showPreview ? (
            <MarkdownPreview note={sessionNote} />
          ) : (
            <textarea
              aria-label="Session notes"
              className="mt-4 min-h-[400px] flex-1 resize-none rounded-md border border-[var(--border)] bg-[var(--surface)] p-5 text-[15px] leading-7 text-[var(--foreground)] outline-none transition placeholder:text-[var(--subtle)] focus:border-[var(--accent)]"
              placeholder={"## Session notes\n- What moved forward?\n- What should I keep in mind next?"}
              value={sessionNote}
              onChange={(event) => setSessionNote(event.target.value)}
            />
          )}
        </section>

        {settings.showNextUp ? (
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-xs font-semibold uppercase text-[var(--danger)]">Next Up</p>
            <h4 className="mt-2 text-lg font-semibold">
              {selectedTask?.title ?? "Pick a task from the board"}
            </h4>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {selectedTask
                ? `${Math.max(0, selectedTask.estimate - selectedTask.spent)} min remaining`
                : "No active task selected"}
            </p>
          </section>
        ) : null}

        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--muted)]">Break</span>
            <span className="font-semibold text-[var(--green)]">
              {settings.breakMinutes} min
            </span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-[var(--surface)]">
            <div className="h-full w-1/2 rounded-full bg-[var(--green)]" />
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-[var(--muted)]">
              {settings.soundEnabled ? (
                <Volume2 size={16} aria-hidden="true" />
              ) : (
                <VolumeX size={16} aria-hidden="true" />
              )}
              Focus sound
            </span>
            <span className="font-semibold capitalize text-[var(--foreground)]">
              {settings.soundEnabled ? focusSoundLabels[settings.focusSound] : "Off"}
            </span>
          </div>
        </section>
      </aside>
    </div>
  );
}

function MarkdownPreview({ note }: { note: string }) {
  const lines = note.trim() ? note.split("\n") : ["Session notes preview"];

  return (
    <div className="mt-4 min-h-[400px] flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] p-5 text-[15px] leading-7 text-[var(--foreground)]">
      {lines.map((line, index) => {
        if (line.startsWith("## ")) {
          return (
            <h3 key={`${line}-${index}`} className="mb-3 mt-2 text-xl font-semibold">
              {line.replace(/^## /, "")}
            </h3>
          );
        }

        if (line.startsWith("- [ ] ")) {
          return (
            <p key={`${line}-${index}`} className="flex gap-2">
              <span className="mt-1 h-4 w-4 rounded border border-[var(--border-strong)]" />
              <span>{line.replace(/^- \[ \] /, "")}</span>
            </p>
          );
        }

        if (line.startsWith("- ")) {
          return (
            <p key={`${line}-${index}`} className="pl-4 before:mr-2 before:content-['-']">
              {line.replace(/^- /, "")}
            </p>
          );
        }

        if (line.startsWith("> ")) {
          return (
            <blockquote
              key={`${line}-${index}`}
              className="border-l-2 border-[var(--accent)] pl-3 text-[var(--muted)]"
            >
              {line.replace(/^> /, "")}
            </blockquote>
          );
        }

        return <p key={`${line}-${index}`}>{line || "\u00a0"}</p>;
      })}
    </div>
  );
}

function AnalyticsView({
  cancellations,
  categories,
  projects,
  sessions,
  settings,
  tasks,
  userId,
}: {
  cancellations: PomodoroCancellation[];
  categories: TaskCategory[];
  projects: Project[];
  sessions: FocusSession[];
  settings: UserSettings;
  tasks: Task[];
  userId: string;
}) {
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const [projectFilterId, setProjectFilterId] = useState<"all" | string>("all");
  const [selectedAnalyticsTags, setSelectedAnalyticsTags] = useState<string[]>([]);
  const trackedFocusScoreRef = useRef("");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - (rangeDays - 1));
  const effectiveProjectFilterId =
    projectFilterId === "all" ||
    projects.some((project) => project.id === projectFilterId)
      ? projectFilterId
      : "all";

  function dateKey(value: string | Date) {
    const date = typeof value === "string" ? new Date(value) : value;
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  const selectedProject =
    effectiveProjectFilterId === "all"
      ? null
      : projects.find((project) => project.id === effectiveProjectFilterId) ?? null;
  const scopedTasks =
    effectiveProjectFilterId === "all"
      ? tasks
      : tasks.filter((task) => task.projectId === effectiveProjectFilterId);
  const scopedCategories =
    effectiveProjectFilterId === "all"
      ? categories
      : categories.filter(
          (category) => category.projectId === effectiveProjectFilterId,
        );
  const scopedTags = Array.from(
    new Set(scopedTasks.flatMap((task) => task.tags.map(normalizeTag))),
  )
    .filter(Boolean)
    .sort();
  const activeAnalyticsTags = selectedAnalyticsTags.filter((tag) =>
    scopedTags.includes(tag),
  );
  const visibleTasks = activeAnalyticsTags.length
    ? scopedTasks.filter((task) =>
        activeAnalyticsTags.some((tag) =>
          task.tags.map(normalizeTag).includes(tag),
        ),
      )
    : scopedTasks;
  const visibleTaskIds = new Set(visibleTasks.map((task) => task.id));
  const scopedSessions =
    effectiveProjectFilterId === "all"
      ? sessions
      : sessions.filter((session) => session.projectId === effectiveProjectFilterId);
  const scopedCancellations =
    effectiveProjectFilterId === "all"
      ? cancellations
      : cancellations.filter(
          (cancellation) => cancellation.projectId === effectiveProjectFilterId,
        );
  const analyticsSessions = activeAnalyticsTags.length
    ? scopedSessions.filter(
        (session) =>
          session.taskId !== null && visibleTaskIds.has(session.taskId),
      )
    : scopedSessions;
  const analyticsCancellations = activeAnalyticsTags.length
    ? scopedCancellations.filter(
        (cancellation) =>
          cancellation.taskId !== null &&
          visibleTaskIds.has(cancellation.taskId),
      )
    : scopedCancellations;
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const analyticsScopeLabel = selectedProject?.name ?? "All projects";

  const rangeSessions = analyticsSessions
    .filter((session) => new Date(session.completedAt) >= rangeStart)
    .sort(
      (left, right) =>
        new Date(right.completedAt).getTime() -
        new Date(left.completedAt).getTime(),
    );
  const rangeCancellations = analyticsCancellations.filter(
    (cancellation) => new Date(cancellation.cancelledAt) >= rangeStart,
  );
  const rangeMinutes = rangeSessions.reduce(
    (total, session) => total + session.minutes,
    0,
  );
  const dailyAverage = rangeSessions.length / rangeDays;
  const completedCount = visibleTasks.filter(
    (task) => task.status === "done",
  ).length;
  const completionRate = visibleTasks.length
    ? Math.round((completedCount / visibleTasks.length) * 100)
    : 0;
  const totalAttempts = rangeSessions.length + rangeCancellations.length;
  const focusSessions = analyticsSessions.filter(
    (session) => !session.userId || session.userId === userId,
  );
  const focusCancellations = analyticsCancellations.filter(
    (cancellation) => !cancellation.userId || cancellation.userId === userId,
  );
  const completedTasks = visibleTasks.flatMap((task) =>
    task.completedAt ? [{ completedAt: task.completedAt }] : [],
  );
  const focusScoreTrend = calculateFocusScoreTrend({
    cancellations: focusCancellations,
    completedTasks,
    sessions: focusSessions,
    settings,
  });
  const focusScore = focusScoreTrend.current;
  const focusOpportunityId = focusScore.biggestOpportunity?.id ?? null;

  useEffect(() => {
    const trackingKey = [
      effectiveProjectFilterId,
      activeAnalyticsTags.join(","),
      focusScore.window.to,
      focusScore.score ?? "locked",
    ].join(":");

    if (trackedFocusScoreRef.current === trackingKey) {
      return;
    }

    trackedFocusScoreRef.current = trackingKey;
    trackEvent("focus_score_viewed", {
      band: focusScore.band?.label ?? null,
      days_until_unlock: focusScore.daysUntilUnlock,
      project_scope: effectiveProjectFilterId === "all" ? "all" : "project",
      score: focusScore.score,
      unlocked: focusScore.unlocked,
    });

    if (focusOpportunityId) {
      trackEvent("nudge_shown", {
        component: focusOpportunityId,
        nudge_type: "focus_score_opportunity",
        score: focusScore.score,
      });
    }

    if (!focusScore.unlocked) {
      return;
    }

    const unlockKey = `tockli.focusScoreUnlocked:${userId}:${focusScore.window.to}`;
    try {
      if (window.localStorage.getItem(unlockKey)) {
        return;
      }
      window.localStorage.setItem(unlockKey, "1");
    } catch {
      // Analytics is best effort when storage is unavailable.
    }

    trackEvent("focus_score_unlocked", {
      band: focusScore.band?.label ?? null,
      score: focusScore.score,
    });
  }, [
    activeAnalyticsTags,
    effectiveProjectFilterId,
    focusScore.band?.label,
    focusOpportunityId,
    focusScore.daysUntilUnlock,
    focusScore.score,
    focusScore.unlocked,
    focusScore.window.to,
    userId,
  ]);

  const activityDays = new Set(
    analyticsSessions.map((session) => dateKey(session.completedAt)),
  );
  const streakCursor = new Date(today);
  if (!activityDays.has(dateKey(streakCursor))) {
    streakCursor.setDate(streakCursor.getDate() - 1);
  }
  let focusStreak = 0;
  while (activityDays.has(dateKey(streakCursor))) {
    focusStreak += 1;
    streakCursor.setDate(streakCursor.getDate() - 1);
  }

  const sessionMinutesByDay = new Map<string, number>();
  analyticsSessions.forEach((session) => {
    const key = dateKey(session.completedAt);
    sessionMinutesByDay.set(
      key,
      (sessionMinutesByDay.get(key) ?? 0) + session.minutes,
    );
  });

  const lastSeven = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    const dayOfWeek = day.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    day.setDate(day.getDate() - daysToMonday + index);
    return {
      key: dateKey(day),
      label: day.toLocaleDateString("en", { weekday: "short" }),
      minutes: sessionMinutesByDay.get(dateKey(day)) ?? 0,
    };
  });
  const maxDay = Math.max(25, ...lastSeven.map((day) => day.minutes));
  const peakDay = lastSeven.reduce((peak, day) =>
    day.minutes > peak.minutes ? day : peak,
  );

  const taskById = new Map(visibleTasks.map((task) => [task.id, task]));
  const categoryById = new Map(
    scopedCategories.map((category) => [category.id, category]),
  );
  const categoryTotals = new Map<
    string,
    { color: string; label: string; minutes: number }
  >();
  rangeSessions.forEach((session) => {
    const task = session.taskId ? taskById.get(session.taskId) : undefined;
    const category = task?.categoryId
      ? categoryById.get(task.categoryId)
      : undefined;
    const key = category?.id ?? "uncategorised";
    const current = categoryTotals.get(key) ?? {
      color: category?.color ?? "var(--subtle)",
      label: category?.name ?? "Uncategorised",
      minutes: 0,
    };
    current.minutes += session.minutes;
    categoryTotals.set(key, current);
  });
  const categoryBreakdown = Array.from(categoryTotals.values()).sort(
    (left, right) => right.minutes - left.minutes,
  );

  const minutesByHour = new Map<number, number>();
  rangeSessions.forEach((session) => {
    const hour = new Date(session.completedAt).getHours();
    minutesByHour.set(hour, (minutesByHour.get(hour) ?? 0) + session.minutes);
  });
  const peakHour = Array.from(minutesByHour.entries()).sort(
    (left, right) => right[1] - left[1],
  )[0]?.[0];
  const peakHourLabel =
    peakHour === undefined
      ? null
      : `${new Date(2026, 0, 1, peakHour).toLocaleTimeString("en", {
          hour: "numeric",
        })} - ${new Date(2026, 0, 1, peakHour + 1).toLocaleTimeString("en", {
          hour: "numeric",
        })}`;

  const heatmapDays = buildRecentActivityDates(today).map((day) => ({
    date: day,
    minutes: sessionMinutesByDay.get(dateKey(day)) ?? 0,
  }));
  const heatmapMax = Math.max(1, ...heatmapDays.map((day) => day.minutes));

  const cancellationCounts = (
    Object.keys(cancellationReasonLabels) as CancellationReason[]
  ).map((reason) => ({
    reason,
    count: rangeCancellations.filter(
      (cancellation) => cancellation.reason === reason,
    ).length,
  }));
  const cancellationRate = totalAttempts
    ? Math.round((rangeCancellations.length / totalAttempts) * 100)
    : 0;
  const rangeLabel = `${rangeStart.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  })} - ${today.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--danger)]">
            {analyticsScopeLabel}
          </p>
          <h2 className="mt-1 text-3xl font-bold">Focus insights</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{rangeLabel}</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <label className="flex h-10 w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--muted)] sm:w-auto">
            <FolderKanban size={16} aria-hidden="true" />
            <span className="sr-only">Analytics project</span>
            <select
              aria-label="Analytics project"
              className="min-w-0 bg-transparent font-semibold text-[var(--foreground)] outline-none"
              value={effectiveProjectFilterId}
              onChange={(event) => setProjectFilterId(event.target.value)}
            >
              <option value="all">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <div
            aria-label="Analytics date range"
            className="flex w-fit rounded-md border border-[var(--border)] bg-[var(--surface)] p-1"
            role="group"
          >
            {([7, 30, 90] as const).map((days) => (
              <button
                key={days}
                aria-pressed={rangeDays === days}
                className={`h-8 rounded px-3 text-xs font-semibold transition ${
                  rangeDays === days
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                }`}
                type="button"
                onClick={() => setRangeDays(days)}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>
      </header>

      {scopedTags.length ? (
        <section className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="flex items-center gap-2 pr-1 text-sm font-semibold text-[var(--muted)]">
            <Hash size={16} aria-hidden="true" />
            Analytics filter
          </div>
          {scopedTags.map((tag) => {
            const active = activeAnalyticsTags.includes(tag);

            return (
              <button
                key={tag}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--danger)]"
                    : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)] hover:border-[var(--accent)]"
                }`}
                type="button"
                onClick={() =>
                  setSelectedAnalyticsTags((current) =>
                    current.includes(tag)
                      ? current.filter((item) => item !== tag)
                      : [...current, tag],
                  )
                }
              >
                #{tag}
              </button>
            );
          })}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Clock3}
          label="Focus time"
          tone="crimson"
          value={formatHours(rangeMinutes)}
        />
        <MetricCard
          icon={BarChart3}
          label="Daily average"
          tone="green"
          value={`${dailyAverage.toFixed(1)} sessions`}
        />
        <MetricCard
          icon={Gauge}
          label="Focus streak"
          tone="amber"
          value={`${focusStreak} ${focusStreak === 1 ? "day" : "days"}`}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Focus score"
          tone="ink"
          value={
            focusScore.unlocked
              ? `${focusScore.score} / 100`
              : `${focusScore.daysUntilUnlock} ${
                  focusScore.daysUntilUnlock === 1 ? "day" : "days"
                } to unlock`
          }
        />
      </section>

      <section
        aria-labelledby="focus-score-title"
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--danger)]">
              Rolling 7-day score
            </p>
            <h3 id="focus-score-title" className="mt-1 text-xl font-semibold">
              Did you do the work you planned?
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Your Focus Score rewards showing up on working days, reaching your
              session goal, finishing cards, and following sessions through.
            </p>
          </div>
          {focusScore.unlocked ? (
            <div className="shrink-0 text-left sm:text-right">
              <div className="text-4xl font-bold">{focusScore.score}</div>
              <p className="mt-1 text-sm font-semibold text-[var(--green-strong)]">
                {focusScore.band?.label}
                {focusScoreTrend.delta === null
                  ? ""
                  : ` · ${focusScoreTrend.delta >= 0 ? "+" : ""}${
                      focusScoreTrend.delta
                    } vs prior week`}
              </p>
            </div>
          ) : (
            <div className="max-w-xs rounded-md bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--muted)]">
              Complete a session on {focusScore.daysUntilUnlock} more active{" "}
              {focusScore.daysUntilUnlock === 1 ? "day" : "days"} to reveal your
              score.
            </div>
          )}
        </div>

        {focusScore.unlocked ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {focusScore.components.map((component) => (
              <div
                key={component.id}
                className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-4"
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold">{component.label}</span>
                  <span className="text-[var(--muted)]">
                    {component.earned}/{component.possible}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{
                      width: `${Math.round((component.ratio ?? 0) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {focusScore.unlocked && focusScore.biggestOpportunity ? (
          <div className="mt-4 flex gap-3 rounded-md border-l-2 border-[var(--amber)] bg-[var(--amber-soft)] p-4">
            <Sparkles
              className="mt-0.5 shrink-0 text-[var(--amber-strong)]"
              size={18}
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold">
                Next step: {focusScore.biggestOpportunity.label}
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                {focusScore.biggestOpportunity.hint}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                Weekly distribution
              </p>
              <h3 className="mt-1 text-xl font-semibold">Focus minutes by day</h3>
            </div>
            <span className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-xs font-semibold text-[var(--danger)]">
              {lastSeven.reduce((total, day) => total + day.minutes, 0)} min
            </span>
          </div>

          <div className="mt-6 grid h-64 grid-cols-7 items-end gap-2 sm:gap-3">
            {lastSeven.map((day) => (
              <div key={day.key} className="flex h-full flex-col justify-end gap-2">
                <div className="flex flex-1 items-end">
                  <div
                    className="w-full rounded-md bg-[var(--accent)]"
                    style={{
                      height: `${Math.max(8, (day.minutes / maxDay) * 100)}%`,
                      opacity: day.minutes ? 1 : 0.14,
                    }}
                    title={`${day.label}: ${day.minutes} focus minutes`}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold">{day.minutes || "-"}</p>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">{day.label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="text-[var(--blue)]" size={19} aria-hidden="true" />
            <h3 className="text-xl font-semibold">Productivity commentary</h3>
          </div>

          <div className="mt-5 space-y-4">
            <div className="border-l-2 border-[var(--blue)] pl-3">
              <p className="text-xs font-semibold uppercase text-[var(--blue)]">
                Peak rhythm
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                {peakDay.minutes
                  ? `${peakDay.label} led this week with ${peakDay.minutes} focused minutes${
                      peakHourLabel ? `, with your strongest hour around ${peakHourLabel}` : ""
                    }.`
                  : "Complete a Pomodoro to establish your weekly focus rhythm."}
              </p>
            </div>
            <div className="border-l-2 border-[var(--green)] pl-3">
              <p className="text-xs font-semibold uppercase text-[var(--green-strong)]">
                Task momentum
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                {completionRate}% of visible tasks are complete, with{" "}
                {rangeSessions.length} committed Pomodoro
                {rangeSessions.length === 1 ? "" : "s"} in this range.
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">
              Category breakdown
            </p>
            <div className="mt-3 space-y-3">
              {categoryBreakdown.length ? (
                categoryBreakdown.slice(0, 5).map((category) => {
                  const percent = rangeMinutes
                    ? Math.round((category.minutes / rangeMinutes) * 100)
                    : 0;
                  return (
                    <div key={category.label}>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate font-semibold">
                          {category.label}
                        </span>
                        <span className="shrink-0 text-[var(--muted)]">
                          {percent}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: category.color,
                            width: `${percent}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  No category focus data in this range.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">
              Last 26 weeks
            </p>
            <h3 className="mt-1 text-xl font-semibold">Focus intensity map</h3>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase text-[var(--muted)]">
            <span className="mr-1">Less</span>
            {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
              <span
                key={intensity}
                className="h-3 w-3 rounded-[2px]"
                style={{
                  backgroundColor:
                    intensity === 0
                      ? "var(--heat-empty)"
                      : `rgba(255, 0, 94, ${0.2 + intensity * 0.8})`,
                }}
              />
            ))}
            <span className="ml-1">More</span>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto pb-1">
          <div className="grid w-max grid-flow-col grid-rows-7 gap-1">
            {heatmapDays.map((day) => {
              const intensity = day.minutes / heatmapMax;
              return (
                <span
                  key={dateKey(day.date)}
                  className="h-3 w-3 rounded-[2px]"
                  style={{
                    backgroundColor: day.minutes
                      ? `rgba(255, 0, 94, ${0.2 + intensity * 0.8})`
                      : "var(--heat-empty)",
                  }}
                  title={`${day.date.toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                  })}: ${day.minutes} focus minutes`}
                />
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">
              Commitment quality
            </p>
            <h3 className="mt-1 text-xl font-semibold">
              Cancellation reason analysis
            </h3>
          </div>
          <span className="rounded-md bg-[var(--amber-soft)] px-2 py-1 text-xs font-semibold text-[var(--amber-strong)]">
            {cancellationRate}% cancellation rate
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cancellationCounts.map(({ count, reason }) => {
            const percent = rangeCancellations.length
              ? Math.round((count / rangeCancellations.length) * 100)
              : 0;
            return (
              <div
                key={reason}
                className="border-l-2 border-[var(--accent)] py-1 pl-3"
              >
                <p className="text-xs font-semibold text-[var(--muted)]">
                  {cancellationReasonLabels[reason]}
                </p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <span className="text-2xl font-bold">{percent}%</span>
                  <span className="text-xs text-[var(--muted)]">
                    {count} {count === 1 ? "session" : "sessions"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold">Recent Sessions</h3>
          <Clock3 className="text-[var(--muted)]" size={20} aria-hidden="true" />
        </div>
        <div className="divide-y divide-[var(--border)]">
          {rangeSessions.length ? (
            rangeSessions.slice(0, 6).map((session) => (
              <div
                key={session.id}
                className={`grid gap-2 py-3 text-sm ${
                  effectiveProjectFilterId === "all"
                    ? "sm:grid-cols-[110px_140px_minmax(0,1fr)_80px]"
                    : "sm:grid-cols-[120px_1fr_90px]"
                }`}
              >
                <span className="text-[var(--muted)]">
                  {new Date(session.completedAt).toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                {effectiveProjectFilterId === "all" ? (
                  <span className="min-w-0 truncate text-[var(--muted)]">
                    {projectById.get(session.projectId)?.name ?? "Unknown project"}
                  </span>
                ) : null}
                <span className="min-w-0 truncate">
                  {session.taskId
                    ? taskById.get(session.taskId)?.title ?? session.note
                    : session.note}
                </span>
                <span className="font-semibold text-[var(--accent)]">
                  {session.minutes} min
                </span>
              </div>
            ))
          ) : (
            <p className="py-6 text-sm text-[var(--muted)]">
              No completed Pomodoros in this range.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function OnboardingModal({ onChoose }: { onChoose: (choice: "examples" | "blank") => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171918]/55 p-4">
      <section
        aria-labelledby="onboarding-title"
        className="w-full max-w-2xl rounded-lg border border-[#dededa] bg-white p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)] sm:p-8"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#fff0f5] text-[#ff005e]">
          <FolderKanban size={22} aria-hidden="true" />
        </div>
        <p className="mt-5 text-sm font-semibold uppercase text-[#b90042]">Set up your board</p>
        <h1 id="onboarding-title" className="mt-2 text-3xl font-semibold">
          How would you like to begin?
        </h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-[#62605b]">
          Start with a few realistic cards to see how Tockli works, or begin with a clean board.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            className="group rounded-lg border border-[#e8e8e6] bg-[#f9f9f7] p-5 text-left transition hover:border-[#ff005e] hover:bg-[#fff7fa] focus:outline-none focus:ring-2 focus:ring-[#ff005e]"
            type="button"
            onClick={() => onChoose("examples")}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#fff0f5] text-[#ff005e]">
              <Sparkles size={19} aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-lg font-semibold">Show me an example</h2>
            <p className="mt-2 text-sm leading-6 text-[#62605b]">
              A personal board, a shared-project example, and cards ready to explore.
            </p>
          </button>
          <button
            className="group rounded-lg border border-[#e8e8e6] bg-white p-5 text-left transition hover:border-[#ff005e] hover:bg-[#fff7fa] focus:outline-none focus:ring-2 focus:ring-[#ff005e]"
            type="button"
            onClick={() => onChoose("blank")}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#edf8f1] text-[#25a565]">
              <Plus size={20} aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-lg font-semibold">Start with a blank board</h2>
            <p className="mt-2 text-sm leading-6 text-[#62605b]">
              One clean personal board with your own columns and first card.
            </p>
          </button>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  tone: "crimson" | "green" | "amber" | "ink";
  value: string;
}) {
  const tones = {
    crimson: "bg-[var(--accent-soft)] text-[var(--accent)]",
    green: "bg-[var(--green-soft)] text-[var(--green)]",
    amber: "bg-[var(--amber-soft)] text-[var(--amber)]",
    ink: "bg-[var(--surface-hover)] text-[var(--foreground)]",
  };

  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <div className={`rounded-md p-2 ${tones[tone]}`}>
          <Icon size={20} aria-hidden="true" />
        </div>
        <p className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</p>
      </div>
      <div className="mt-6 text-3xl font-semibold">{value}</div>
    </article>
  );
}

function SettingsView({
  activeProject,
  createProject,
  onEditProject,
  onFocusMinutesChange,
  onPreviewSound,
  profilePlan,
  settings,
  setSettings,
  teamProjectCount,
  timerLocked,
}: {
  activeProject?: Project;
  createProject: (kind: ProjectKind) => void;
  onEditProject: (projectId?: string) => void;
  onFocusMinutesChange: (minutes: number) => void;
  onPreviewSound: (sound: FocusSound) => void;
  profilePlan: PlanTier;
  settings: UserSettings;
  setSettings: (settings: UserSettings) => void;
  teamProjectCount: number;
  timerLocked: boolean;
}) {
  function toggleDay(day: string) {
    const workingDays = settings.workingDays.includes(day)
      ? settings.workingDays.filter((item) => item !== day)
      : [...settings.workingDays, day];

    setSettings({ ...settings, workingDays });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-6">
        <Panel title="Personal Timer Routine" icon={Clock3}>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              disabled={timerLocked}
              label="Focus"
              max={90}
              min={5}
              value={settings.focusMinutes}
              onChange={onFocusMinutesChange}
            />
            <NumberField
              label="Break"
              max={30}
              min={3}
              value={settings.breakMinutes}
              onChange={(breakMinutes) => setSettings({ ...settings, breakMinutes })}
            />
            <NumberField
              label="Daily Goal"
              max={16}
              min={1}
              value={settings.dailyPomodoroGoal}
              onChange={(dailyPomodoroGoal) =>
                setSettings({ ...settings, dailyPomodoroGoal })
              }
            />
          </div>
        </Panel>

        <Panel title="Timer Experience" icon={Volume2}>
          <div className="space-y-5">
            <ToggleField
              checked={settings.soundEnabled}
              description="Play a quiet working sound while the timer is running."
              label="Focus sound"
              onChange={(soundEnabled) =>
                setSettings({ ...settings, soundEnabled })
              }
            />

            <div>
              <label
                className="text-sm font-semibold text-[var(--muted)]"
                htmlFor="focus-sound-select"
              >
                Working sound
              </label>
              <div className="mt-2 flex gap-2">
                <select
                  id="focus-sound-select"
                  className="h-11 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm outline-none transition focus:border-[var(--accent)]"
                  value={settings.focusSound}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      focusSound: event.target.value as FocusSound,
                    })
                  }
                >
                  {focusSoundOptions.map((sound) => (
                    <option key={sound} value={sound}>
                      {focusSoundLabels[sound]}
                    </option>
                  ))}
                </select>
                <button
                  className="flex h-11 shrink-0 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--muted)] transition enabled:hover:border-[var(--accent)] enabled:hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={timerLocked}
                  type="button"
                  onClick={() => onPreviewSound(settings.focusSound)}
                >
                  <Volume2 size={16} aria-hidden="true" />
                  Preview
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#62605b]">
                {focusSoundDescriptions[settings.focusSound]} Sound stays in your browser and only plays while a Pomodoro is running.
              </p>
            </div>

            <label className="block">
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[var(--muted)]">
                  Volume
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[var(--muted)] tabular-nums">
                  {settings.focusVolume === 0 ? (
                    <VolumeX size={14} aria-hidden="true" />
                  ) : (
                    <Volume2 size={14} aria-hidden="true" />
                  )}
                  {settings.focusVolume}%
                </span>
              </span>
              <input
                aria-label="Focus sound volume"
                className="mt-3 h-2 w-full cursor-pointer accent-[var(--accent)]"
                max={100}
                min={0}
                step={5}
                type="range"
                value={settings.focusVolume}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    focusVolume: normalizeVolume(Number(event.target.value)),
                  })
                }
              />
            </label>

            <ToggleField
              checked={settings.showNextUp}
              description="Show the next-task panel on the timer screen."
              label="Next Up panel"
              onChange={(showNextUp) =>
                setSettings({ ...settings, showNextUp })
              }
            />
          </div>
        </Panel>

        <Panel title="Appearance" icon={Moon}>
          <ToggleField
            checked={settings.themeMode === "dark"}
            description="Use a lower-glare workspace theme."
            label="Dark mode"
            onChange={(enabled) =>
              setSettings({ ...settings, themeMode: enabled ? "dark" : "light" })
            }
          />
        </Panel>

        <Panel title="Working Days" icon={CalendarDays}>
          <div className="flex flex-wrap gap-2">
            {weekdays.map((day) => {
              const active = settings.workingDays.includes(day);

              return (
                <button
                  key={day}
                  aria-label={weekdayLabels[day] ?? day}
                  aria-pressed={active}
                  title={weekdayLabels[day] ?? day}
                  className={`h-11 w-12 rounded-md border text-sm font-semibold transition ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)]"
                  }`}
                  type="button"
                  onClick={() => toggleDay(day)}
                >
                  {day.slice(0, 1)}
                </button>
              );
            })}
          </div>
        </Panel>

      </section>

      <aside className="space-y-6">
        <Panel title="Plan" icon={Sparkles}>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-semibold">{planLabels[profilePlan]}</p>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-[var(--muted)]">Admin shared projects</span>
              <span className="font-semibold">
                {profilePlan === "free" ? `${teamProjectCount}/1` : teamProjectCount}
              </span>
            </div>
            <button
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 text-sm font-semibold text-white transition enabled:hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-45"
              type="button"
              disabled={profilePlan === "free" && teamProjectCount >= 1}
              onClick={() => createProject("team")}
            >
              <Users size={17} aria-hidden="true" />
              Create Shared Project
            </button>
          </div>
        </Panel>

        <Panel title="Current Project" icon={FolderKanban}>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Name</span>
              <span className="font-semibold">{activeProject?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Type</span>
              <span className="font-semibold capitalize">{activeProject?.kind}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Members</span>
              <span className="font-semibold">
                {activeProject ? getProjectMemberCount(activeProject) : 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Access</span>
              <span className="font-semibold">
                {activeProject?.currentUserRole
                  ? projectRoleLabels[activeProject.currentUserRole]
                  : "-"}
              </span>
            </div>
            {activeProject?.currentUserRole === "owner" ? (
              <button
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                type="button"
                onClick={() => onEditProject(activeProject.id)}
              >
                <Pencil size={16} aria-hidden="true" />
                Edit project
              </button>
            ) : null}
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function Panel({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: typeof Clock3;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-5 flex items-center gap-2">
        <Icon className="text-[var(--muted)]" size={20} aria-hidden="true" />
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function NumberField({
  disabled = false,
  label,
  max,
  min,
  onChange,
  value,
}: {
  disabled?: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[var(--muted)]">{label}</span>
      <input
        className="mt-2 h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm outline-none transition focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-55"
        disabled={disabled}
        max={max}
        min={min}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ToggleField({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <div>
        <span className="font-semibold">{label}</span>
        <span className="mt-1 block text-sm text-[var(--muted)]">{description}</span>
      </div>
      <button
        aria-label={label}
        aria-pressed={checked}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"
        }`}
        type="button"
        onClick={() => onChange(!checked)}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-[var(--surface)] transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </label>
  );
}
