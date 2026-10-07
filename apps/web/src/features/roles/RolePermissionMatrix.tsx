"use client";

import {
  ROLE_CRUD,
  groupModulesBySection,
  isCapabilityAvailable,
  type RoleCrud,
  type RoleMatrixSelection,
  type RolePageModule,
} from "@finance/permissions";

const CRUD_LABELS: Record<RoleCrud, string> = {
  read: "Read",
  write: "Write",
  edit: "Edit",
  delete: "Delete",
};

type Props = {
  selection: RoleMatrixSelection;
  onChange: (next: RoleMatrixSelection) => void;
  disabled?: boolean;
};

export function RolePermissionMatrix({ selection, onChange, disabled }: Props) {
  const groups = groupModulesBySection();

  function toggle(page: RolePageModule, crud: RoleCrud) {
    if (disabled || !isCapabilityAvailable(page, crud)) return;
    const current = selection[page.id] ?? {};
    const nextChecked = !current[crud];
    onChange({
      ...selection,
      [page.id]: { ...current, [crud]: nextChecked },
    });
  }

  function togglePageAll(page: RolePageModule, on: boolean) {
    if (disabled) return;
    const row: RoleMatrixSelection[string] = {};
    for (const crud of ROLE_CRUD) {
      if (isCapabilityAvailable(page, crud)) row[crud] = on;
    }
    onChange({ ...selection, [page.id]: row });
  }

  return (
    <div className="role-matrix" role="group" aria-label="Page permissions">
      <p className="muted role-matrix-hint">
        Check only what this role needs. Greyed-out cells are not available on that page — you cannot enable them by
        mistake.
      </p>
      <div className="role-matrix-scroll">
        <table className="role-matrix-table">
          <thead>
            <tr>
              <th scope="col">Page</th>
              {ROLE_CRUD.map((crud) => (
                <th key={crud} scope="col">
                  {CRUD_LABELS[crud]}
                </th>
              ))}
              <th scope="col" className="role-matrix-all">
                All
              </th>
            </tr>
          </thead>
          {groups.map(({ section, pages }) => (
            <tbody key={section}>
              <tr className="role-matrix-section">
                <th colSpan={6} scope="colgroup">
                  {section}
                </th>
              </tr>
              {pages.map((page) => {
                const row = selection[page.id] ?? {};
                const available = ROLE_CRUD.filter((crud) => isCapabilityAvailable(page, crud));
                const allOn = available.length > 0 && available.every((crud) => row[crud]);
                return (
                  <tr key={page.id}>
                    <th scope="row">
                      <span className="role-matrix-page">{page.label}</span>
                      {page.description ? <small className="muted">{page.description}</small> : null}
                    </th>
                    {ROLE_CRUD.map((crud) => {
                      const availableCell = isCapabilityAvailable(page, crud);
                      const hint = page.capabilities[crud]?.hint;
                      return (
                        <td key={crud} className={availableCell ? undefined : "role-matrix-na"}>
                          {availableCell ? (
                            <label className="role-matrix-check" title={hint}>
                              <input
                                type="checkbox"
                                checked={Boolean(row[crud])}
                                disabled={disabled}
                                onChange={() => toggle(page, crud)}
                                aria-label={`${page.label}: ${CRUD_LABELS[crud]}`}
                              />
                              <span className="sr-only">{CRUD_LABELS[crud]}</span>
                            </label>
                          ) : (
                            <span className="role-matrix-disabled" title="Not available on this page" aria-disabled="true">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="role-matrix-all">
                      {available.length ? (
                        <label className="role-matrix-check">
                          <input
                            type="checkbox"
                            checked={allOn}
                            disabled={disabled}
                            onChange={() => togglePageAll(page, !allOn)}
                            aria-label={`${page.label}: all available`}
                          />
                        </label>
                      ) : (
                        <span className="role-matrix-disabled">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

export function countSelectedCapabilities(selection: RoleMatrixSelection): number {
  let count = 0;
  for (const row of Object.values(selection)) {
    for (const crud of ROLE_CRUD) {
      if (row[crud]) count += 1;
    }
  }
  return count;
}
