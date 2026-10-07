"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ROLE_SCOPES,
  permissionKeysFromSelection,
  type RoleMatrixSelection,
  type RoleScope,
} from "@finance/permissions";
import { RolePermissionMatrix, countSelectedCapabilities } from "./RolePermissionMatrix";

export type RoleBuilderValues = {
  name: string;
  description: string;
  scope: RoleScope;
  selection: RoleMatrixSelection;
};

type Props = {
  mode: "create" | "edit";
  initial: RoleBuilderValues;
  systemRole?: boolean;
  submitting?: boolean;
  error?: string;
  onSubmit: (values: RoleBuilderValues) => void;
  onCancel?: () => void;
  /** When true, skip the multi-step funnel (used on edit detail). */
  singlePage?: boolean;
};

const STEPS = [
  { id: "identity", label: "Name" },
  { id: "permissions", label: "Permissions" },
  { id: "scope", label: "Scope" },
  { id: "review", label: "Review" },
] as const;

export function RoleBuilderForm({
  mode,
  initial,
  systemRole,
  submitting,
  error,
  onSubmit,
  onCancel,
  singlePage,
}: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [scope, setScope] = useState<RoleScope>(initial.scope);
  const [selection, setSelection] = useState<RoleMatrixSelection>(initial.selection);
  const [localError, setLocalError] = useState("");

  const selectedCount = useMemo(() => countSelectedCapabilities(selection), [selection]);
  const keys = useMemo(() => permissionKeysFromSelection(selection), [selection]);

  function validateIdentity() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setLocalError("Enter a role name (at least 2 characters).");
      return false;
    }
    setLocalError("");
    return true;
  }

  function validatePermissions() {
    if (!selectedCount) {
      setLocalError("Select at least one available permission. Disabled cells cannot be used.");
      return false;
    }
    setLocalError("");
    return true;
  }

  function goNext() {
    if (step === 0 && !validateIdentity()) return;
    if (step === 1 && !validatePermissions()) return;
    setLocalError("");
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goBack() {
    setLocalError("");
    setStep((current) => Math.max(current - 1, 0));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!validateIdentity() || !validatePermissions()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      scope,
      selection,
    });
  }

  const displayError = error || localError;

  if (singlePage) {
    return (
      <form className="stack-lg role-builder" onSubmit={submit}>
        <section className="work-panel">
          <h2>Role details</h2>
          <div className="form-grid">
            <label>
              Role name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={systemRole || submitting}
                required
                maxLength={80}
                placeholder="e.g. AP Clerk"
              />
            </label>
            <label>
              Description
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={submitting}
                maxLength={240}
                placeholder="What this role can do"
              />
            </label>
            <label>
              Default scope
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value as RoleScope)}
                disabled={submitting}
              >
                {ROLE_SCOPES.map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {systemRole ? (
            <p className="muted" style={{ marginTop: 12 }}>
              System role name is locked. You can still adjust permissions and scope.
            </p>
          ) : null}
        </section>

        <section className="work-panel">
          <h2>Page permissions</h2>
          <RolePermissionMatrix selection={selection} onChange={setSelection} disabled={submitting} />
          <p className="muted" style={{ marginTop: 12 }}>
            {selectedCount} capability cell(s) · {keys.length} domain permission key(s)
          </p>
        </section>

        {displayError ? (
          <p className="error-panel" role="alert">
            {displayError}
          </p>
        ) : null}

        <div className="detail-actions-top">
          {onCancel ? (
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : mode === "create" ? "Create role" : "Save changes"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="stack-lg role-builder" onSubmit={submit}>
      <ol className="role-funnel-steps" aria-label="Create role steps">
        {STEPS.map((item, index) => (
          <li key={item.id} className={index === step ? "is-active" : index < step ? "is-done" : undefined}>
            <span className="role-funnel-index">{index + 1}</span>
            <span>{item.label}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="work-panel">
          <h2>Name this role</h2>
          <p className="muted">Roles are additive — assign them to people after creation.</p>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <label>
              Role name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
                required
                maxLength={80}
                placeholder="e.g. Travel Approver"
              />
            </label>
            <label>
              Description
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={240}
                placeholder="Optional short summary"
              />
            </label>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="work-panel">
          <h2>Choose page permissions</h2>
          <RolePermissionMatrix selection={selection} onChange={setSelection} />
        </section>
      )}

      {step === 2 && (
        <section className="work-panel">
          <h2>Default scope</h2>
          <p className="muted">
            Scope limits how far each granted permission reaches (self, reports, entity, or whole organization).
          </p>
          <label style={{ display: "grid", gap: 8, maxWidth: 360, marginTop: 16 }}>
            Scope
            <select value={scope} onChange={(event) => setScope(event.target.value as RoleScope)}>
              {ROLE_SCOPES.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      {step === 3 && (
        <section className="work-panel">
          <h2>Review</h2>
          <dl className="role-review-list">
            <div>
              <dt>Name</dt>
              <dd>{name.trim() || "—"}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{description.trim() || "—"}</dd>
            </div>
            <div>
              <dt>Scope</dt>
              <dd>{scope.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Permissions</dt>
              <dd>
                {selectedCount} capability cell(s) → {keys.length} key(s)
                <ul className="plain-list" style={{ marginTop: 8 }}>
                  {keys.map((key) => (
                    <li key={key}>
                      <code>{key}</code>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </section>
      )}

      {displayError ? (
        <p className="error-panel" role="alert">
          {displayError}
        </p>
      ) : null}

      <div className="detail-actions-top">
        {step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={goBack} disabled={submitting}>
            Back
          </button>
        ) : onCancel ? (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn-primary" onClick={goNext}>
            Continue
          </button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create role"}
          </button>
        )}
      </div>
    </form>
  );
}
