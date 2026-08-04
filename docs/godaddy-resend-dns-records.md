# GoDaddy DNS Records — Resend Domain Verification

Add these 4 records to the `telcovantage.com` domain in GoDaddy so Resend can
verify `erp.telcovantage.com` for sending transactional emails.

GoDaddy path: **Domain `telcovantage.com` → DNS → Add New Record** (one record
at a time).

| Type | Host | Value | Priority |
|------|------|-------|----------|
| TXT | `resend._domainkey.erp` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCyny0+zZZJj1LVPmn44/9Cj2katwgZJnP5MVF9qigshCUCuy5UBds5mXd5Ox6FpZxrM4IF6NOGc9rLeAau5AUeseyvIwzz1ly6nlxsFFo2IHr8Z2q+WjToE2TgqclqEcQsUZsFLIgLD/YjQQ8aavM3R+MSRDUNL5xlHmSe2iG0VwIDAQAB` | — |
| MX | `send.erp` | `feedback-smtp.ap-northeast-1.amazonses.com` | 10 |
| TXT | `send.erp` | `v=spf1 include:amazonses.com ~all` | — |
| MX | `erp` | `inbound-smtp.ap-northeast-1.amazonaws.com` | 10 |

Notes:

- GoDaddy may auto-append the domain to the Host field; if it does, use the
  shorter host (`resend._domainkey`, `send`, `erp`) so the final name still
  resolves to the full value above.
- TXT values must be pasted exactly, including the `p=` prefix and the
  `v=spf1` prefix — one TXT record per string, no quotes.
- After adding all 4 records, wait for propagation (minutes to a few hours),
  then verify at <https://resend.com/domains> → `erp.telcovantage.com` →
  **Verify**.
- Once verified, update `EMAIL_FROM` in `.env.local` and the deployed
  environment to `TVPH ERP <no-reply@erp.telcovantage.com>`. No code changes
  needed — the app reads `EMAIL_FROM` from env.
