import React, { useEffect, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { listen } from "@tauri-apps/api/event";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import {
  Home,
  Layers3,
  Settings2,
  Code2,
  ArrowUpRight,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  Check,
  Download,
  Activity,
  Box,
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  ExternalLink,
  History,
  Cloud,
  LogOut,
  X,
  Palette,
  SlidersHorizontal,
  Radio,
  Upload,
  FileArchive,
  LockKeyhole,
  AlertCircle,
  CheckCircle2,
  Trash2,
  GitBranch,
  Loader2,
  Sparkles,
} from "lucide-react";
import type {
  Settings,
  AppInfo,
  UpdateStatus,
  Feature,
  Deployment,
  Release,
} from "./core/types";
import { call, api, desktop } from "./core/bridge";
import "./ui/theme.css";
const modules = Object.values(
  import.meta.glob<{ default: Feature }>("./features/**/index.tsx", {
    eager: true,
  }),
).map((m) => m.default);
if (
  new Set(modules.map((m) => m.id)).size !== modules.length ||
  modules.some(
    (m) =>
      !/^[a-z][a-z0-9-]+$/.test(m.id) ||
      ["home", "settings", "development"].includes(m.id),
  )
)
  throw new Error("Invalid feature registration");
const icons = {
  home: Home,
  workspace: Layers3,
  settings: Settings2,
  development: Code2,
};
function App() {
  const [settings, setSettings] = useState<Settings>(),
    [info, setInfo] = useState<AppInfo>(),
    [status, setStatus] = useState<UpdateStatus>({
      phase: "idle",
      message: "Starting Nimbus…",
      progress: 0,
      notes: "",
    }),
    [page, setPage] = useState("home"),
    [notice, setNotice] = useState(""),
    [admin, setAdmin] = useState(false),
    [history, setHistory] = useState<any[] | null>(null);
  const notify = useCallback((m: string) => setNotice(m), []);
  useEffect(() => {
    Promise.all([
      call<Settings>("get_settings"),
      call<AppInfo>("app_info"),
      call<UpdateStatus>("update_status"),
    ])
      .then(([s, i, u]) => {
        setSettings(s);
        setInfo(i);
        setStatus(u);
        setPage(s.startupPage);
        if (i.settingsError) notify(i.settingsError);
      })
      .catch((e) => notify(String(e)));
    if (desktop)
      api("/me")
        .then(() => setAdmin(true))
        .catch(() => {});
  }, []);
  useEffect(() => {
    if (!desktop) return;
    const off = listen<UpdateStatus>("update-status", (e) =>
      setStatus(e.payload),
    );
    return () => {
      off.then((f) => f());
    };
  }, []);
  useEffect(() => {
    if (!settings) return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        settings.appearance === "system"
          ? query.matches
            ? "dark"
            : "light"
          : settings.appearance;
      document.documentElement.style.setProperty("--accent", settings.accent);
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [settings]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 9000);
    return () => clearTimeout(t);
  }, [notice]);
  const save = async (patch: Partial<Settings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    try {
      await call("save_settings", { value: next });
      setSettings(next);
    } catch (e) {
      notify(String(e));
    }
  };
  const action = async (command: string) => {
    try {
      await call(command);
    } catch (e) {
      notify(String(e));
    }
  };
  if (!settings || !info)
    return (
      <div className="launch">
        <div className="brand-mark">n</div>
        <Loader2 className="spin" />
        <p>{notice || "Preparing your workspace"}</p>
      </div>
    );
  const feature = modules.find((m) => m.id === page),
    Component = feature?.component;
  const nav = [
    { id: "home", title: "Home" },
    ...modules.map((m) => ({ id: m.id, title: m.title })),
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">n</div>
          <span>
            nimbus<span className="brand-dot">.</span>
          </span>
        </div>
        <div className="space-label">PERSONAL WORKSPACE</div>
        <nav>
          {nav.map((item) => {
            const Icon = icons[item.id as keyof typeof icons] || Box;
            return (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                onClick={() => setPage(item.id)}
              >
                <Icon size={19} />
                {item.title}
                {page === item.id && <span className="active-dot" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-card">
            <div className="small-icon">
              <Sparkles size={18} />
            </div>
            <strong>Built to keep growing.</strong>
            <p>
              One foundation.
              <br />
              Endless possibilities.
            </p>
            <span>
              THE NIMBUS FOUNDATION <ArrowUpRight size={13} />
            </span>
          </div>
          <button
            className={`nav-item ${page === "settings" ? "active" : ""}`}
            onClick={() => setPage("settings")}
          >
            <Settings2 size={19} />
            Settings
          </button>
          {admin && (
            <button
              className={`nav-item ${page === "development" ? "active" : ""}`}
              onClick={() => setPage("development")}
            >
              <Code2 size={19} />
              Development & Updates
            </button>
          )}
          <div className="sidebar-version">
            <span className="status-dot" />
            Nimbus {info.version}
            <span>{settings.channel}</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header>
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>
              {page === "home"
                ? "Overview"
                : page === "settings"
                  ? "Settings"
                  : page === "development"
                    ? "Development & Updates"
                    : feature?.title}
            </strong>
          </div>
          <div className="header-right">
            <span className="tiny-dot" />
            {info.serviceConfigured
              ? "Connected to Nimbus"
              : "Local foundation"}
            <span className="avatar">N</span>
          </div>
        </header>
        <main key={page}>
          {page === "home" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    A LITTLE SPACE. A LOT OF POSSIBILITY.
                  </span>
                  <h1>
                    Welcome to Nimbus<span className="accent">.</span>
                  </h1>
                  <p>Your workspace, continuously evolving.</p>
                </div>
                <div className="date-chip">
                  {new Date().toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
              <section className="hero panel">
                <div className="hero-copy">
                  <div className="pill">
                    <span className="status-dot" /> THE FOUNDATION RELEASE
                  </div>
                  <h2>
                    A fresh start.
                    <br />
                    <span>Room to build anything.</span>
                  </h2>
                  <p>
                    A focused home for your tools, ideas, and whatever comes
                    next.
                    <br />
                    Always connected. Always moving forward.
                  </p>
                  <button
                    className="primary"
                    onClick={() => setPage("workspace")}
                  >
                    Open your workspace <ArrowRight size={16} />
                  </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="art-orbit orbit-a" />
                  <div className="art-orbit orbit-b" />
                  <div className="art-orbit orbit-c" />
                  <div className="glass-block block-back" />
                  <div className="glass-block block-main">
                    <span>n</span>
                  </div>
                  <div className="art-star star-a">✦</div>
                  <div className="art-star star-b">✦</div>
                  <span className="art-label">DESIGNED TO EVOLVE</span>
                </div>
              </section>
              <div className="section-label">
                YOUR FOUNDATION <span>Everything in its place.</span>
              </div>
              <div className="stats-grid">
                <article className="panel stat">
                  <div className="stat-top">
                    <span className="icon-box">
                      <Box size={19} />
                    </span>
                    <span className="badge">Installed</span>
                  </div>
                  <span className="stat-caption">Application version</span>
                  <h3>
                    {info.version}
                    <span>{settings.channel}</span>
                  </h3>
                  <p>A stable starting point for what’s next.</p>
                </article>
                <article className="panel stat">
                  <div className="stat-top">
                    <span className="icon-box mint">
                      <ShieldCheck size={19} />
                    </span>
                    <span
                      className={`badge ${status.phase === "error" ? "warning" : ""}`}
                    >
                      {status.phase === "unconfigured"
                        ? "Setup needed"
                        : status.phase === "ready"
                          ? "Ready"
                          : "Signed updates"}
                    </span>
                  </div>
                  <span className="stat-caption">Update status</span>
                  <h3>
                    {status.phase === "current"
                      ? "Up to date"
                      : status.phase === "unconfigured"
                        ? "Not connected"
                        : status.phase === "downloading"
                          ? `${status.progress}%`
                          : "Ready to evolve"}
                  </h3>
                  <p>{status.message}</p>
                </article>
                <article className="panel stat">
                  <div className="stat-top">
                    <span className="icon-box peach">
                      <Layers3 size={19} />
                    </span>
                    <ArrowUpRight size={16} />
                  </div>
                  <span className="stat-caption">Your workspace</span>
                  <h3>
                    {modules.length}
                    <span>{modules.length === 1 ? "module" : "modules"}</span>
                  </h3>
                  <p>A modular foundation. More on the way.</p>
                </article>
              </div>
              <div className="lower-grid">
                <section className="panel quick">
                  <div className="panel-title">
                    <h3>Make yourself at home</h3>
                    <SlidersHorizontal size={18} />
                  </div>
                  <button
                    className="quick-row"
                    onClick={() => setPage("settings")}
                  >
                    <span className="icon-box">
                      <Palette size={18} />
                    </span>
                    <span>
                      <strong>A workspace that feels like you</strong>
                      <small>
                        Fine-tune appearance, accent, and preferences.
                      </small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                  <button
                    className="quick-row"
                    onClick={() => setPage("settings")}
                  >
                    <span className="icon-box mint">
                      <RefreshCw size={18} />
                    </span>
                    <span>
                      <strong>Stay a step ahead</strong>
                      <small>
                        Manage your update channel and installation.
                      </small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                </section>
                <section className="panel note-card">
                  <div className="panel-title">
                    <h3>Made for what’s next</h3>
                    <span className="badge">1.0</span>
                  </div>
                  <p>
                    This is just the beginning. Your tools, pages, and features
                    will grow through secure updates.
                  </p>
                  <div>
                    <span className="tiny-dot" /> Your settings come with you.
                  </div>
                </section>
              </div>
              <footer>
                <span className="status-dot" />
                YOUR SPACE. ALWAYS EVOLVING.
                <span>NIMBUS FOUNDATION / {info.version}</span>
              </footer>
            </>
          )}
          {Component && <Component />}
          {page === "settings" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">MAKE IT YOURS</span>
                  <h1>Settings</h1>
                  <p>Thoughtful defaults. Personal touches.</p>
                </div>
                <span className="badge">Saved automatically</span>
              </div>
              <section className="panel settings-panel">
                <h3>
                  <Palette size={18} />
                  Appearance
                </h3>
                <div className="setting-row">
                  <div>
                    <strong>Colour mode</strong>
                    <small>Choose how Nimbus looks on your device.</small>
                  </div>
                  <div className="segmented">
                    {(["dark", "light", "system"] as const).map((m, i) => {
                      const Icon = [Moon, Sun, Monitor][i];
                      return (
                        <button
                          key={m}
                          onClick={() => save({ appearance: m })}
                          className={
                            settings.appearance === m ? "selected" : ""
                          }
                        >
                          <Icon size={16} />
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <strong>Accent colour</strong>
                    <small>A little colour, your way.</small>
                  </div>
                  <div className="swatches">
                    {[
                      "#a5a0ff",
                      "#70cbb2",
                      "#f4b887",
                      "#77b8eb",
                      "#ee8fae",
                    ].map((c) => (
                      <button
                        aria-label={`Accent ${c}`}
                        className="swatch"
                        key={c}
                        style={{ background: c }}
                        onClick={() => save({ accent: c })}
                      >
                        {settings.accent === c && <Check size={16} />}
                      </button>
                    ))}
                    <input
                      aria-label="Custom accent colour"
                      type="color"
                      value={settings.accent}
                      onChange={(e) => save({ accent: e.target.value })}
                    />
                  </div>
                </div>
              </section>
              <section className="panel settings-panel">
                <h3>
                  <SlidersHorizontal size={18} />
                  Startup & behaviour
                </h3>
                <Setting
                  label="Open on startup"
                  detail="Choose your starting page."
                >
                  <select
                    value={settings.startupPage}
                    onChange={(e) =>
                      save({
                        startupPage: e.target.value as Settings["startupPage"],
                      })
                    }
                  >
                    <option value="home">Home</option>
                    <option value="workspace">Workspace</option>
                  </select>
                </Setting>
                <Autostart notify={notify} />
                <Setting
                  label="Start quietly"
                  detail="Start in the tray when Windows signs in."
                >
                  <Toggle
                    label="Start quietly"
                    value={settings.startMinimized}
                    change={(v) => save({ startMinimized: v })}
                  />
                </Setting>
                <Setting
                  label="Close to system tray"
                  detail="Keep Nimbus running and checking for updates when you close the window."
                >
                  <Toggle
                    label="Close to tray"
                    value={settings.minimizeToTray}
                    change={(v) => save({ minimizeToTray: v })}
                  />
                </Setting>
              </section>
              <section className="panel settings-panel">
                <h3>
                  <RefreshCw size={18} />
                  Updates
                </h3>
                <Setting
                  label="Release channel"
                  detail="Stable for everyday use. Beta for early access."
                >
                  <select
                    value={settings.channel}
                    onChange={(e) =>
                      save({ channel: e.target.value as Settings["channel"] })
                    }
                  >
                    <option value="stable">Stable</option>
                    <option value="beta">Beta</option>
                  </select>
                </Setting>
                <Setting
                  label="Automatic checks"
                  detail="Check on launch and every 20 seconds while Nimbus is running."
                >
                  <Toggle
                    label="Automatic checks"
                    value={settings.autoCheck}
                    change={(v) => save({ autoCheck: v })}
                  />
                </Setting>
                <Setting
                  label="Background downloads"
                  detail="Download and verify new releases as they arrive."
                >
                  <Toggle
                    label="Background downloads"
                    value={settings.autoDownload}
                    change={(v) => save({ autoDownload: v })}
                  />
                </Setting>
                <Setting
                  label="Install updates"
                  detail="Automatic mode restarts Nimbus 20 seconds after verification."
                >
                  <select
                    value={settings.installation}
                    onChange={(e) =>
                      save({
                        installation: e.target
                          .value as Settings["installation"],
                      })
                    }
                  >
                    <option value="automatic">Automatically restart</option>
                    <option value="prompt">Ask before restarting</option>
                    <option value="onExit">When I quit Nimbus</option>
                  </select>
                </Setting>
                <div className="update-box">
                  <div>
                    <strong>
                      {status.version
                        ? `Version ${status.version}`
                        : "Application updates"}
                    </strong>
                    <p>{status.message}</p>
                    {status.phase === "downloading" && (
                      <progress value={status.progress} max={100} />
                    )}
                  </div>
                  <button
                    onClick={() => action("check_updates")}
                    className="secondary"
                  >
                    <RefreshCw size={15} />
                    Check now
                  </button>
                  {status.phase === "available" && (
                    <button
                      className="primary"
                      onClick={() => action("download_update")}
                    >
                      Download
                    </button>
                  )}
                  {status.phase === "ready" && (
                    <button
                      className="primary"
                      onClick={() => action("install_update")}
                    >
                      Restart & install
                    </button>
                  )}
                </div>
                <div className="inline-actions">
                  <button
                    className="text-button"
                    onClick={() =>
                      call<any[]>("update_history")
                        .then(setHistory)
                        .catch((e) => notify(String(e)))
                    }
                  >
                    <History size={15} />
                    Update history
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      setHistory([
                        {
                          version: info.version,
                          notes:
                            status.notes ||
                            "Foundation release: modular workspace, personal settings, administrator deployment tools, and a signed update client.",
                        },
                      ]);
                    }}
                  >
                    <FileArchive size={15} />
                    View changelog
                  </button>
                </div>
              </section>
              <section className="panel settings-panel">
                <h3>
                  <Code2 size={18} />
                  Development & Updates
                </h3>
                <Setting
                  label="Release administration"
                  detail={
                    admin
                      ? "You are signed in as an administrator."
                      : "Sign in to review ZIP updates and publish releases."
                  }
                >
                  <button
                    className="secondary"
                    onClick={() => setPage("development")}
                  >
                    {admin ? "Open administration" : "Administrator sign-in"}
                    <ArrowUpRight size={15} />
                  </button>
                </Setting>
              </section>
              <div className="about-line">
                <div className="brand-mark small">n</div>
                <span>
                  Nimbus {info.version}
                  <small>{info.build}</small>
                </span>
                <code>
                  {info.serviceConfigured
                    ? "Service configured"
                    : "Service not connected"}
                </code>
              </div>
            </>
          )}
          {page === "development" && (
            <Development
              admin={admin}
              setAdmin={setAdmin}
              info={info}
              settings={settings}
              notify={notify}
            />
          )}
        </main>
        {status.phase === "ready" && (
          <div className="update-banner">
            <ShieldCheck size={19} />
            <div>
              <strong>Nimbus {status.version} is ready</strong>
              <span>
                {settings.installation === "automatic"
                  ? "Restarting automatically after verification."
                  : "Your update has been verified and staged."}
              </span>
            </div>
            <button
              className="secondary"
              onClick={() => save({ installation: "prompt" })}
            >
              Later
            </button>
            <button
              className="primary"
              onClick={() => action("install_update")}
            >
              Restart now
            </button>
          </div>
        )}
      </div>
      {notice && (
        <div className="toast" role="alert">
          <AlertCircle size={18} />
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {history && (
        <div className="modal-backdrop">
          <section className="modal panel">
            <div className="panel-title">
              <h2>Updates & changelog</h2>
              <button
                className="icon-button"
                aria-label="Close history"
                onClick={() => setHistory(null)}
              >
                <X />
              </button>
            </div>
            {!history.length ? (
              <p>No installation attempts have been recorded on this device.</p>
            ) : (
              history.map((h, i) => (
                <article key={i} className="history-row">
                  <strong>{h.version}</strong>
                  <p>
                    {h.notes ||
                      (h.success
                        ? "Installed successfully"
                        : "Installation did not complete; settings preserved.")}
                  </p>
                  {h.at && (
                    <small>{new Date(h.at * 1000).toLocaleString()}</small>
                  )}
                </article>
              ))
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Setting({
  label,
  detail,
  children,
}: {
  label: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
      {children}
    </div>
  );
}
function Toggle({
  label,
  value,
  change,
}: {
  label: string;
  value: boolean;
  change: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-label={label}
      aria-checked={value}
      className={`toggle ${value ? "on" : ""}`}
      onClick={() => change(!value)}
    >
      <span />
    </button>
  );
}
function Autostart({ notify }: { notify: (m: string) => void }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (desktop)
      isEnabled()
        .then(setActive)
        .catch((e) => notify(String(e)));
  }, []);
  return (
    <Setting label="Launch with Windows" detail="Open Nimbus when you sign in.">
      <Toggle
        label="Launch with Windows"
        value={active}
        change={async (v) => {
          try {
            if (!desktop)
              throw new Error("Available in the Windows application");
            await (v ? enable() : disable());
            setActive(v);
          } catch (e) {
            notify(String(e));
          }
        }}
      />
    </Setting>
  );
}
function Development({
  admin,
  setAdmin,
  info,
  settings,
  notify,
}: {
  admin: boolean;
  setAdmin: (a: boolean) => void;
  info: AppInfo;
  settings: Settings;
  notify: (m: string) => void;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<{ name: string; size: number }>(),
    [progress, setProgress] = useState(0),
    [deployments, setDeployments] = useState<Deployment[]>([]),
    [releases, setReleases] = useState<Release[]>([]),
    [review, setReview] = useState<any>(),
    [autoPublish, setAutoPublish] = useState(false),
    [base, setBase] = useState("");
  const load = useCallback(async () => {
    if (!admin) return;
    const [d, r, p, s] = await Promise.all([
      api<Deployment[]>("/deployments"),
      api<Release[]>("/releases"),
      api<any>("/policy"),
      api<any>(`/source?channel=${settings.channel}`),
    ]);
    setDeployments(d);
    setReleases(r);
    setAutoPublish(!!p.auto_publish);
    setBase(s.baseCommit);
  }, [admin, settings.channel]);
  useEffect(() => {
    load().catch((e) => notify(String(e)));
    if (!admin) return;
    const t = setInterval(async () => {
      try {
        const d = await api<Deployment[]>("/deployments");
        for (const item of d.filter(
          (x) => !["Released", "Failed", "Reviewing"].includes(x.status),
        ))
          await api(`/deployments/${item.id}/refresh`, "POST");
        await load();
      } catch (e) {
        notify(String(e));
      }
    }, 6000);
    return () => clearInterval(t);
  }, [load, admin]);
  useEffect(() => {
    if (!desktop) return;
    const a = listen<any>("zip-selected", (e) => setSelected(e.payload)),
      b = listen<string>("zip-error", (e) => notify(e.payload)),
      c = listen<number>("upload-progress", (e) => setProgress(e.payload));
    return () => {
      [a, b, c].forEach((p) => p.then((f) => f()));
    };
  }, []);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify(String(e));
    } finally {
      setBusy(false);
    }
  };
  const upload = () =>
    run(async () => {
      setProgress(0);
      const r = await call<any>("upload_zip");
      setReview(r);
      setSelected(undefined);
      await load();
    });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">BUILD. REVIEW. RELEASE.</span>
          <h1>Development & Updates</h1>
          <p>A clear path from your next idea to everyone’s workspace.</p>
        </div>
        <span className="badge">
          <ShieldCheck size={13} />
          {admin ? "Administrator" : "Protected area"}
        </span>
      </div>
      {!info.serviceConfigured && (
        <div className="callout">
          <Cloud size={20} />
          <div>
            <strong>Connect your deployment service</strong>
            <p>
              This build has no configured administration endpoint. Uploads and
              publishing remain unavailable until the service is deployed and
              its address is included in a signed build.
            </p>
          </div>
        </div>
      )}
      {!admin ? (
        <section className="panel login-card">
          <span className="icon-box">
            <LockKeyhole size={23} />
          </span>
          <h2>Administrator sign-in</h2>
          <p>Release controls are protected by server-side permissions.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await call("login", { email, password });
                setPassword("");
                setAdmin(true);
              });
            }}
          >
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button
              className="primary"
              disabled={busy || !info.serviceConfigured}
            >
              {busy ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <LockKeyhole size={16} />
              )}
              Sign in securely
            </button>
          </form>
          <small>
            First administrator? Use the one-time setup tool included with the
            source package.
          </small>
        </section>
      ) : (
        <>
          {!deployments.length && (
            <section className="panel settings-panel">
              <h3>Start your release history</h3>
              <p className="subtle">
                Build the initial 1.0.0 release from the configured trusted
                source revision.
              </p>
              <button
                disabled={busy}
                className="primary"
                onClick={() =>
                  run(async () => {
                    await api("/bootstrap-release", "POST");
                    await load();
                  })
                }
              >
                Build initial release <ArrowUpRight size={15} />
              </button>
            </section>
          )}
          <div className="admin-top">
            <div className="panel compact-stat">
              <span>Installed version</span>
              <strong>{info.version}</strong>
            </div>
            <div className="panel compact-stat">
              <span>Active channel</span>
              <strong className="capitalize">{settings.channel}</strong>
            </div>
            <div className="panel compact-stat">
              <span>Latest release</span>
              <strong>
                {releases.find(
                  (r) => r.channel === settings.channel && !r.withdrawn,
                )?.version || "Not published"}
              </strong>
            </div>
            <button
              className="text-button"
              onClick={() =>
                run(async () => {
                  await call("logout");
                  setAdmin(false);
                })
              }
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
          <section className="panel settings-panel">
            <div className="panel-title">
              <h3>
                <Upload size={18} />
                Upload development ZIP
              </h3>
              <span className="badge">4 MiB maximum</span>
            </div>
            <div className="dropzone">
              <FileArchive size={33} />
              <h3>{selected?.name || "Drop your next release here"}</h3>
              <p>
                {selected
                  ? `${(selected.size / 1024).toFixed(1)} KiB · Ready to validate`
                  : "A development ZIP with update.json, feature code, and assets."}
              </p>
              <div className="button-row">
                <button
                  disabled={busy}
                  className="secondary"
                  onClick={() =>
                    run(async () => setSelected(await call("choose_zip")))
                  }
                >
                  Choose ZIP
                </button>
                {selected && (
                  <button className="primary" disabled={busy} onClick={upload}>
                    {busy ? (
                      <Loader2 className="spin" size={16} />
                    ) : (
                      <Upload size={16} />
                    )}
                    Upload & validate
                  </button>
                )}
              </div>
              {busy && progress > 0 && (
                <div className="upload-progress">
                  <progress max={100} value={progress} />
                  <small>
                    {progress === 100
                      ? "Uploaded · Validating archive…"
                      : `Sending ${progress}%`}
                  </small>
                </div>
              )}
            </div>
            <p className="subtle">
              Source revision for your next archive:{" "}
              <code className="selectable">{base}</code>
            </p>
          </section>
          {review && (
            <section className="panel settings-panel">
              <div className="panel-title">
                <h3>Review proposed changes</h3>
                <span className="badge">
                  {review.manifest.version} · {review.manifest.channel}
                </span>
              </div>
              <p>{review.manifest.notes}</p>
              <div className="file-list">
                {review.summary.map((f: any) => (
                  <div key={f.path}>
                    <span className={`change-kind ${f.kind}`}>{f.kind}</span>
                    <code>{f.path}</code>
                    <small>{f.bytes} B</small>
                  </div>
                ))}
              </div>
              <div className="callout slim">
                <ShieldCheck size={17} />
                <p>
                  Protected core files are excluded. Approval creates an
                  isolated build; publishing is a separate step.
                </p>
              </div>
              <button
                disabled={busy}
                className="primary"
                onClick={() =>
                  run(async () => {
                    await api(`/deployments/${review.id}/approve`, "POST");
                    setReview(undefined);
                    await load();
                  })
                }
              >
                <Check size={16} />
                Approve & build
              </button>
            </section>
          )}
          <section className="panel settings-panel">
            <div className="panel-title">
              <h3>
                <Activity size={18} />
                Deployment pipeline
              </h3>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => run(load)}
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>
            {!deployments.length && (
              <p className="subtle">
                No uploads yet. Your first deployment will appear here.
              </p>
            )}
            {deployments.map((d) => (
              <div className="deployment" key={d.id}>
                <div className="panel-title">
                  <strong>
                    {d.version}
                    <span className="badge">{d.channel}</span>
                  </strong>
                  <span
                    className={`badge ${d.status === "Failed" ? "warning" : ""}`}
                  >
                    {d.status}
                  </span>
                </div>
                <div className="pipeline">
                  {[
                    "Uploaded",
                    "Validating",
                    "Reviewing",
                    "Building",
                    "Testing",
                    "Signing",
                    "Publishing",
                    "Released",
                  ].map((s, i) => {
                    const index = [
                      "Uploaded",
                      "Validating",
                      "Reviewing",
                      "Building",
                      "Testing",
                      "Signing",
                      "Publishing",
                      "Released",
                    ].indexOf(d.status === "Ready" ? "Publishing" : d.status);
                    return (
                      <span key={s} className={i <= index ? "complete" : ""}>
                        <i>{i < index ? <Check size={10} /> : i + 1}</i>
                        {s}
                      </span>
                    );
                  })}
                </div>
                {d.error && <p className="error-text">{d.error}</p>}
                <div className="inline-actions">
                  {d.status === "Reviewing" && (
                    <button
                      className="secondary"
                      onClick={() =>
                        setReview({
                          id: d.id,
                          manifest: JSON.parse(d.manifest),
                          summary: JSON.parse(d.summary),
                        })
                      }
                    >
                      Review changes
                    </button>
                  )}
                  {d.status === "Ready" && (
                    <button
                      disabled={busy}
                      className="primary"
                      onClick={() =>
                        run(async () => {
                          await api(`/deployments/${d.id}/publish`, "POST");
                          await load();
                          notify(
                            "Release published. Online clients will discover it at their next check.",
                          );
                        })
                      }
                    >
                      Publish update
                      <ArrowUpRight size={16} />
                    </button>
                  )}
                  <small>{new Date(d.created_at).toLocaleString()}</small>
                </div>
              </div>
            ))}
          </section>
          <section className="panel settings-panel">
            <h3>
              <Radio size={18} />
              Publishing policy
            </h3>
            <Setting
              label="Automatically publish passing builds"
              detail="Approved archives are published after all required build, test, and signing stages pass."
            >
              <Toggle
                label="Automatically publish passing builds"
                value={autoPublish}
                change={(v) =>
                  run(async () => {
                    await api("/policy", "PUT", { autoPublish: v });
                    setAutoPublish(v);
                  })
                }
              />
            </Setting>
          </section>
          <section className="panel settings-panel">
            <h3>
              <History size={18} />
              Release history
            </h3>
            {!releases.length ? (
              <p className="subtle">No published releases.</p>
            ) : (
              releases.map((r) => (
                <div key={r.id} className="release-row">
                  <div>
                    <strong>{r.version}</strong>
                    <span className="badge">{r.channel}</span>
                    {r.urgent === 1 && (
                      <span className="badge warning">Urgent</span>
                    )}
                    <p>{r.notes}</p>
                    <small>{new Date(r.created_at).toLocaleString()}</small>
                  </div>
                  {r.withdrawn ? (
                    <span className="badge warning">Withdrawn</span>
                  ) : (
                    <button
                      className="secondary danger"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await api(`/releases/${r.id}/withdraw`, "POST");
                          await load();
                        })
                      }
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              ))
            )}
            <p className="subtle">
              Recovery uses a new, higher version built from known-good source.
              Withdrawing stops new downloads; it does not reverse installations
              already completed.
            </p>
          </section>
        </>
      )}
    </>
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="launch">
        <h1>Nimbus couldn’t display this page.</h1>
        <p>
          Your local settings are preserved. Restart the application to recover.
        </p>
        <button className="primary" onClick={() => location.reload()}>
          Reload Nimbus
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
