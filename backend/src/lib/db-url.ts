export function sanitizeDatabaseUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  let url = rawUrl;

  url = url.replace(/([?&]host=)([^&]+)/g, (match, prefix, hostVal) => {
    let decoded = hostVal;
    try {
      decoded = decodeURIComponent(hostVal);
    } catch {
      // ignore decode error
    }
    if (decoded.startsWith('/')) {
      const cleanPath = decoded.replace(/:\d+$/, '');
      return prefix + cleanPath;
    }
    return match;
  });

  if (url.includes('@/')) {
    const atIdx = url.indexOf('@/');
    const authPart = url.substring(0, atIdx + 1);
    const rest = url.substring(atIdx + 2);
    const [pathAndDb, ...queryParts] = rest.split('?');
    const lastSlashIdx = pathAndDb.lastIndexOf('/');
    if (lastSlashIdx !== -1) {
      let socketPath = '/' + pathAndDb.substring(0, lastSlashIdx);
      const dbName = pathAndDb.substring(lastSlashIdx + 1);
      socketPath = socketPath.replace(/:\d+$/, '');
      const existingQuery = queryParts.join('?');
      const queryStr = existingQuery ? `?${existingQuery}&host=${socketPath}` : `?host=${socketPath}`;
      url = `${authPart}localhost/${dbName}${queryStr}`;
    }
  }

  return url;
}

export function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    const sanitized = sanitizeDatabaseUrl(process.env.DATABASE_URL);
    process.env.DATABASE_URL = sanitized;
    return sanitized;
  }

  const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER;
  const password = process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD;
  const dbName = process.env.SQL_DB_NAME || 'cloud_sql_development_database';
  let host = process.env.SQL_HOST;

  if (user && password && host) {
    let url: string;
    if (host.startsWith('/')) {
      const cleanHost = host.replace(/:\d+$/, '');
      url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost/${dbName}?host=${cleanHost}`;
    } else {
      url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${dbName}`;
    }
    process.env.DATABASE_URL = url;
    return url;
  }

  return process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/intent';
}
