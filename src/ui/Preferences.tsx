import { useEffect, useState } from "react";
import {
  Palette,
  Monitor,
  RefreshCw,
  UserRound,
  Check,
  Sun,
  Moon,
  History,
  FileText,
  Power,
  ShieldCheck,
} from "lucide-react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { desktop } from "../core/bridge";
import type { Settings, AppInfo, UpdateStatus } from "../core/types";
import type { Account } from "../core/Auth";
import { BrandMark } from "./BrandMark";
type Tab = "appearance" | "application" | "updates" | "account";
interface Props {
  settings: Settings;
  info: AppInfo;
  status: UpdateStatus;
  account: Account;
  saving: boolean;
  saveError: boolean;
  save: (v: Partial<Settings>) => Promise<void>;
  action: (command: string) => Promise<void>;
  notify: (s: string) => void;
  history: () => void;
  changelog: () => void;
  development: () => void;
  initialTab?: Tab;
}
const colours = [
  ["Violet", "#a5a0ff"],
  ["Sage", "#70cbb2"],
  ["Sand", "#f4b887"],
  ["Blue", "#77b8eb"],
  ["Rose", "#ee8fae"],
];
function Switch({
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
      className={`toggle ${value ? "on" : ""}`}
      role="switch"
      aria-label={label}
      aria-checked={value}
      onClick={() => change(!value)}
    >
      <span />
    </button>
  );
}
function Row({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="preference-row">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Preferences(p: Props) {
  const [tab, setTab] = useState<Tab>(p.initialTab || "appearance"),
    [startup, setStartup] = useState(false),
    [hex, setHex] = useState(p.settings.accent);
  useEffect(() => setHex(p.settings.accent), [p.settings.accent]);
  useEffect(() => {
    if (desktop)
      isEnabled()
        .then(setStartup)
        .catch((e) => p.notify(String(e)));
  }, []);
  const items = [
    { id: "appearance" as Tab, name: "Appearance", Icon: Palette },
    ...(desktop
      ? [{ id: "application" as Tab, name: "Application", Icon: Monitor }]
      : []),
    { id: "updates" as Tab, name: "Updates", Icon: RefreshCw },
    { id: "account" as Tab, name: "Account", Icon: UserRound },
  ];
  return (
    <div className="preferences-page">
      <div className="preferences-heading">
        <div>
          <h1>Settings</h1>
          <p>Manage your preferences.</p>
        </div>
        <span className={p.saveError ? "save-state error-text" : "save-state"}>
          {p.saveError ? (
            "Could not save"
          ) : p.saving ? (
            "Saving…"
          ) : (
            <>
              <Check size={12} />
              Saved
            </>
          )}
        </span>
      </div>
      <div className="preferences-layout">
        <nav className="preference-tabs" aria-label="Settings categories">
          {items.map(({ id, name, Icon }) => (
            <button
              className={id === tab ? "selected" : ""}
              key={id}
              onClick={() => setTab(id)}
            >
              <Icon size={16} />
              {name}
            </button>
          ))}
        </nav>
        <div className="preferences-content" key={tab}>
          {tab === "appearance" && (
            <>
              <div className="preference-title">
                <h2>Appearance</h2>
                <p>Set the look of your workspace.</p>
              </div>
              <h3 className="field-title">Theme</h3>
              <div className="theme-choices">
                {(["dark", "light", "system"] as const).map((theme, i) => {
                  const Icon = [Moon, Sun, Monitor][i];
                  return (
                    <button
                      key={theme}
                      className={`theme-choice ${theme} ${p.settings.appearance === theme ? "chosen" : ""}`}
                      aria-label={theme}
                      aria-pressed={p.settings.appearance === theme}
                      onClick={() => p.save({ appearance: theme })}
                    >
                      <div className="theme-preview">
                        <div className="preview-rail">
                          <i />
                          <i />
                          <i />
                        </div>
                        <div className="preview-canvas">
                          <i />
                          <i />
                          <i />
                        </div>
                      </div>
                      <span>
                        <Icon size={14} />
                        {theme}
                        <i>
                          {p.settings.appearance === theme && (
                            <Check size={12} />
                          )}
                        </i>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="preference-divider" />
              <h3 className="field-title">Accent</h3>
              <p className="field-description">
                Used for selected controls and interface highlights.
              </p>
              <div className="colour-choices">
                {colours.map(([name, colour]) => (
                  <button
                    key={colour}
                    aria-label={`Accent ${colour}`}
                    aria-pressed={p.settings.accent === colour}
                    className={p.settings.accent === colour ? "chosen" : ""}
                    onClick={() => p.save({ accent: colour })}
                  >
                    <span style={{ background: colour }}>
                      {p.settings.accent === colour && <Check size={14} />}
                    </span>
                    <small>{name}</small>
                  </button>
                ))}
              </div>
              <div className="custom-colour">
                <label className="colour-picker" title="Custom accent">
                  <input
                    type="color"
                    aria-label="Custom accent colour"
                    value={p.settings.accent}
                    onChange={(e) => p.save({ accent: e.target.value })}
                  />
                </label>
                <div>
                  <label htmlFor="accent-hex">Custom colour</label>
                  <p>Choose any colour.</p>
                </div>
                <input
                  id="accent-hex"
                  aria-label="Accent hex value"
                  value={hex}
                  maxLength={7}
                  onChange={(e) => setHex(e.target.value)}
                  onBlur={() => {
                    if (/^#[a-fA-F0-9]{6}$/.test(hex)) p.save({ accent: hex });
                    else setHex(p.settings.accent);
                  }}
                />
              </div>
              <div className="preference-divider" />
              <div className="appearance-example">
                <BrandMark size={24} />
                <div>
                  <strong>Workspace preview</strong>
                  <p>Your accent updates throughout the app.</p>
                </div>
                <button
                  className="primary"
                  onClick={() =>
                    p.notify("This is your current interface accent.")
                  }
                >
                  Selected
                </button>
              </div>
            </>
          )}
          {tab === "application" && (
            <>
              <div className="preference-title">
                <h2>Application</h2>
                <p>Windows startup and background behaviour.</p>
              </div>
              <Row
                title="Start page"
                description="Choose the page shown after sign-in."
              >
                <select
                  aria-label="Start page"
                  value={p.settings.startupPage}
                  onChange={(e) =>
                    p.save({
                      startupPage: e.target.value as Settings["startupPage"],
                    })
                  }
                >
                  <option value="home">Home</option>
                  <option value="workspace">Workspace</option>
                </select>
              </Row>
              <Row
                title="Launch with Windows"
                description="Start Corelum AI when you sign in to Windows."
              >
                <Switch
                  label="Launch with Windows"
                  value={startup}
                  change={async (v) => {
                    try {
                      await (v ? enable() : disable());
                      setStartup(v);
                    } catch (e) {
                      p.notify(String(e));
                    }
                  }}
                />
              </Row>
              <Row
                title="Start in the background"
                description="Use the system tray when launched with Windows."
              >
                <Switch
                  label="Start quietly"
                  value={p.settings.startMinimized}
                  change={(v) => p.save({ startMinimized: v })}
                />
              </Row>
              <Row
                title="Close to system tray"
                description="Keep checking for updates after the window closes."
              >
                <Switch
                  label="Close to tray"
                  value={p.settings.minimizeToTray}
                  change={(v) => p.save({ minimizeToTray: v })}
                />
              </Row>
            </>
          )}
          {tab === "updates" && (
            <>
              <div className="preference-title">
                <h2>Updates</h2>
                <p>Manage release delivery and installation.</p>
              </div>
              <div className="release-summary">
                <div className="release-symbol">
                  <RefreshCw size={23} />
                </div>
                <div>
                  <strong>
                    Corelum AI <span>{p.info.version}</span>
                  </strong>
                  <p>{p.status.message}</p>
                </div>
              </div>
              {p.status.phase === "downloading" && (
                <progress value={p.status.progress} max={100} />
              )}
              <div className="update-actions">
                <button
                  className="secondary"
                  onClick={() => p.action("check_updates")}
                >
                  <RefreshCw size={14} />
                  Check for updates
                </button>
                {p.status.phase === "available" && desktop && (
                  <button
                    className="primary"
                    onClick={() => p.action("download_update")}
                  >
                    Download update
                  </button>
                )}
                {p.status.phase === "ready" && (
                  <button
                    className="primary"
                    onClick={() => p.action("install_update")}
                  >
                    {desktop ? "Restart and update" : "Reload and update"}
                  </button>
                )}
              </div>
              {desktop && (
                <>
                  <div className="preference-divider" />
                  <Row
                    title="Release channel"
                    description="Stable releases or early Beta access."
                  >
                    <select
                      aria-label="Release channel"
                      value={p.settings.channel}
                      onChange={(e) =>
                        p.save({
                          channel: e.target.value as Settings["channel"],
                        })
                      }
                    >
                      <option value="stable">Stable</option>
                      <option value="beta">Beta</option>
                    </select>
                  </Row>
                  <Row
                    title="Automatic checks"
                    description="Check at launch and every 20 seconds."
                  >
                    <Switch
                      label="Automatic checks"
                      value={p.settings.autoCheck}
                      change={(v) => p.save({ autoCheck: v })}
                    />
                  </Row>
                  <Row
                    title="Download in the background"
                    description="Download and verify approved updates automatically."
                  >
                    <Switch
                      label="Background downloads"
                      value={p.settings.autoDownload}
                      change={(v) => p.save({ autoDownload: v })}
                    />
                  </Row>
                  <Row
                    title="Installation"
                    description="Control when an update takes effect."
                  >
                    <select
                      aria-label="Installation"
                      value={p.settings.installation}
                      onChange={(e) =>
                        p.save({
                          installation: e.target
                            .value as Settings["installation"],
                        })
                      }
                    >
                      <option value="prompt">Ask before restarting</option>
                      <option value="onExit">When I quit</option>
                      <option value="automatic">Automatically restart</option>
                    </select>
                  </Row>
                </>
              )}
              <div className="preference-divider" />
              <div className="preference-links">
                {desktop && (
                  <button onClick={p.history}>
                    <History size={14} />
                    Installation history
                  </button>
                )}
                <button onClick={p.changelog}>
                  <FileText size={14} />
                  Release notes
                </button>
              </div>
            </>
          )}
          {tab === "account" && (
            <>
              <div className="preference-title">
                <h2>Account</h2>
                <p>Your account and application details.</p>
              </div>
              <div className="account-details">
                <span className="account-initial">
                  {p.account.username[0].toUpperCase()}
                </span>
                <div>
                  <strong>{p.account.username}</strong>
                  <p>
                    {p.account.role === "admin" ? "Administrator" : "Member"}
                  </p>
                </div>
              </div>
              {p.account.role === "admin" && (
                <Row
                  title="Development Studio"
                  description="Review file drops and manage releases."
                >
                  <button className="secondary" onClick={p.development}>
                    <ShieldCheck size={14} />
                    Open studio
                  </button>
                </Row>
              )}
              <div className="preference-divider" />
              <div className="application-details">
                <BrandMark size={28} />
                <div>
                  <strong>Corelum AI</strong>
                  <p>
                    Version {p.info.version} · {p.info.build}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
