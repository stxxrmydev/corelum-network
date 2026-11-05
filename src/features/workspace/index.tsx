import { Layers3, Plus, ArrowUpRight } from "lucide-react";
import type { Feature } from "../../core/types";
function Workspace() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE ROOM FOR WHAT’S NEXT</span>
          <h1>Your workspace</h1>
          <p>A clean foundation for your next big idea.</p>
        </div>
        <span className="badge">Foundation</span>
      </div>
      <section className="empty-workspace panel">
        <div className="workspace-art">
          <Layers3 size={48} />
          <span className="orbit o1" />
          <span className="orbit o2" />
        </div>
        <h2>Good things start with space.</h2>
        <p>
          New tools and pages arrive here through signed application updates.
          <br />
          Your workspace grows with you.
        </p>
        <div className="pill">
          <Plus size={14} /> Ready for your first module
        </div>
      </section>
      <div className="hint">
        <ArrowUpRight size={17} />
        <span>
          Administrators can introduce features in Settings → Development &
          Updates.
        </span>
      </div>
    </>
  );
}
export default {
  id: "workspace",
  title: "Workspace",
  description: "A place for your next idea.",
  component: Workspace,
} satisfies Feature;
