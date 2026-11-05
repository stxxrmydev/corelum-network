import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Settings, AppInfo, UpdateStatus } from "./types";
export const desktop = isTauri();
let selectedFile: File | undefined;
export function acceptFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".zip") || file.size > 4194304)
    throw new Error("Choose a ZIP file no larger than 4 MiB");
  selectedFile = file;
  return { name: file.name, size: file.size };
}
async function webRequest(path: string, method = "GET", data?: unknown) {
  const r = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  let body;
  try {
    body = await r.json();
  } catch {
    throw new Error("The service returned an invalid response");
  }
  if (!r.ok) throw new Error(body.error || "The request failed");
  return body;
}
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
  installation: "prompt",
};
export async function call<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (desktop) return invoke<T>(command, args);
  if (command === "admin_api")
    return webRequest(
      String(args?.path),
      String(args?.method),
      args?.data ? JSON.parse(String(args.data)) : undefined,
    ) as Promise<T>;
  if (command === "login") {
    await webRequest("/auth/login", "POST", {
      username: args?.email,
      password: args?.password,
    });
    return undefined as T;
  }
  if (command === "register") {
    await webRequest("/auth/register", "POST", args);
    return undefined as T;
  }
  if (command === "logout") {
    await webRequest("/logout", "POST");
    return undefined as T;
  }
  if (command === "install_update") {
    location.reload();
    return undefined as T;
  }
  if (command === "check_updates" || command === "download_update") {
    window.dispatchEvent(new Event("corelum-check"));
    return undefined as T;
  }
  if (command === "choose_zip")
    return new Promise<T>((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".zip";
      input.onchange = () => {
        try {
          if (!input.files?.[0]) throw new Error("No file selected");
          resolve(acceptFile(input.files[0]) as T);
        } catch (e) {
          reject(e);
        }
      };
      input.oncancel = () => reject(new Error("No file selected"));
      input.click();
    });
  if (command === "upload_zip") {
    if (!selectedFile) throw new Error("Choose a ZIP file first");
    const file = selectedFile;
    selectedFile = undefined;
    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/deployments");
      xhr.withCredentials = true;
      xhr.setRequestHeader("Content-Type", "application/zip");
      xhr.upload.onprogress = (e) =>
        window.dispatchEvent(
          new CustomEvent("corelum-upload-progress", {
            detail: e.lengthComputable
              ? Math.round((e.loaded * 100) / e.total)
              : 0,
          }),
        );
      xhr.onerror = () =>
        reject(new Error("Upload interrupted. Please try again."));
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status < 200 || xhr.status >= 300)
            throw new Error(data.error || "Upload failed");
          resolve(data);
        } catch (e) {
          reject(e);
        }
      };
      xhr.send(file);
    });
  }
  if (command === "get_settings")
    return JSON.parse(
      localStorage.getItem("corelum.preview") ||
        JSON.stringify(previewSettings),
    ) as T;
  if (command === "save_settings") {
    localStorage.setItem("corelum.preview", JSON.stringify(args?.value));
    return undefined as T;
  }
  if (command === "app_info")
    return {
      version: __APP_VERSION__,
      serviceConfigured: !["localhost", "127.0.0.1"].includes(
        location.hostname,
      ),
      service: location.origin,
      build: ["localhost", "127.0.0.1"].includes(location.hostname)
        ? "Browser preview"
        : "Web client",
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
