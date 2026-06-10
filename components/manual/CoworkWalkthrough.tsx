import type { CoworkStep } from "@/lib/manual";

// An illustrative, step-by-step walkthrough of the Cowork flow for first-time
// users. The "windows" are stylized representations — NOT real screenshots —
// labelled as such so the page stays honest (see the brief's mock rule).
export function CoworkWalkthrough({ intro, steps }: { intro?: string; steps: CoworkStep[] }) {
  return (
    <div className="mn-cw">
      {intro && <p className="mn-cw-intro">{intro}</p>}

      <div className="mn-cw-steps">
        {steps.map((step, i) => (
          <div className="mn-cw-step" key={i}>
            <div className="mn-cw-num">{i + 1}</div>
            <div className="mn-cw-text">
              <h3>{step.title}</h3>
              <p>{step.caption}</p>
            </div>
            <div className="mn-cw-frame">
              <CoworkWindow>
                <StepView step={step} />
              </CoworkWindow>
            </div>
          </div>
        ))}
      </div>

      <p className="mn-cw-illus">Illustrative — a stylized view of the Cowork app, not a screenshot.</p>
    </div>
  );
}

function CoworkWindow({ children }: { children: React.ReactNode }) {
  return (
    <div className="cw-win" aria-hidden="true">
      <div className="cw-bar">
        <span className="cw-dot" />
        <span className="cw-dot" />
        <span className="cw-dot" />
        <span className="cw-bar-title">Claude · Cowork</span>
      </div>
      <div className="cw-body">{children}</div>
    </div>
  );
}

function StepView({ step }: { step: CoworkStep }) {
  switch (step.view) {
    case "pick-skill":
      return (
        <div className="cw-skills">
          <div className="cw-skills-head">Choose a skill</div>
          <div className="cw-skill is-picked">
            <span className="cw-skill-ico">$_</span>
            <span className="cw-skill-nm">{step.skillName}</span>
            <span className="cw-skill-state">ready</span>
          </div>
          {(step.otherSkills ?? []).map((s) => (
            <div className="cw-skill" key={s}>
              <span className="cw-skill-ico muted">$_</span>
              <span className="cw-skill-nm muted">{s}</span>
            </div>
          ))}
        </div>
      );

    case "drop-files":
      return (
        <div className="cw-drop">
          <div className="cw-drop-label">Files added to this chat</div>
          <div className="cw-files">
            {(step.files ?? []).map((f) => (
              <span className="cw-file" key={f}>
                <span className="cw-file-ico" />
                {f}
              </span>
            ))}
          </div>
          <div className="cw-drop-hint">Read in place — nothing leaves your computer.</div>
        </div>
      );

    case "compose":
      return (
        <div className="cw-chat">
          <div className="cw-msg you">
            <span className="cw-msg-who">You</span>
            <p>{step.typed}</p>
          </div>
          {step.question && (
            <div className="cw-msg claude">
              <span className="cw-msg-who">Claude</span>
              <p>{step.question}</p>
              <div className="cw-replies">
                <span className="cw-reply">Flag them</span>
                <span className="cw-reply ghost">Let me look</span>
              </div>
            </div>
          )}
        </div>
      );

    case "review":
      return (
        <div className="cw-review">
          <div className="cw-progress">
            <span className="cw-progress-done">Reading 220 lines</span>
            <span className="cw-progress-done">Cleaning + de-duplicating</span>
            <span className="cw-progress-done">Building the summary, live formulas</span>
          </div>
          <div className="cw-result">
            <span className="cw-result-check">✓</span>
            <div>
              <div className="cw-result-title">{step.resultTitle}</div>
              {step.resultMeta && <div className="cw-result-meta">{step.resultMeta}</div>}
            </div>
          </div>
        </div>
      );
  }
}
