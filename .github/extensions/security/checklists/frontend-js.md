### JavaScript Frontend Security Checks
1. **XSS**: `dangerouslySetInnerHTML`, `innerHTML`/`outerHTML`, `eval`/`new Function`, template literal injection, URL-based XSS, markdown rendering
   - ⚠️ **FP TRAP — dangerouslySetInnerHTML**: Using `dangerouslySetInnerHTML` is NOT inherently a vulnerability. Only flag when **user-controlled input** flows to it without sanitization. Hardcoded strings, build-time content, localized strings, and developer-attested usages are NOT XSS. Check if a sanitizer exists in the codebase (e.g., `SanitizeHtml.tsx`, `DOMPurify`) — if it exists but isn't used on a user-input path, that's a valid finding. If it's rendering static content, it's defense-in-depth advice at best (LOW), not a security finding.
2. **Auth & Session**: Token storage (`localStorage` vs `httpOnly` cookies), tokens in URLs, token expiration, client-side auth checks, logout cleanup
3. **Sensitive Data**: API keys in client code, `.env` files committed, hardcoded URLs with credentials, PII in storage, source maps in prod
4. **Dependencies**: Known CVEs in `package.json`, missing lockfile, untrusted packages, CDN scripts without SRI
5. **Input Validation**: Client-only validation, unsafe URL handling, file upload without validation, ReDoS, prototype pollution
6. **Misconfiguration**: CSP with `unsafe-inline`/`unsafe-eval`, debug tools in prod, HTTP URLs, clickjacking protection
7. **Azure AD / MSAL**: Authority config, `redirectUri`, token handling, multi-tenant validation
8. **CSRF**: Anti-CSRF tokens, `SameSite` cookies, OAuth state parameter
