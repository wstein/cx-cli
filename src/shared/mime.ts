import path from 'node:path';

const MIME_TYPES = new Map<string, string>([
  ['.c', 'text/x-c'],
  ['.cc', 'text/x-c++'],
  ['.cpp', 'text/x-c++'],
  ['.css', 'text/css'],
  ['.go', 'text/x-go'],
  ['.gif', 'image/gif'],
  ['.h', 'text/x-c'],
  ['.html', 'text/html'],
  ['.java', 'text/x-java-source'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript'],
  ['.json', 'application/json'],
  ['.kt', 'text/x-kotlin'],
  ['.mjs', 'text/javascript'],
  ['.md', 'text/markdown'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.py', 'text/x-python'],
  ['.rs', 'text/x-rust'],
  ['.svg', 'image/svg+xml'],
  ['.toml', 'application/toml'],
  ['.ts', 'text/typescript'],
  ['.tsx', 'text/tsx'],
  ['.txt', 'text/plain'],
  ['.webp', 'image/webp'],
  ['.xml', 'application/xml'],
  ['.yaml', 'application/yaml'],
  ['.yml', 'application/yaml'],
]);

export function detectMediaType(filePath: string, kind: 'text' | 'asset'): string {
  const extension = path.extname(filePath).toLowerCase();
  return MIME_TYPES.get(extension) ?? (kind === 'asset' ? 'application/octet-stream' : 'text/plain');
}
