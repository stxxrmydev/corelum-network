import { useState } from "react";
import { FileText, Save, Settings2 } from "lucide-react";
import type { Feature } from "../../core/types";
function Workspace() {
  const [note, setNote] = useState(
      () => localStorage.getItem("corelum.workspace.note.v1") || "",
    ),
    [saved, setSaved] = useState(true),
    [error, setError] = useState("");
  const save = () => {
    try {
      localStorage.setItem("corelum.workspace.note.v1", note);
      setSaved(true);
      setError("");
    } catch {
      setError(
        "This note could not be saved. Check available disk space and try again.",
      );
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">WORKSPACE</span>
          <h1>Workspace</h1>
          <p>Project notes and development resources.</p>
        </div>
        <span className="badge">Stored on this device</span>
      </div>
      <div className="workspace-layout">
        <aside className="panel workspace-nav">
          <h3>Workspace notes</h3>
          <p>
            Keep requirements, release notes, and file-drop instructions
            together.
          </p>
          <div className="workspace-info">
            <FileText size={18} />
            <p>
              Notes remain on this device and are preserved when the application
              updates.
            </p>
          </div>
        </aside>
        <section className="panel workspace-editor">
          <div className="panel-title">
            <h3>Project notes</h3>
            <small>{saved ? "Saved" : "Unsaved changes"}</small>
          </div>
          <textarea
            aria-label="Project notes"
            placeholder="Add project requirements or instructions…"
            value={note}
            maxLength={100000}
            onChange={(e) => {
              setNote(e.target.value);
              setSaved(false);
            }}
          />
          <div className="button-row">
            <small>{note.length.toLocaleString()} characters</small>
            <button className="primary" onClick={save}>
              <Save size={15} />
              Save notes
            </button>
          </div>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
      <div className="hint">
        <Settings2 size={15} />
        <span>
          Administrators can review file drops and manage releases in Settings →
          Development Studio.
        </span>
      </div>
    </>
  );
}
export default {
  id: "workspace",
  title: "Workspace",
  description: "Project notes and development resources.",
  component: Workspace,
} satisfies Feature;
