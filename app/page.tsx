"use client";

import {
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  CirclePlay,
  Clock3,
  FolderKanban,
  Gauge,
  LogIn,
  Menu,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  SkipForward,
  Sparkles,
  TimerReset,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type View = "board" | "timer" | "analytics" | "settings";
type ProjectKind = "personal" | "team";
type TaskStatus = "todo" | "active" | "done";
type Priority = "low" | "medium" | "high";

type Project = {
  id: string;
  name: string;
  kind: ProjectKind;
  color: string;
  dailyGoal: number;
  members: number;
};

type Task = {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  estimate: number;
  spent: number;
  priority: Priority;
  tags: string[];
  note: string;
  due: string;
};

type FocusSession = {
  id: string;
  projectId: string;
  taskId: string | null;
  minutes: number;
  completedAt: string;
  note: string;
};

type UserSettings = {
  focusMinutes: number;
  breakMinutes: number;
  dailyPomodoroGoal: number;
  workingDays: string[];
  strictMode: boolean;
};

type StoredState = {
  projects: Project[];
  tasks: Task[];
  sessions: FocusSession[];
  settings: UserSettings;
  activeProjectId: string;
  selectedTaskId: string;
};

const STORAGE_KEY = "flowtimer.mvp.v1";

const initialProjects: Project[] = [
  {
    id: "project-deep-work",
    name: "Deep Work",
    kind: "personal",
    color: "#ff005e",
    dailyGoal: 6,
    members: 1,
  },
  {
    id: "project-launch",
    name: "Launch Crew",
    kind: "team",
    color: "#25a565",
    dailyGoal: 5,
    members: 2,
  },
];

const initialTasks: Task[] = [
  {
    id: "task-positioning",
    projectId: "project-deep-work",
    title: "Draft product positioning notes",
    status: "todo",
    estimate: 50,
    spent: 10,
    priority: "high",
    tags: ["writing", "strategy"],
    note: "Clarify the promise for casual focus users.",
    due: "Today",
  },
  {
    id: "task-wireframes",
    projectId: "project-deep-work",
    title: "Review timer and board wireframes",
    status: "active",
    estimate: 75,
    spent: 35,
    priority: "medium",
    tags: ["design"],
    note: "Keep the first screen product-first.",
    due: "Tomorrow",
  },
  {
    id: "task-supabase",
    projectId: "project-deep-work",
    title: "Map Supabase tables and RLS policies",
    status: "todo",
    estimate: 50,
    spent: 0,
    priority: "medium",
    tags: ["backend"],
    note: "Personal projects now, shared project path later.",
    due: "Fri",
  },
  {
    id: "task-report",
    projectId: "project-deep-work",
    title: "Summarize the week of focus sessions",
    status: "done",
    estimate: 25,
    spent: 25,
    priority: "low",
    tags: ["review"],
    note: "Daily review is more useful than vanity stats.",
    due: "Done",
  },
  {
    id: "task-shared-plan",
    projectId: "project-launch",
    title: "Plan the shared launch checklist",
    status: "active",
    estimate: 50,
    spent: 20,
    priority: "high",
    tags: ["shared", "launch"],
    note: "One team project is included on the free plan.",
    due: "Today",
  },
  {
    id: "task-invite-copy",
    projectId: "project-launch",
    title: "Write invite copy for collaborators",
    status: "todo",
    estimate: 25,
    spent: 0,
    priority: "medium",
    tags: ["copy"],
    note: "Keep collaboration language light and personal.",
    due: "Thu",
  },
];

const initialSessions: FocusSession[] = [
  {
    id: "session-1",
    projectId: "project-deep-work",
    taskId: "task-wireframes",
    minutes: 25,
    completedAt: new Date().toISOString(),
    note: "Refined the timer layout.",
  },
  {
    id: "session-2",
    projectId: "project-deep-work",
    taskId: "task-positioning",
    minutes: 25,
    completedAt: new Date(Date.now() - 86400000).toISOString(),
    note: "Tightened product story.",
  },
  {
    id: "session-3",
    projectId: "project-launch",
    taskId: "task-shared-plan",
    minutes: 50,
    completedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    note: "Built the shared launch outline.",
  },
  {
    id: "session-4",
    projectId: "project-deep-work",
    taskId: "task-report",
    minutes: 25,
    completedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    note: "Closed out report draft.",
  },
];

const initialSettings: UserSettings = {
  focusMinutes: 25,
  breakMinutes: 5,
  dailyPomodoroGoal: 6,
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  strictMode: false,
};

const columns: Array<{ id: TaskStatus; title: string }> = [
  { id: "todo", title: "To Do" },
  { id: "active", title: "In Focus" },
  { id: "done", title: "Done" },
];

const navItems: Array<{ id: View; label: string; icon: typeof FolderKanban }> = [
  { id: "board", label: "Board", icon: FolderKanban },
  { id: "timer", label: "Focus Timer", icon: Clock3 },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder
    .toString()
    .padStart(2, "0")}`;
}

function formatHours(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function isToday(date: string) {
  const value = new Date(date);
  const today = new Date();
  return value.toDateString() === today.toDateString();
}

function priorityClass(priority: Priority) {
  if (priority === "high") {
    return "bg-[#fff0f5] text-[#b90042] border-[#ffd3df]";
  }

  if (priority === "medium") {
    return "bg-[#fff7e8] text-[#8a5a00] border-[#ffe0a3]";
  }

  return "bg-[#edf8f1] text-[#256b43] border-[#c9ecd6]";
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

export default function Home() {
  const [view, setView] = useState<View>("board");
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [sessions, setSessions] = useState<FocusSession[]>(initialSessions);
  const [settings, setSettings] = useState<UserSettings>(initialSettings);
  const [activeProjectId, setActiveProjectId] = useState(initialProjects[0].id);
  const [selectedTaskId, setSelectedTaskId] = useState("task-wireframes");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [sessionNote, setSessionNote] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    initialSettings.focusMinutes * 60,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY);

      if (stored) {
        try {
          const parsed = JSON.parse(stored) as StoredState;
          setProjects(parsed.projects ?? initialProjects);
          setTasks(parsed.tasks ?? initialTasks);
          setSessions(parsed.sessions ?? initialSessions);
          setSettings(parsed.settings ?? initialSettings);
          setActiveProjectId(parsed.activeProjectId ?? initialProjects[0].id);
          setSelectedTaskId(parsed.selectedTaskId ?? "task-wireframes");
          setRemainingSeconds(
            (parsed.settings?.focusMinutes ?? initialSettings.focusMinutes) * 60,
          );
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }

      setHydrated(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const state: StoredState = {
      projects,
      tasks,
      sessions,
      settings,
      activeProjectId,
      selectedTaskId,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [
    activeProjectId,
    hydrated,
    projects,
    selectedTaskId,
    sessions,
    settings,
    tasks,
  ]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId),
    [activeProjectId, projects],
  );

  const projectTasks = useMemo(
    () => tasks.filter((task) => task.projectId === activeProjectId),
    [activeProjectId, tasks],
  );

  const selectedTask = useMemo(
    () =>
      tasks.find((task) => task.id === selectedTaskId) ??
      projectTasks.find((task) => task.status !== "done") ??
      projectTasks[0],
    [projectTasks, selectedTaskId, tasks],
  );

  const teamProjectCount = projects.filter(
    (project) => project.kind === "team",
  ).length;

  const todaysProjectSessions = sessions.filter(
    (session) => session.projectId === activeProjectId && isToday(session.completedAt),
  );

  const todaysMinutes = todaysProjectSessions.reduce(
    (total, session) => total + session.minutes,
    0,
  );

  const completedCount = projectTasks.filter(
    (task) => task.status === "done",
  ).length;

  const activeGoal = activeProject?.dailyGoal ?? settings.dailyPomodoroGoal;
  const todaysPomodoros = Math.round(todaysMinutes / settings.focusMinutes);
  const progressPercent = Math.min(100, (todaysPomodoros / activeGoal) * 100);
  const totalMinutes = sessions.reduce((total, session) => total + session.minutes, 0);
  const projectMinutes = sessions
    .filter((session) => session.projectId === activeProjectId)
    .reduce((total, session) => total + session.minutes, 0);

  const completeFocusSession = useCallback(
    (minutes: number, note: string) => {
      const completedTask = selectedTask ?? null;
      const session: FocusSession = {
        id: createId("session"),
        projectId: activeProjectId,
        taskId: completedTask?.id ?? null,
        minutes,
        completedAt: new Date().toISOString(),
        note: note.trim() || "Focused session completed.",
      };

      setSessions((current) => [session, ...current]);

      if (completedTask) {
        setTasks((current) =>
          current.map((task) =>
            task.id === completedTask.id
              ? {
                  ...task,
                  spent: task.spent + minutes,
                  status: task.status === "todo" ? "active" : task.status,
                }
              : task,
          ),
        );
      }

      setSessionNote("");
      setIsRunning(false);
      setRemainingSeconds(settings.focusMinutes * 60);
    },
    [activeProjectId, selectedTask, settings.focusMinutes],
  );

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      setRemainingSeconds((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(interval);
          completeFocusSession(settings.focusMinutes, sessionNote);
          return settings.focusMinutes * 60;
        }

        return seconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [completeFocusSession, isRunning, sessionNote, settings.focusMinutes]);

  function addTask() {
    const title = newTaskTitle.trim();

    if (!title) {
      return;
    }

    const task: Task = {
      id: createId("task"),
      projectId: activeProjectId,
      title,
      status: "todo",
      estimate: settings.focusMinutes,
      spent: 0,
      priority: "medium",
      tags: ["new"],
      note: "",
      due: "Today",
    };

    setTasks((current) => [task, ...current]);
    setSelectedTaskId(task.id);
    setNewTaskTitle("");
  }

  function moveTask(taskId: string, status: TaskStatus) {
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, status } : task)),
    );

    if (status === "active") {
      setSelectedTaskId(taskId);
    }
  }

  function createProject(kind: ProjectKind) {
    if (kind === "team" && teamProjectCount >= 1) {
      return;
    }

    const project: Project = {
      id: createId("project"),
      name: kind === "team" ? "Shared Project" : "New Project",
      kind,
      color: kind === "team" ? "#25a565" : "#ff005e",
      dailyGoal: settings.dailyPomodoroGoal,
      members: kind === "team" ? 2 : 1,
    };

    setProjects((current) => [...current, project]);
    setActiveProjectId(project.id);
    setView("board");
  }

  function startTask(taskId: string) {
    setSelectedTaskId(taskId);
    moveTask(taskId, "active");
    setView("timer");
  }

  function skipSession() {
    const elapsedSeconds = settings.focusMinutes * 60 - remainingSeconds;
    const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    completeFocusSession(elapsedMinutes, sessionNote || "Short focus block.");
  }

  const timerProgress =
    ((settings.focusMinutes * 60 - remainingSeconds) /
      (settings.focusMinutes * 60)) *
    100;

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#1a1c1b]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[280px] shrink-0 border-r border-[#e8e8e6] bg-white lg:flex lg:flex-col">
          <div className="border-b border-[#e8e8e6] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ff005e] text-white">
                <TimerReset size={20} aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">FlowTimer</h1>
                <p className="text-xs text-[#6a6965]">Free plan</p>
              </div>
            </div>

            <button
              className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#ff005e] px-3 text-sm font-semibold text-white transition hover:bg-[#e00054]"
              type="button"
              onClick={addTask}
            >
              <Plus size={17} aria-hidden="true" />
              New Task
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between px-2 text-xs font-semibold uppercase text-[#6a6965]">
                <span>Projects</span>
                <button
                  aria-label="Create personal project"
                  title="Create personal project"
                  className="rounded p-1 text-[#6a6965] transition hover:bg-[#f0f0ee] hover:text-[#ff005e]"
                  type="button"
                  onClick={() => createProject("personal")}
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-1">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                      activeProjectId === project.id
                        ? "bg-[#f0f0ee] text-[#1a1c1b]"
                        : "text-[#62605b] hover:bg-[#f4f4f2]"
                    }`}
                    type="button"
                    onClick={() => setActiveProjectId(project.id)}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: project.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    {project.kind === "team" ? (
                      <Users size={15} aria-hidden="true" />
                    ) : null}
                  </button>
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
                        ? "border-[#ff005e] bg-[#f0f0ee] text-[#1a1c1b]"
                        : "border-transparent text-[#62605b] hover:bg-[#f4f4f2]"
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

          <div className="border-t border-[#e8e8e6] p-4">
            <div className="rounded-md border border-[#e8e8e6] bg-[#f9f9f7] p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Share2 size={16} aria-hidden="true" />
                1 shared project
              </div>
              <p className="mt-1 text-xs text-[#6a6965]">
                {teamProjectCount}/1 used on Free
              </p>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-[#e8e8e6] bg-white/90 px-4 py-3 backdrop-blur md:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  aria-label="Open menu"
                  title="Open menu"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[#e8e8e6] text-[#62605b] lg:hidden"
                  type="button"
                >
                  <Menu size={19} aria-hidden="true" />
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-[#6a6965]">
                    {activeProject?.kind === "team" ? "Shared Project" : "Personal Project"}
                  </p>
                  <h2 className="truncate text-2xl font-semibold">
                    {activeProject?.name ?? "FlowTimer"}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="hidden h-9 items-center gap-2 rounded-md border border-[#e8e8e6] bg-[#f9f9f7] px-3 text-sm text-[#6a6965] md:flex">
                  <Search size={16} aria-hidden="true" />
                  <input
                    className="w-44 bg-transparent outline-none placeholder:text-[#8b8984]"
                    placeholder="Search tasks"
                    type="search"
                  />
                </label>
                <button
                  aria-label="Notifications"
                  title="Notifications"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[#e8e8e6] bg-white text-[#62605b] transition hover:text-[#ff005e]"
                  type="button"
                >
                  <Bell size={17} aria-hidden="true" />
                </button>
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1a1c1b] text-sm font-semibold text-white">
                  C
                </div>
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
                        ? "bg-[#1a1c1b] text-white"
                        : "border border-[#e8e8e6] bg-white text-[#62605b]"
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
            {view === "board" ? (
              <BoardView
                addTask={addTask}
                columns={columns}
                newTaskTitle={newTaskTitle}
                onNewTaskTitleChange={setNewTaskTitle}
                onStartTask={startTask}
                onTaskStatusChange={moveTask}
                progressPercent={progressPercent}
                projectTasks={projectTasks}
                selectedTaskId={selectedTask?.id}
                todaysPomodoros={todaysPomodoros}
                activeGoal={activeGoal}
              />
            ) : null}

            {view === "timer" ? (
              <TimerView
                isRunning={isRunning}
                onComplete={skipSession}
                onReset={() => {
                  setIsRunning(false);
                  setRemainingSeconds(settings.focusMinutes * 60);
                }}
                onToggle={() => setIsRunning((running) => !running)}
                remainingSeconds={remainingSeconds}
                selectedTask={selectedTask}
                sessionNote={sessionNote}
                setSessionNote={setSessionNote}
                settings={settings}
                timerProgress={timerProgress}
              />
            ) : null}

            {view === "analytics" ? (
              <AnalyticsView
                completedCount={completedCount}
                projectMinutes={projectMinutes}
                projectTasks={projectTasks}
                sessions={sessions}
                todaysMinutes={todaysMinutes}
                totalMinutes={totalMinutes}
              />
            ) : null}

            {view === "settings" ? (
              <SettingsView
                activeProject={activeProject}
                createProject={createProject}
                settings={settings}
                setSettings={setSettings}
                teamProjectCount={teamProjectCount}
              />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function BoardView({
  addTask,
  activeGoal,
  columns,
  newTaskTitle,
  onNewTaskTitleChange,
  onStartTask,
  onTaskStatusChange,
  progressPercent,
  projectTasks,
  selectedTaskId,
  todaysPomodoros,
}: {
  addTask: () => void;
  activeGoal: number;
  columns: Array<{ id: TaskStatus; title: string }>;
  newTaskTitle: string;
  onNewTaskTitleChange: (value: string) => void;
  onStartTask: (taskId: string) => void;
  onTaskStatusChange: (taskId: string, status: TaskStatus) => void;
  progressPercent: number;
  projectTasks: Task[];
  selectedTaskId?: string;
  todaysPomodoros: number;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-lg border border-[#e8e8e6] bg-white p-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase text-[#6a6965]">
                Today
              </p>
              <h3 className="mt-1 text-2xl font-semibold">Sprint Board</h3>
            </div>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addTask();
              }}
            >
              <input
                className="h-10 min-w-0 rounded-md border border-[#e8e8e6] bg-[#f9f9f7] px-3 text-sm outline-none transition focus:border-[#ff005e]"
                placeholder="Add a task"
                value={newTaskTitle}
                onChange={(event) => onNewTaskTitleChange(event.target.value)}
              />
              <button
                aria-label="Add task"
                title="Add task"
                className="flex h-10 w-10 items-center justify-center rounded-md bg-[#ff005e] text-white transition hover:bg-[#e00054]"
                type="submit"
              >
                <Plus size={18} aria-hidden="true" />
              </button>
            </form>
          </div>
        </section>

        <section className="rounded-lg border border-[#e8e8e6] bg-[#1a1c1b] p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-[#c9c6c3]">
                Daily Focus
              </p>
              <p className="mt-1 text-xl font-semibold">
                {todaysPomodoros}/{activeGoal} sessions
              </p>
            </div>
            <Gauge className="text-[#67dd97]" size={28} aria-hidden="true" />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#353534]">
            <div
              className="h-full rounded-full bg-[#ff4f74]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {columns.map((column) => {
          const columnTasks = projectTasks.filter(
            (task) => task.status === column.id,
          );

          return (
            <section
              key={column.id}
              className="min-h-[460px] rounded-lg border border-[#e8e8e6] bg-[#f4f4f2] p-3"
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  {column.title}
                  <span className="rounded bg-white px-2 py-1 text-xs text-[#6a6965]">
                    {columnTasks.length}
                  </span>
                </h3>
                <button
                  aria-label={`Add task to ${column.title}`}
                  title={`Add task to ${column.title}`}
                  className="rounded p-1 text-[#6a6965] transition hover:bg-white hover:text-[#ff005e]"
                  type="button"
                >
                  <Plus size={17} aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-3">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    isSelected={selectedTaskId === task.id}
                    onStartTask={onStartTask}
                    onTaskStatusChange={onTaskStatusChange}
                    task={task}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({
  isSelected,
  onStartTask,
  onTaskStatusChange,
  task,
}: {
  isSelected: boolean;
  onStartTask: (taskId: string) => void;
  onTaskStatusChange: (taskId: string, status: TaskStatus) => void;
  task: Task;
}) {
  const progress = Math.min(100, (task.spent / task.estimate) * 100);

  return (
    <article
      className={`rounded-lg border bg-white p-4 transition ${
        isSelected ? "border-[#ff005e]" : "border-[#e8e8e6] hover:border-[#d4d3cf]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold leading-5">{task.title}</h4>
        <span
          className={`shrink-0 rounded border px-2 py-1 text-xs ${priorityClass(
            task.priority,
          )}`}
        >
          {task.priority}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {task.tags.map((tag) => (
          <span
            key={tag}
            className="rounded bg-[#f0f0ee] px-2 py-1 text-xs text-[#62605b]"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-[#62605b]">
          <span className="flex items-center gap-1">
            <Clock3 size={14} aria-hidden="true" />
            {task.spent}/{task.estimate}m
          </span>
          <span className="flex items-center gap-1">
            <CalendarDays size={14} aria-hidden="true" />
            {task.due}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#e8e8e6]">
          <div
            className="h-full rounded-full bg-[#ff005e]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {columns.map((column) => (
            <button
              key={column.id}
              aria-label={`Move to ${column.title}`}
              title={`Move to ${column.title}`}
              className={`flex h-8 w-8 items-center justify-center rounded-md border text-xs transition ${
                task.status === column.id
                  ? "border-[#1a1c1b] bg-[#1a1c1b] text-white"
                  : "border-[#e8e8e6] bg-white text-[#62605b] hover:border-[#ff005e] hover:text-[#ff005e]"
              }`}
              type="button"
              onClick={() => onTaskStatusChange(task.id, column.id)}
            >
              {column.id === "todo" ? (
                <ChevronRight size={15} aria-hidden="true" />
              ) : null}
              {column.id === "active" ? (
                <CirclePlay size={15} aria-hidden="true" />
              ) : null}
              {column.id === "done" ? <Check size={15} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
        <button
          className="flex h-8 items-center gap-1 rounded-md bg-[#ff005e] px-3 text-xs font-semibold text-white transition hover:bg-[#e00054]"
          type="button"
          onClick={() => onStartTask(task.id)}
        >
          <Play size={14} aria-hidden="true" />
          Focus
        </button>
      </div>
    </article>
  );
}

function TimerView({
  isRunning,
  onComplete,
  onReset,
  onToggle,
  remainingSeconds,
  selectedTask,
  sessionNote,
  setSessionNote,
  settings,
  timerProgress,
}: {
  isRunning: boolean;
  onComplete: () => void;
  onReset: () => void;
  onToggle: () => void;
  remainingSeconds: number;
  selectedTask?: Task;
  sessionNote: string;
  setSessionNote: (value: string) => void;
  settings: UserSettings;
  timerProgress: number;
}) {
  const circumference = 2 * Math.PI * 45;
  const dashOffset = circumference - (timerProgress / 100) * circumference;

  return (
    <div className="grid min-h-[640px] gap-6 rounded-lg border border-[#242424] bg-[#131313] p-4 text-[#e5e2e1] md:p-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="flex min-h-[520px] flex-col items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase text-[#ffb2bb]">Deep Work</p>
          <h3 className="mt-2 text-3xl font-semibold">{selectedTask?.title ?? "Focus Session"}</h3>
        </div>

        <div className="relative mt-10 flex h-72 w-72 items-center justify-center sm:h-96 sm:w-96">
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
              stroke="#353534"
              strokeWidth="2"
            />
            <circle
              cx="50"
              cy="50"
              fill="none"
              r="45"
              stroke="#ff4f74"
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
            <div className="mt-4 inline-flex rounded-full border border-[#353534] bg-[#201f1f] px-4 py-2 text-sm font-semibold text-[#ffb2bb]">
              {settings.focusMinutes} min focus
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-4">
          <button
            aria-label="Reset timer"
            title="Reset timer"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[#353534] bg-[#201f1f] text-[#c8c6c5] transition hover:bg-[#2a2a2a]"
            type="button"
            onClick={onReset}
          >
            <RefreshCcw size={20} aria-hidden="true" />
          </button>
          <button
            aria-label={isRunning ? "Pause timer" : "Start timer"}
            title={isRunning ? "Pause timer" : "Start timer"}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-[#ff4f74] text-[#5a001c] shadow-[0_0_40px_rgba(255,79,116,0.24)] transition hover:bg-[#ff6c89]"
            type="button"
            onClick={onToggle}
          >
            {isRunning ? (
              <Pause size={34} fill="currentColor" aria-hidden="true" />
            ) : (
              <Play size={34} fill="currentColor" aria-hidden="true" />
            )}
          </button>
          <button
            aria-label="Complete current block"
            title="Complete current block"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[#353534] bg-[#201f1f] text-[#c8c6c5] transition hover:bg-[#2a2a2a]"
            type="button"
            onClick={onComplete}
          >
            <SkipForward size={20} aria-hidden="true" />
          </button>
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <section className="rounded-lg border border-[#353534] bg-[#1c1b1b] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#c8c6c5]">
            <Sparkles size={17} aria-hidden="true" />
            Session Notes
          </div>
          <textarea
            className="mt-4 h-48 w-full resize-none rounded-md border border-[#353534] bg-[#131313] p-3 text-sm text-[#e5e2e1] outline-none transition placeholder:text-[#77736f] focus:border-[#ff4f74]"
            placeholder="Capture useful notes"
            value={sessionNote}
            onChange={(event) => setSessionNote(event.target.value)}
          />
        </section>

        <section className="rounded-lg border border-[#353534] bg-[#1c1b1b] p-4">
          <p className="text-xs font-semibold uppercase text-[#ffb2bb]">Next Up</p>
          <h4 className="mt-2 text-lg font-semibold">
            {selectedTask?.title ?? "Pick a task from the board"}
          </h4>
          <p className="mt-2 text-sm text-[#c8c6c5]">
            {selectedTask
              ? `${selectedTask.estimate - selectedTask.spent} min remaining`
              : "No active task selected"}
          </p>
        </section>

        <section className="rounded-lg border border-[#353534] bg-[#1c1b1b] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#c8c6c5]">Break</span>
            <span className="font-semibold text-[#67dd97]">
              {settings.breakMinutes} min
            </span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-[#353534]">
            <div className="h-full w-1/2 rounded-full bg-[#67dd97]" />
          </div>
        </section>
      </aside>
    </div>
  );
}

function AnalyticsView({
  completedCount,
  projectMinutes,
  projectTasks,
  sessions,
  todaysMinutes,
  totalMinutes,
}: {
  completedCount: number;
  projectMinutes: number;
  projectTasks: Task[];
  sessions: FocusSession[];
  todaysMinutes: number;
  totalMinutes: number;
}) {
  const completionRate = projectTasks.length
    ? Math.round((completedCount / projectTasks.length) * 100)
    : 0;
  const referenceTime = sessions.length
    ? Math.max(
        ...sessions.map((session) => new Date(session.completedAt).getTime()),
      )
    : new Date(initialSessions[0].completedAt).getTime();
  const lastSeven = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(referenceTime - 86400000 * (6 - index));
    const minutes = sessions
      .filter((session) => new Date(session.completedAt).toDateString() === day.toDateString())
      .reduce((total, session) => total + session.minutes, 0);

    return {
      label: day.toLocaleDateString("en", { weekday: "short" }),
      minutes,
    };
  });
  const maxDay = Math.max(25, ...lastSeven.map((day) => day.minutes));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Clock3}
          label="Today"
          tone="crimson"
          value={formatHours(todaysMinutes)}
        />
        <MetricCard
          icon={BarChart3}
          label="Project Total"
          tone="green"
          value={formatHours(projectMinutes)}
        />
        <MetricCard
          icon={Check}
          label="Task Completion"
          tone="amber"
          value={`${completionRate}%`}
        />
        <MetricCard
          icon={ShieldCheck}
          label="All-Time Focus"
          tone="ink"
          value={formatHours(totalMinutes)}
        />
      </section>

      <section className="rounded-lg border border-[#e8e8e6] bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-[#6a6965]">
              Weekly Rhythm
            </p>
            <h3 className="mt-1 text-xl font-semibold">Focus minutes</h3>
          </div>
          <BarChart3 className="text-[#ff005e]" size={24} aria-hidden="true" />
        </div>

        <div className="mt-6 grid h-64 grid-cols-7 items-end gap-3">
          {lastSeven.map((day) => (
            <div key={day.label} className="flex h-full flex-col justify-end gap-2">
              <div className="flex flex-1 items-end">
                <div
                  className="w-full rounded-md bg-[#ff005e]"
                  style={{
                    height: `${Math.max(8, (day.minutes / maxDay) * 100)}%`,
                    opacity: day.minutes ? 1 : 0.16,
                  }}
                />
              </div>
              <div className="text-center text-xs text-[#6a6965]">{day.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#e8e8e6] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold">Recent Sessions</h3>
          <Clock3 className="text-[#62605b]" size={20} aria-hidden="true" />
        </div>
        <div className="divide-y divide-[#e8e8e6]">
          {sessions.slice(0, 5).map((session) => (
            <div
              key={session.id}
              className="grid gap-2 py-3 text-sm sm:grid-cols-[120px_1fr_90px]"
            >
              <span className="text-[#6a6965]">
                {new Date(session.completedAt).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span>{session.note}</span>
              <span className="font-semibold text-[#ff005e]">
                {session.minutes} min
              </span>
            </div>
          ))}
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
    crimson: "bg-[#fff0f5] text-[#ff005e]",
    green: "bg-[#edf8f1] text-[#25a565]",
    amber: "bg-[#fff7e8] text-[#b77900]",
    ink: "bg-[#f0f0ee] text-[#1a1c1b]",
  };

  return (
    <article className="rounded-lg border border-[#e8e8e6] bg-white p-5">
      <div className="flex items-center justify-between">
        <div className={`rounded-md p-2 ${tones[tone]}`}>
          <Icon size={20} aria-hidden="true" />
        </div>
        <p className="text-xs font-semibold uppercase text-[#6a6965]">{label}</p>
      </div>
      <div className="mt-6 text-3xl font-semibold">{value}</div>
    </article>
  );
}

function SettingsView({
  activeProject,
  createProject,
  settings,
  setSettings,
  teamProjectCount,
}: {
  activeProject?: Project;
  createProject: (kind: ProjectKind) => void;
  settings: UserSettings;
  setSettings: (settings: UserSettings) => void;
  teamProjectCount: number;
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
        <Panel title="Timer Routine" icon={Clock3}>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              label="Focus"
              max={90}
              min={10}
              value={settings.focusMinutes}
              onChange={(focusMinutes) => setSettings({ ...settings, focusMinutes })}
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

        <Panel title="Working Days" icon={CalendarDays}>
          <div className="flex flex-wrap gap-2">
            {weekdays.map((day) => {
              const active = settings.workingDays.includes(day);

              return (
                <button
                  key={day}
                  className={`h-11 w-12 rounded-md border text-sm font-semibold transition ${
                    active
                      ? "border-[#ff005e] bg-[#ff005e] text-white"
                      : "border-[#e8e8e6] bg-white text-[#62605b] hover:border-[#ff005e]"
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

        <Panel title="Focus Guard" icon={ShieldCheck}>
          <label className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Strict Mode</p>
              <p className="mt-1 text-sm text-[#62605b]">
                Keep distracting actions quiet during focus blocks.
              </p>
            </div>
            <button
              aria-pressed={settings.strictMode}
              className={`relative h-7 w-12 rounded-full transition ${
                settings.strictMode ? "bg-[#ff005e]" : "bg-[#d8d7d3]"
              }`}
              type="button"
              onClick={() =>
                setSettings({ ...settings, strictMode: !settings.strictMode })
              }
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                  settings.strictMode ? "left-6" : "left-1"
                }`}
              />
            </button>
          </label>
        </Panel>
      </section>

      <aside className="space-y-6">
        <Panel title="Plan" icon={Sparkles}>
          <div className="rounded-lg border border-[#e8e8e6] bg-[#f9f9f7] p-4">
            <p className="text-sm font-semibold">Free</p>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-[#62605b]">Shared projects</span>
              <span className="font-semibold">{teamProjectCount}/1</span>
            </div>
            <button
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#1a1c1b] px-3 text-sm font-semibold text-white transition enabled:hover:bg-[#303230] disabled:cursor-not-allowed disabled:opacity-45"
              type="button"
              disabled={teamProjectCount >= 1}
              onClick={() => createProject("team")}
            >
              <Users size={17} aria-hidden="true" />
              Create Shared Project
            </button>
          </div>
        </Panel>

        <Panel title="Account" icon={LogIn}>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-md border border-[#e8e8e6] p-3">
              <span className="text-[#62605b]">Google sign-in</span>
              <span className="font-semibold text-[#b77900]">Planned</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[#e8e8e6] p-3">
              <span className="text-[#62605b]">Supabase backend</span>
              <span className="font-semibold text-[#25a565]">Ready</span>
            </div>
          </div>
        </Panel>

        <Panel title="Current Project" icon={FolderKanban}>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#62605b]">Name</span>
              <span className="font-semibold">{activeProject?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#62605b]">Type</span>
              <span className="font-semibold capitalize">{activeProject?.kind}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#62605b]">Members</span>
              <span className="font-semibold">{activeProject?.members}</span>
            </div>
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
    <section className="rounded-lg border border-[#e8e8e6] bg-white p-5">
      <div className="mb-5 flex items-center gap-2">
        <Icon className="text-[#62605b]" size={20} aria-hidden="true" />
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function NumberField({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#62605b]">{label}</span>
      <input
        className="mt-2 h-11 w-full rounded-md border border-[#e8e8e6] bg-[#f9f9f7] px-3 text-sm outline-none transition focus:border-[#ff005e]"
        max={max}
        min={min}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
