/**
 * Public path resolution for the static preview.
 *
 * The HTTP host serves only what this module allows. Everything else in the
 * repository (src/, tests/, docs/, infra/, package files, dotfiles, .git/)
 * is unreachable by construction: unknown paths are rejected, never mapped to
 * a fallback file.
 */
export interface PublicFile {
  kind: 'file';
  /** Repository-relative path using forward slashes. */
  relativePath: string;
  contentType: string;
  /** True for files that embed an inline script requiring a CSP hash. */
  inlineScript: boolean;
}

export interface PublicRejection {
  kind: 'reject';
  status: 400 | 404;
  reason: string;
}

export type PublicResolution = PublicFile | PublicRejection;

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/** Root files served by exact name. */
const ROOT_FILES: Readonly<Record<string, string>> = {
  '/': 'index.html',
  '/index.html': 'index.html',
};

/** Directories served with an extension allowlist. */
const PUBLIC_DIRECTORIES: readonly string[] = ['web/'];

/** Files under public directories that embed inline scripts (CSP hash needed). */
const INLINE_SCRIPT_FILES: ReadonlySet<string> = new Set<string>();

function reject(status: 400 | 404, reason: string): PublicRejection {
  return { kind: 'reject', status, reason };
}

export function resolvePublicPath(rawUrl: string | undefined): PublicResolution {
  const url = rawUrl ?? '/';
  const pathPart = url.split('?')[0]?.split('#')[0] ?? '/';
  if (pathPart.length === 0 || pathPart.length > 512) return reject(404, 'empty or oversized path');
  if (!pathPart.startsWith('/')) return reject(404, 'relative path');
  if (/%00|\0/.test(pathPart)) return reject(400, 'null byte');

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathPart);
  } catch {
    return reject(400, 'malformed percent-encoding');
  }
  if (/[\0\\]/.test(decoded)) return reject(400, 'control character or backslash');
  if (decoded.startsWith('//')) return reject(404, 'protocol-relative or absolute path');
  if (/%/.test(decoded) && /%[0-9a-fA-F]{2}/.test(decoded)) return reject(400, 'double-encoded path');

  const rootFile = ROOT_FILES[decoded];
  if (rootFile) return { kind: 'file', relativePath: rootFile, contentType: CONTENT_TYPES['.html'] ?? 'text/html', inlineScript: false };

  const segments = decoded.slice(1).split('/');
  for (const segment of segments) {
    if (segment.length === 0) return reject(404, 'empty path segment');
    if (segment === '.' || segment === '..') return reject(404, 'dot segment');
    if (segment.startsWith('.')) return reject(404, 'hidden file');
  }
  const relativePath = segments.join('/');
  if (!PUBLIC_DIRECTORIES.some((dir) => relativePath.startsWith(dir))) return reject(404, 'outside public directories');
  const last = segments[segments.length - 1] ?? '';
  const dot = last.lastIndexOf('.');
  const extension = dot >= 0 ? last.slice(dot).toLowerCase() : '';
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) return reject(404, 'extension not public');
  return { kind: 'file', relativePath, contentType, inlineScript: INLINE_SCRIPT_FILES.has(relativePath) };
}

export const STATIC_METHODS: readonly string[] = ['GET', 'HEAD'];
