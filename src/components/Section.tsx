import type { ReactNode } from "react";

export function Section({ id, title, intro, aside, children }: { id: string; title: string; intro?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="section" id={id} aria-labelledby={`${id}-title`}>
      <div className="section-head">
        <div className="stack" style={{ gap: "var(--space-1)" }}>
          <h2 id={`${id}-title`}>{title}</h2>
          {intro ? <p>{intro}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty" role="status">
      <strong>{title}</strong>
      {body ? <span>{body}</span> : null}
      {action}
    </div>
  );
}
