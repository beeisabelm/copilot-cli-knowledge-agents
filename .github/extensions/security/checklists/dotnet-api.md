### .NET API Security Checks
1. **Auth & Access Control**: `[Authorize]` on controllers, `[AllowAnonymous]` audit, middleware pipeline order, JWT validation config, role/policy checks
2. **Injection**: SQL via string interpolation, `FromSqlRaw` with concat, `Process.Start` with user args, path traversal via `Path.Combine`
3. **Sensitive Data**: Hardcoded connection strings/keys, exception details in responses, PII in logs, env variable disclosure endpoints
   - ⚠️ **FP TRAP — Exception logging**: `Log.WriteLog(..., ex)` is NOT inherently a vulnerability. Only flag when the exception message **demonstrably contains PII** (email addresses, tenant IDs, file paths with usernames). Generic exception logging is informational, not a security finding. If flagging, cite the **exact line** and the **specific PII type** that could leak. Note: developers can wrap known-PII exceptions in `PIIException` — check for this compensating control before flagging.
   - ⚠️ **FP TRAP — ex.Message in responses**: Only flag `ex.Message`/`ex.ToString()` returned in HTTP responses when the endpoint is **externally accessible** and the exception could contain internal paths, connection strings, or stack traces. Internal-only admin endpoints with proper auth are lower risk.
4. **SSRF**: User-controlled URLs in `HttpClient`/`WebClient`, unvalidated redirects
5. **Misconfiguration**: CORS (`AllowAnyOrigin`), missing HTTPS redirect, `UseDeveloperExceptionPage` without env guard, Swagger in prod, rate limiting
   - ⚠️ **FP TRAP — CORS Origin:null**: `EnableCorsForOriginAsNull` or allowing `Origin: null` can be **intentional** for sandboxed iframes (e.g., Azure portal embedding). Only flag as a vulnerability when combined with an **actually exploitable endpoint** and no other access controls. Don't build attack chains on CORS alone — verify the chained endpoint is actually vulnerable first.
6. **Azure-Specific**: Managed Identity vs connection strings, Key Vault usage, App Service settings, Service Bus/Storage auth
7. **Dependencies**: NuGet CVEs, EOL framework versions, untrusted package sources
8. **API-Specific**: Missing model validation, mass assignment, excessive data exposure, unrestricted file upload
