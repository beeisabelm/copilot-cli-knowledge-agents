### General Security Checks

Apply standard OWASP Top 10 and CWE Top 25 checks adapted to whatever tech stack is present.

1. **Authentication & Access Control**: Default-deny posture, session management, credential storage, privilege separation, admin endpoint protection
2. **Secrets Management**: Hardcoded credentials in source, `.env` files committed, API keys in client bundles, unrotated tokens, secrets in CI/CD logs
3. **Input Validation & Injection**: SQL/command/template injection, path traversal, deserialization of untrusted data, SSRF via user-controlled URLs
4. **Cryptography**: Weak algorithms (MD5/SHA1 for security), missing encryption at rest/in transit, self-signed certs in prod, predictable random values
5. **Error Handling & Information Disclosure**: Stack traces in responses, verbose error messages leaking internals, debug endpoints in prod, version headers exposed
6. **Dependency Security**: Known CVEs in dependencies, unpinned versions, untrusted package sources, missing lockfiles
7. **Logging & Monitoring**: Missing security event logging, PII in logs, insufficient audit trail for sensitive operations, no alerting on auth failures
8. **Configuration Security**: Default credentials, debug mode in production, permissive CORS, missing security headers (CSP, HSTS, X-Frame-Options)

#### Cross-Cutting Concerns
- **Attack Chain Thinking**: Check if individually minor issues combine into exploitable paths (e.g., verbose errors + SSRF + missing internal auth)
- **Defense-in-Depth Gaps**: For each control, verify a backup exists if it fails
- **Trust Boundary Analysis**: Identify where untrusted input meets trusted processing

### Input Validation Evasion Checks
When reviewing input validation, filters, or denylists, verify they handle these bypass techniques:
1. **Encoding bypass**: Payloads wrapped in Base64, URL-encoding, HTML entities, or double-encoded to evade pattern matching
2. **Unicode confusables**: Lookalike characters from other scripts (`а` Cyrillic vs `a` Latin) substituted to bypass exact-match filters
3. **Zero-width characters**: Invisible Unicode characters (U+200B, U+FEFF) injected to break token matching or keyword detection
4. **Homoglyph URLs**: Visually identical domain names using mixed scripts for phishing or SSRF allowlist bypass
5. **Case manipulation**: Mixed-case payloads against case-sensitive denylists (`ScRiPt` vs `script`)
6. **Character substitution**: Leetspeak, diacritics, or confusable-homoglyphs to evade content filters (`scrīpt`, `scr1pt`)
7. **Null byte injection**: `%00` to truncate strings at validation boundaries while downstream processing uses the full string
8. **Nested encoding**: Encoding within encoding (Base64 inside JSON inside URL params) to bypass single-pass decoders

### Data Leakage Vector Checks
Verify the system doesn't inadvertently expose protected data:
1. **Verbose error disclosure**: Stack traces, connection strings, internal paths, or schema details in error responses
2. **Configuration extraction**: Debug endpoints, status pages, or admin panels that reveal system configuration
3. **Session/context bleed**: Data from one user's session leaking into another's through shared caches, connection pools, or logging
4. **Credential leakage**: Secrets exposed via SSRF to cloud metadata services (169.254.169.254), `.env` files, or git history
5. **Excessive API responses**: Endpoints returning more fields than the client needs (internal IDs, timestamps, soft-deleted records)
6. **Logging PII**: Personally identifiable information written to logs, telemetry, or monitoring systems without scrubbing

### Control Effectiveness Checks
For every security control found, verify it actually enforces (not just logs):
1. **Auth controls**: Does middleware return 401/403 and halt the request, or continue with a warning?
2. **Input validation**: Does validation reject and return an error, or silently sanitize and proceed?
3. **Rate limiting**: Does it return 429 and block, or just increment a counter for observability?
4. **CORS enforcement**: Does it block cross-origin requests, or only emit console warnings?
5. **Error suppression**: Do error handlers return generic messages to clients, or leak details despite the *intent* to suppress?

A control that observes but doesn't enforce is equivalent to no control from an attacker's perspective.
