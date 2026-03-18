### Data Pipeline Security Checks
1. **Credentials**: Hardcoded passwords/keys, credentials in Spark config, notebook widgets with secrets, JDBC strings with passwords
2. **Secrets Management**: `dbutils.secrets.get` usage, Key Vault integration, env variable injection mechanism, secret rotation
3. **Data Access**: Overly permissive storage access, mount points with broad access, Unity Catalog ACLs, row/column-level security
4. **Injection**: Spark SQL via f-strings, dynamic notebook execution, `%sh`/subprocess injection, JDBC SQL injection
5. **Sensitive Data**: PII in logs/`display()`, unmasked sensitive columns, unencrypted storage writes, data retention policies
6. **Network**: Public endpoint exposure, VNET injection, private endpoints, cluster internet access
7. **Azure-Specific**: Storage account keys vs Managed Identity, Synapse workspace security, Databricks PATs, Data Factory linked services
8. **Supply Chain**: Untrusted `pip install`, init scripts downloading binaries, committed `.whl`/`.jar` files
