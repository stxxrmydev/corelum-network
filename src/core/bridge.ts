import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Settings, AppInfo, UpdateStatus } from "./types";
export const desktop = isTauri();
const previewSettings: Settings = {
  schema: 1,
  appearance: "dark",
  accent: "#a5a0ff",
  startupPage: "home",
  startMinimized: false,
  minimizeToTray: true,
  channel: "stable",
  autoCheck: true,
  autoDownload: true,
  installation: "automatic",
};
export async function call<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (desktop) return invoke<T>(command, args);
  if (command === "get_settings")
    return JSON.parse(
      localStorage.getItem("nimbus.preview") || JSON.stringify(previewSettings),
    ) as T;
  if (command === "save_settings") {
    localStorage.setItem("nimbus.preview", JSON.stringify(args?.value));
    return undefined as T;
  }
  if (command === "app_info")
    return {
      version: "1.0.0",
      serviceConfigured: false,
      service: "",
      build: "Browser preview",
      dataDirectory: "Desktop only",
    } as AppInfo as T;
  if (command === "update_status")
    return {
      phase: "unconfigured",
      message:
        "Browser preview. Run the Windows application to use signed updates.",
      progress: 0,
      notes: "",
    } as UpdateStatus as T;
  if (command === "update_history") return [] as T;
  throw new Error("This action requires the installed Windows application.");
}
export const api = <T>(path: string, method = "GET", data?: unknown) =>
  call<T>("admin_api", {
    path,
    method,
    data: data === undefined ? null : JSON.stringify(data),
  });
