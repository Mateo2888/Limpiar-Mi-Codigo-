const path = 'https://example.com/api // not a comment';
const separator = '// this looks like a comment but is a string value';

function buildUrl(base: string, segment: string): string {
  return `${base}//${segment}`;
}
