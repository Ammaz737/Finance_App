# P0 Security Review

**Date:** 2026-09-21  
**Type:** Local application security review — **not** a penetration test or certification

---

## Findings summary

| Area | Assessment |
|---|---|
| Authentication | Session/JWT workspace login; ACTIVE user required |
| Authorization | `scopedWhere` + permission grants; entity/self/direct-reports |
| IDOR / unsafe refs | Mutations include `organizationId` in where clauses |
| Mass assignment | Domain actions use explicit field mapping / zod on several accounting paths |
| Uploads | Document upload gated by create permissions; malware scanner mock |
| Secrets in logs | Platform avoids logging passwords/tokens/PAN by design; redact in ResourcePage |
| XSS | React escaping; StatusBadge/text; avoid `dangerouslySetInnerHTML` in P0 pages audited |
| CSRF | Bearer token in Authorization header (not cookie session CSRF class) |
| CORS | API behind Next proxy `/api/v1` for browser |
| Rate limiting | Not production-hardened (deferred) |
| Tenant isolation | Covered by tenancy tests + Playwright negatives |
| Child resources | travel-bookings tenant scope when grant exists; trip checks in actions |

---

## Intentionally deferred

- Live card network / PCI
- Production JWT rotation / step-up MFA
- Formal pen test
- WAF / edge rate limits

---

## Residual risks (accept for P0)

1. Owner-only scaffold APIs still mount — mitigated by nav/route flags.  
2. Client-side ResourcePage filters are not a security boundary (API enforces).  
3. Mock providers must remain labeled SANDBOX.

---

## Result

**No critical P0 authz/IDOR defects identified in review.** Proceed to provider-integration milestone for production hardening.
