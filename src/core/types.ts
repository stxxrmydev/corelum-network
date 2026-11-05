import type { ComponentType } from "react";
export interface Settings {
  schema: number;
  appearance: "dark" | "light" | "system";
  accent: string;
  startupPage: "home" | "workspace";
  startMinimized: boolean;
  minimizeToTray: boolean;
  channel: "stable" | "beta";
  autoCheck: boolean;
  autoDownload: boolean;
  installation: "automatic" | "prompt" | "onExit";
}
export interface AppInfo {
  version: string;
  serviceConfigured: boolean;
  service: string;
  settingsError?: string;
  dataDirectory: string;
  build: string;
}
export interface UpdateStatus {
  phase: string;
  message: string;
  version?: string;
  progress: number;
  notes: string;
  checkedAt?: number;
}
export interface Feature {
  id: string;
  title: string;
  description: string;
  icon?: string;
  component: ComponentType;
}
export interface Deployment {
  id: string;
  version: string;
  channel: string;
  status: string;
  summary: string;
  manifest: string;
  error?: string;
  created_at: string;
  source_sha?: string;
  run_id?: string;
}
export interface Release {
  id: string;
  version: string;
  channel: string;
  notes: string;
  withdrawn: number;
  created_at: string;
  urgent: number;
}
