# P0 Accessibility Report

**Date:** 2026-09-21  
**Target:** WCAG 2.2 AA *directionally* (not certified)

---

## Implemented affordances

| Control | Status |
|---|---|
| Skip link to `#main-content` | Present (`globals.css` + app layout) |
| `aria-current` on active nav | Present |
| `aria-label` on notifications / filters | Present on key controls |
| Form labels in ResourcePage create drawer | Present |
| `role="alert"` / `role="status"` on errors & notices | Present |
| Access denied panel | Present; distinguishes P1/P2 vs 403 |
| StatusBadge (text status, not color-only) | Present |
| Empty states for filtered tables | Added in closure |

---

## Gaps (tracked, non-blocking for P0)

| Gap | Notes |
|---|---|
| Automated axe/playwright a11y smoke | Not wired in CI |
| Focus trap in DrawerReview | Needs focused keyboard audit |
| Table column headers + sort announcements | Basic DataTable; advanced grid a11y deferred |
| Reduced-motion preference | Not systematically applied |
| Contrast audit across all themes | Spot-check only |

---

## Result

**Directional AA pass for core P0 chrome.** Remaining items are polish, not product blockers.
