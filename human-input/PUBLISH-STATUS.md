# Marketplace Publication — Status & Runbook

Live tracker for publishing **Databricks Sync for Sheets** to the Google Workspace
Marketplace. Spec: https://docs.google.com/document/d/1pGYaFncKuHRdawt8OPozqLr2G3PIxaPrClx509EJ7QU/edit

## Locked configuration

| Item | Value |
| --- | --- |
| Publisher identity | Vijay Balasubramaniam / vbalasu.com / support@vbalasu.com |
| Google account | vbalasu@gmail.com |
| GCP project | `databricks-sync-sheets` (number **622786402076**) |
| APIs enabled | Google Workspace Marketplace SDK, Apps Script API |
| Billing | Not required (free add-on) |
| Apps Script | container-bound; scriptId `1uTp_IpTLrc-xkuvvK6jrF9lpwueUYlg03JURM3DM8lMwJt7dXPkh6c4a` |
| Container sheet | `1JR1AFPB9LnqjAm0yvGCdE2AymtdMnVPTPrEoPNFqvh4` |
| Listing deployment | version **@1** (`AKfycbz0FZsjfT5QtS-V5xYhSz3Mn1hSeWpy5eVfo5Xa6euwsYaqOi0b4qIldrGzNw7-Xcs`) |
| OAuth scopes (3) | `spreadsheets.currentonly`, `script.container.ui`, `script.external_request` |
| Distribution | Dual channel: (1) existing Template-Copy `/copy` link, (2) new public Marketplace listing |

## Steps

- [x] 1. Create dedicated GCP project — DONE
- [x] 2. Enable Marketplace SDK + Apps Script API — DONE
- [x] 7. Push code (incl. formula-injection fix) + create versioned deployment @1 — DONE
- [x] 3. Link Apps Script → GCP project number `622786402076` — DONE
- [x] 4. Configure OAuth consent screen (External) — DONE. App info, Audience=External, Contact, Branding (home/privacy/ToS URLs + authorized domain vbalasu.com), Data Access (3 scopes) all saved. Logo deferred (needs artwork; adding it can trigger verification). Still to do before testing: add test user vbalasu@gmail.com under Audience.
- [x] 5. Verify `vbalasu.com` in Google Search Console — DONE (already a verified Domain property under vbalasu@gmail.com)
- [ ] 6. **USER**: Host privacy policy + ToS at stable `vbalasu.com` URLs
- [ ] 8. **USER**: Prepare listing assets — 128×128 icon (+96/48), banner, 1–5 screenshots
- [ ] 9. **USER**: Configure Marketplace store listing in the Marketplace SDK (script ID + version @1, copy, scopes, URLs, assets)
- [ ] 10. **USER**: Record 2–3 min OAuth demo video showing each sensitive scope in use
- [ ] 11. **USER → Google**: Submit OAuth verification (video + scope justifications) — review takes days–weeks
- [ ] 12. **USER → Google**: Submit store listing → publish live (after OAuth verification passes)

## Notes
- Steps 3–12 are Google-console UI / DNS / Google-review gated — no CLI/API automation available.
- Keep the OAuth app in "Testing" with test users until verification passes; validate read + writeback + Lakebase end to end first.
