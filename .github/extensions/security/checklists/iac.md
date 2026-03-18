### Infrastructure-as-Code Security Checks
1. **Storage**: Anonymous/public access, HTTPS enforcement, encryption, network rules (`defaultAction: Allow`), shared key access
2. **Networking**: Public IPs, NSG rules (SSH/RDP from `0.0.0.0/0`), missing NSGs on subnets, private endpoints, VNET config
3. **IAM**: Managed Identity, hardcoded credentials in templates, overly broad RBAC (Owner/Contributor at subscription), missing `principalType`
4. **Key Vault**: Soft delete + purge protection, access policies vs RBAC, public network access, diagnostics logging
5. **App Service**: TLS 1.2+, HTTPS only, remote debugging disabled, FTP disabled, IP restrictions, Managed Identity
6. **SQL**: Public network access, firewall rules, Azure AD-only auth, TDE, auditing, TLS 1.2
7. **Containers**: Privileged containers, resource limits, image source (private ACR vs Docker Hub), AKS RBAC/private API
8. **Pipelines**: Secrets in plain text, missing approval gates, service connection scope, template references without commit pinning
9. **General**: Hardcoded values, missing `minTlsVersion`, disabled diagnostics, missing tags, secure parameters, output exposure
