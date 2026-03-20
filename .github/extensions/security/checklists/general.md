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
