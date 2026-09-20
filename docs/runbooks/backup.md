# Backup runbook

A backup stored on the same physical disk is not a real backup.

- Nightly `pg_dump` to a secondary disk / NAS
- Nightly `rsync` of `/data/finance-app/uploads`
- Verify restores periodically
