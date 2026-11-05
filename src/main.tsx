import React, { useEffect, useState, useCallback, useRef } from "react";
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
import { call, api, desktop, acceptFile } from "./core/bridge";
import "./ui/theme.css";
import "./ui/studio.css";
import { SignIn, Maintenance, type Account } from "./core/Auth";
import { BrandMark } from "./ui/BrandMark";
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
      message: "Starting Corelum…",
      progress: 0,
      notes: "",
    }),
    [page, setPage] = useState("home"),
    [notice, setNotice] = useState(""),
    [admin, setAdmin] = useState(false),
    [history, setHistory] = useState<any[] | null>(null);
  const [account, setAccount] = useState<Account>(),
    [authLoading, setAuthLoading] = useState(true);
  const settingsRef = useRef<Settings | undefined>(undefined);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(false);
  const notify = useCallback((m: string) => setNotice(m), []);
  useEffect(() => {
    Promise.all([
      call<Settings>("get_settings"),
      call<AppInfo>("app_info"),
      call<UpdateStatus>("update_status"),
    ])
      .then(([s, i, u]) => {
        settingsRef.current = s;
        setSettings(s);
        setInfo(i);
        setStatus(u);
        setPage(s.startupPage);
        if (i.settingsError) notify(i.settingsError);
      })
      .catch((e) => notify(String(e)));
    api<Account>("/me")
      .then((a) => {
        setAccount(a);
        setAdmin(a.role === "admin");
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
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
      const hex = settings.accent.slice(1),
        rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
      document.documentElement.style.setProperty(
        "--on-accent",
        rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 155
          ? "#171820"
          : "#ffffff",
      );
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
    if (!settingsRef.current) return;
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    setSaving(true);
    setSaveError(false);
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() => call("save_settings", { value: next }));
    try {
      await saveQueue.current;
    } catch (e) {
      setSaveError(true);
      notify("Preferences could not be saved: " + String(e));
    } finally {
      setSaving(false);
    }
  };
  useEffect(() => {
    if (!account || !info) return;
    const refresh = async () => {
      try {
        const state = await api<Account>(
          "/network/status?version=" + info.version,
        );
        setAccount(state);
        setAdmin(state.role === "admin");
        if (!desktop) {
          setStatus(
            state.update
              ? {
                  phase: "ready",
                  message:
                    "A new web version is available. Reload to apply the update.",
                  version: state.update.version,
                  notes: state.update.notes,
                  progress: 0,
                }
              : {
                  phase: "current",
                  message: "The latest web version is loaded.",
                  notes: "",
                  progress: 0,
                },
          );
        }
      } catch (e) {
        if (String(e).includes("expired") || String(e).includes("sign-in")) {
          setAccount(undefined);
          setAdmin(false);
        }
      }
    };
    refresh();
    const timer = setInterval(refresh, 20000);
    window.addEventListener("corelum-check", refresh);
    const out = () => {
      setAccount(undefined);
      setAdmin(false);
    };
    window.addEventListener("corelum-signed-out", out);
    return () => {
      clearInterval(timer);
      window.removeEventListener("corelum-check", refresh);
      window.removeEventListener("corelum-signed-out", out);
    };
  }, [account?.id, info?.version]);
  const signOut = async () => {
    try {
      await call("logout");
    } catch {
    } finally {
      setAccount(undefined);
      setAdmin(false);
    }
  };
  const action = async (command: string) => {
    try {
      await call(command);
    } catch (e) {
      notify(String(e));
    }
  };
  if (!settings || !info || authLoading)
    return (
      <div className="launch">
        <BrandMark size={36} />
        <Loader2 className="spin" />
        <p>{notice || "Preparing your workspace"}</p>
      </div>
    );
  if (!account)
    return (
      <SignIn
        onSignedIn={(a) => {
          setAccount(a);
          setAdmin(a.role === "admin");
          setPage("home");
        }}
      />
    );
  if (account.role !== "admin" && account.maintenance)
    return <Maintenance signOut={signOut} />;
  const feature = modules.find((m) => m.id === page),
    Component = feature?.component;
  const nav = [
    { id: "home", title: "Home" },
    ...(admin ? modules.map((m) => ({ id: m.id, title: m.title })) : []),
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div
          className="brand"
          aria-label="Corelum Network"
          title="Corelum Network"
        >
          <BrandMark size={40} />
        </div>
        <div className="space-label">STUDIO</div>
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
          <div className="sidebar-service">
            <span className="status-dot" />
            <div>
              Desktop client
              <small>
                {info.serviceConfigured
                  ? "Update service connected"
                  : "Offline configuration"}
              </small>
            </div>
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
              Development Studio
            </button>
          )}
          <div className="sidebar-version">
            <span className="status-dot" />
            Corelum Network {info.version}
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
                    ? "Development Studio"
                    : feature?.title}
            </strong>
          </div>
          <div className="header-right">
            <span className="tiny-dot" />
            {info.serviceConfigured
              ? "Connected to Corelum"
              : "Service not configured"}
            <span className="header-role">{account.username}</span>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={signOut}
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main key={page}>
          {page === "home" && admin && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">CORELUM NETWORK</span>
                  <h1>Overview</h1>
                  <p>
                    Manage your workspace, preferences, and application
                    releases.
                  </p>
                </div>
                <div className="date-chip">
                  {new Date().toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
              <section className="hero panel studio-hero">
                <div className="hero-copy">
                  <span className="pill">
                    <span className="status-dot" />
                    {info.serviceConfigured
                      ? "Service connected"
                      : "Local workspace"}
                  </span>
                  <h2>Your development workspace</h2>
                  <p>
                    Create and update projects using file drops.
                    <br />
                    Review changes, build releases, and manage distribution.
                  </p>
                  <button
                    className="primary"
                    onClick={() => setPage("workspace")}
                  >
                    Open workspace
                  </button>
                </div>
                <div className="product-emblem">
                  <BrandMark size={114} />
                  <div className="emblem-line" />
                </div>
              </section>
              <div className="section-label">APPLICATION STATUS</div>
              <div className="stats-grid">
                <article className="panel stat">
                  <div className="stat-top">
                    <span className="icon-box">
                      <Box size={19} />
                    </span>
                    <span className="badge">Installed</span>
                  </div>
                  <span className="stat-caption">Current version</span>
                  <h3>
                    {info.version}
                    <span>{settings.channel}</span>
                  </h3>
                  <p>{info.build}</p>
                </article>
                <article className="panel stat">
                  <div className="stat-top">
                    <span className="icon-box mint">
                      <ShieldCheck size={19} />
                    </span>
                    <span className="badge">Verified delivery</span>
                  </div>
                  <span className="stat-caption">Updates</span>
                  <h3>
                    {status.phase === "current"
                      ? "Up to date"
                      : status.phase === "downloading"
                        ? `${status.progress}%`
                        : status.phase === "ready"
                          ? "Ready to install"
                          : status.phase === "error"
                            ? "Connection issue"
                            : status.phase === "unconfigured"
                              ? "Not configured"
                              : "Checking"}
                  </h3>
                  <p>{status.message}</p>
                </article>
                <article className="panel stat">
                  <div className="stat-top">
                    <span className="icon-box">
                      <Layers3 size={19} />
                    </span>
                    <span className="badge">Workspace</span>
                  </div>
                  <span className="stat-caption">Available pages</span>
                  <h3>
                    {modules.length}
                    <span>{modules.length === 1 ? "page" : "pages"}</span>
                  </h3>
                  <p>Installed workspace modules.</p>
                </article>
              </div>
              <div className="lower-grid">
                <section className="panel quick">
                  <div className="panel-title">
                    <h3>Preferences</h3>
                  </div>
                  <button
                    className="quick-row"
                    onClick={() => setPage("settings")}
                  >
                    <span className="icon-box">
                      <Palette size={18} />
                    </span>
                    <span>
                      <strong>Appearance</strong>
                      <small>Colour mode and accent settings.</small>
                    </span>
                  </button>
                  <button
                    className="quick-row"
                    onClick={() => setPage("settings")}
                  >
                    <span className="icon-box">
                      <RefreshCw size={18} />
                    </span>
                    <span>
                      <strong>Application updates</strong>
                      <small>
                        Release channel and installation preferences.
                      </small>
                    </span>
                  </button>
                </section>
                <section className="panel note-card">
                  <div className="panel-title">
                    <h3>Release information</h3>
                    <span className="badge">{settings.channel}</span>
                  </div>
                  <p>
                    {status.notes ||
                      `Version ${info.version} is installed. Release notes are available in Settings.`}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setHistory([
                        {
                          version: info.version,
                          notes:
                            status.notes ||
                            "Corelum Network: workspace, file-drop review, deployment management, and verified application updates.",
                        },
                      ]);
                    }}
                  >
                    View release notes
                  </button>
                </section>
              </div>
              <footer>
                <span className="status-dot" />
                Corelum Network<span>Version {info.version}</span>
              </footer>
            </>
          )}
          {page === "home" && !admin && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">CORELUM NETWORK</span>
                  <h1>Your personal workspace</h1>
                  <p>Welcome, {account.username}.</p>
                </div>
              </div>
              <section className="panel personal-home">
                <BrandMark size={54} />
                <h2>Your account is ready</h2>
                <p>Personal tools will be available here.</p>
              </section>
            </>
          )}
          {Component && admin && <Component />}
          {page === "settings" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">PREFERENCES</span>
                  <h1>Settings</h1>
                  <p>Configure appearance, startup, and update behaviour.</p>
                </div>
                <span className={`badge ${saveError ? "warning" : ""}`}>
                  {saveError
                    ? "Changes not saved"
                    : saving
                      ? "Saving…"
                      : "All changes saved"}
                </span>
              </div>
              <section className="panel settings-panel">
                <h3>
                  <Palette size={18} />
                  Appearance
                </h3>
                <div className="setting-row">
                  <div>
                    <strong>Colour mode</strong>
                    <small>Choose how Corelum looks on your device.</small>
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
                    <small>
                      Applied to navigation, buttons, and interface highlights.
                    </small>
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
                  detail="Keep Corelum running and checking for updates when you close the window."
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
                  detail="Check on launch and every 20 seconds while Corelum is running."
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
                  detail="Automatic mode restarts Corelum 20 seconds after verification."
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
                    <option value="onExit">When I quit Corelum</option>
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
                            "Corelum Network: workspace, preferences, file-drop review, and application updates.",
                        },
                      ]);
                    }}
                  >
                    <FileArchive size={15} />
                    View changelog
                  </button>
                </div>
              </section>
              {admin && (
                <>
                  <section className="panel settings-panel">
                    <h3>
                      <Code2 size={18} />
                      Development Studio
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
                        {admin
                          ? "Open administration"
                          : "Administrator sign-in"}
                      </button>
                    </Setting>
                  </section>
                </>
              )}
              <div className="about-line">
                <BrandMark size={28} />
                <span>
                  Corelum Network {info.version}
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
          {page === "development" && admin && (
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
              <strong>Update pending · {status.version}</strong>
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
              {desktop ? "Restart now" : "Reload now"}
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
    <Setting
      label="Launch with Windows"
      detail="Open Corelum when you sign in."
    >
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
    [maintenance, setMaintenance] = useState(false),
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
    setMaintenance(!!p.maintenance);
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
    const browserProgress = (e: Event) =>
      setProgress((e as CustomEvent<number>).detail);
    window.addEventListener("corelum-upload-progress", browserProgress);
    if (!desktop)
      return () =>
        window.removeEventListener("corelum-upload-progress", browserProgress);
    if (!desktop) return;
    const a = listen<any>("zip-selected", (e) => setSelected(e.payload)),
      b = listen<string>("zip-error", (e) => notify(e.payload)),
      c = listen<number>("upload-progress", (e) => setProgress(e.payload));
    return () => {
      window.removeEventListener("corelum-upload-progress", browserProgress);
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
          <span className="eyebrow">RELEASE MANAGEMENT</span>
          <h1>Development Studio</h1>
          <p>
            Review file drops, monitor builds, and publish verified releases.
          </p>
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
                Build initial release
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
                Upload file drop
              </h3>
              <span className="badge">4 MiB maximum</span>
            </div>
            <div
              className="dropzone"
              onDragOver={(e) => {
                if (!desktop) e.preventDefault();
              }}
              onDrop={(e) => {
                if (!desktop) {
                  e.preventDefault();
                  try {
                    if (e.dataTransfer.files[0])
                      setSelected(acceptFile(e.dataTransfer.files[0]));
                  } catch (error) {
                    notify(String(error));
                  }
                }
              }}
            >
              <FileArchive size={33} />
              <h3>{selected?.name || "Drop a ZIP file here"}</h3>
              <p>
                {selected
                  ? `${(selected.size / 1024).toFixed(1)} KiB · Ready to validate`
                  : "A ZIP containing update.json and the changed project files."}
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
              label="Maintenance mode"
              detail="Block regular accounts from accessing Corelum Network. Administrators retain access."
            >
              <Toggle
                label="Maintenance mode"
                value={maintenance}
                change={(v) =>
                  run(async () => {
                    await api("/policy", "PUT", { maintenance: v });
                    setMaintenance(v);
                  })
                }
              />
            </Setting>
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
        <h1>Corelum couldn’t display this page.</h1>
        <p>
          Your local settings are preserved. Restart the application to recover.
        </p>
        <button className="primary" onClick={() => location.reload()}>
          Reload Corelum
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
