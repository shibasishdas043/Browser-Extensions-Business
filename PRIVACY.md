# Privacy Policy for ZenWeb - Digital Peace Suite

**Effective Date:** September 28, 2026  
**Last Updated:** September 28, 2026  

ZenWeb ("we", "our", or "the extension") is committed to complete user privacy and transparency. This Privacy Policy describes how ZenWeb handles user information.

---

## 1. Zero Data Collection Policy
ZenWeb is designed from the ground up as a **zero-telemetry, zero-collection** browser utility.

- **We do NOT collect personal information:** We do not collect names, email addresses, physical addresses, IP addresses, or any personally identifiable information (PII).
- **We do NOT track your browsing:** We do not log, track, or inspect your browsing history, visited URLs, web searches, or online activities.
- **We do NOT use analytics or tracking tools:** There are no third-party trackers, Google Analytics, telemetry pings, tracking pixels, or session recording scripts in ZenWeb.
- **We do NOT operate remote data servers:** ZenWeb does not communicate with any external backend servers or cloud databases.

---

## 2. On-Device Sandboxed Storage
ZenWeb operates entirely on your local device. The extension utilizes the browser's built-in `chrome.storage.local` API solely for the following local, non-transmitted purposes:

1. **User Preferences & Toggles:** Storing your personal shield preferences (e.g. enabling or disabling specific shields) and custom domain whitelists.
2. **Local Counter Statistics:** Maintaining a local numeric counter of distractions suppressed on your device (e.g. videos suppressed, fake download buttons defused).
3. **Form Salvager & Crash Guard:** Temporarily saving draft text typed into standard web forms to prevent accidental data loss caused by tab crashes, unexpected reloads, or closed windows.
   - **Sensitive Data Exclusion:** Form Salvager incorporates strict regex filters that explicitly **blacklist and ignore** passwords, credit card numbers, CVVs, PINs, OTPs, and authentication tokens. These are NEVER saved.
   - **Expiration & Clearing:** Saved drafts are stored only in your private browser sandbox, expire automatically after 48 hours, and can be cleared at any time by clicking "Purge All Drafts" in the extension settings dashboard.

All data saved in `chrome.storage.local` remains strictly on your local computer and is never shared, synced, or transmitted outside your browser.

---

## 3. Third-Party Sharing and Sale of Data
Because ZenWeb does not collect any user data:
- We **never** sell, rent, monetize, or trade user data.
- We **never** transfer user data to third parties, data brokers, or advertising networks.
- We **never** use user data for creditworthiness, lending, or profiling purposes.

---

## 4. Permissions Usage
ZenWeb requests only the minimal permissions necessary to perform its advertised functions:
- `storage`: Required to save user settings, whitelist domains, distraction counts, and local form draft checkpoints on your device.
- `activeTab`: Used to allow user-initiated keyboard shortcuts (such as `Alt+Shift+J` for the Recipe Quick View) to interact with the active tab.
- `contextMenus`: Used to provide convenient right-click menu items ("Jump to Recipe", "Open Saved Drafts Vault", "ZenWeb Settings").
- `host_permissions` (`https://*/*`, `http://*/*`): Required to inspect the DOM on web pages you browse in order to identify and remove recipe fluff, dock floating videos, neutralize deceptive download traps, and offer form draft recovery across the open web. No page content or URL data is ever transmitted or logged.

---

## 5. Security
ZenWeb is built strictly according to Chrome Manifest V3 security standards. The extension executes zero remote code, does not load external CDN scripts, enforces strict Content Security Policies (`script-src 'self'`), and constructs all injected user interface elements using safe DOM APIs to eliminate cross-site scripting (XSS) risks.

---

## 6. Children's Privacy
ZenWeb does not collect any personal data from anyone, including children under the age of 13.

---

## 7. Changes to this Policy
If we make changes to this Privacy Policy, the updated version will be posted here with an updated "Last Updated" date.

---

## 8. Contact & Open Source Inquiries
If you have questions or concerns regarding this Privacy Policy or ZenWeb's privacy practices, please contact us or submit an issue on our official repository:
- **Repository:** [https://github.com/shibasishdas043/Browser-Extensions-Business](https://github.com/shibasishdas043/Browser-Extensions-Business)
- **Issues:** [https://github.com/shibasishdas043/Browser-Extensions-Business/issues](https://github.com/shibasishdas043/Browser-Extensions-Business/issues)
