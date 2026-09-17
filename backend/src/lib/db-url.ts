export function sanitizeDatabaseUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  let url = rawUrl;

  // 1. If authority contains encoded or raw socket path (e.g. @%2Fapp%2Fcloudsql... or @/app/cloudsql...)
  const atIdx = url.indexOf('@');
  if (atIdx !== -1) {
    const authPart = url.substring(0, atIdx + 1);
    const rest = url.substring(atIdx + 1);

    const [hostAndPath, ...queryParts] = rest.split('?');
    const existingQuery = queryParts.join('?');

    let decodedHostAndPath = hostAndPath;
    try {
      decodedHostAndPath = decodeURIComponent(hostAndPath);
    } catch {
      // ignore
    }

    if (decodedHostAndPath.includes('/cloudsql/')) {
      const lastSlashIdx = decodedHostAndPath.lastIndexOf('/');
      let socketPath = decodedHostAndPath.substring(0, lastSlashIdx);
      const dbName = decodedHostAndPath.substring(lastSlashIdx + 1);

      if (!socketPath.startsWith('/')) {
        socketPath = '/' + socketPath;
      }
      socketPath = socketPath.replace(/:\d+$/, '').replace(/\/\.s\.PGSQL\.\d+$/, '');

      const queryParams = new URLSearchParams(existingQuery);
      queryParams.set('host', socketPath);
      url = `${authPart}localhost/${dbName}?${queryParams.toString()}`;
    }
  }

  // 2. Clean ?host= or &host= query param if present
  url = url.replace(/([?&]host=)([^&]+)/g, (match, prefix, hostVal) => {
    let decoded = hostVal;
    try {
      decoded = decodeURIComponent(hostVal);
    } catch {
      // ignore
    }
    if (decoded.startsWith('/')) {
      const cleanPath = decoded.replace(/:\d+$/, '').replace(/\/\.s\.PGSQL\.\d+$/, '');
      return prefix + cleanPath;
    }
    return match;
  });

  // 3. If url has @/dbname (missing localhost host)
  if (url.includes('@/')) {
    url = url.replace('@/', '@localhost/');
  }

  // 4. If url has @localhost:5432/... with ?host=/... or &host=/..., remove :5432 from authority
  if (url.includes('host=/') || url.includes('host=%2F')) {
    url = url.replace('@localhost:5432/', '@localhost/');
  }

  return url;
}

export function resolveDatabaseUrl(): string {
  const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER;
  const password = process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD;
  const dbName = process.env.SQL_DB_NAME || 'cloud_sql_development_database';
  const host = process.env.SQL_HOST;

  if (user && password && host) {
    let url: string;
    if (host.startsWith('/')) {
      const cleanHost = host.replace(/:\d+$/, '').replace(/\/\.s\.PGSQL\.\d+$/, '');
      url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost/${dbName}?host=${cleanHost}`;
    } else {
      url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${dbName}`;
    }
    process.env.DATABASE_URL = url;
    return url;
  }

  if (process.env.DATABASE_URL) {
    const sanitized = sanitizeDatabaseUrl(process.env.DATABASE_URL);
    process.env.DATABASE_URL = sanitized;
    return sanitized;
  }

  return process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/intent';
}
