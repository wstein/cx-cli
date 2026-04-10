import { XMLParser } from 'fast-xml-parser';

import { CxError } from '../shared/errors.js';

export interface ExtractedTextFile {
  path: string;
  content: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '#text',
});

function expectString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new CxError(`Invalid ${label} in section output.`, 8);
  }
  return value;
}

export function parseXmlSection(source: string): ExtractedTextFile[] {
  const parsed = xmlParser.parse(source) as {
    repomix?: {
      files?: {
        file?: Array<{ path?: string; '#text'?: string }> | { path?: string; '#text'?: string };
      };
    };
  };

  const fileNode = parsed.repomix?.files?.file;
  if (!fileNode) {
    return [];
  }

  const files = Array.isArray(fileNode) ? fileNode : [fileNode];
  return files.map((file) => ({
    path: expectString(file.path, 'file path'),
    content: typeof file['#text'] === 'string' ? file['#text'] : '',
  }));
}

export function parseJsonSection(source: string): ExtractedTextFile[] {
  const parsed = JSON.parse(source) as { files?: Record<string, unknown> };
  if (!parsed.files || typeof parsed.files !== 'object') {
    throw new CxError('Invalid JSON section output.', 8);
  }

  return Object.entries(parsed.files).map(([filePath, content]) => ({
    path: filePath,
    content: expectString(content, `content for ${filePath}`),
  }));
}
