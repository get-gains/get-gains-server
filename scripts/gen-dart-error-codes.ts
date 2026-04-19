/**
 * gen-dart-error-codes.ts
 *
 * Reads ERROR_CODES from src/lib/errors/codes.ts and generates
 * a Dart enum at app/lib/core/errors/api_error_codes.dart.
 *
 * Usage: npx tsx scripts/gen-dart-error-codes.ts
 * (or via `npm run codegen:errors`)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ── 1. Load the canonical codes ──────────────────────────────────────
// Dynamic import won't work cleanly with as-const, so we regex-parse the file.
const codesFilePath = path.resolve(__dirname, '../src/lib/errors/codes.ts');
const codesSource = fs.readFileSync(codesFilePath, 'utf-8');

// Match every   KEY: 'VALUE'   or   KEY: "VALUE"   inside ERROR_CODES
const codeEntries: string[] = [];
const codeRegex = /^\s+(\w+):\s*['"](\w+)['"]/gm;
let match: RegExpExecArray | null;
while ((match = codeRegex.exec(codesSource)) !== null) {
  // Sanity: key and value should be the same string
  if (match[1] !== match[2]) {
    console.warn(`⚠ Key/value mismatch: ${match[1]} vs ${match[2]}`);
  }
  codeEntries.push(match[1]);
}

if (codeEntries.length === 0) {
  console.error('❌ No error codes found in codes.ts — aborting.');
  process.exit(1);
}

console.log(`✅ Parsed ${codeEntries.length} error codes from codes.ts`);

// ── 2. Convert SCREAMING_SNAKE to lowerCamelCase ─────────────────────
function toCamelCase(screaming: string): string {
  return screaming
    .toLowerCase()
    .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

// ── 3. Generate the Dart source ──────────────────────────────────────
const dartLines: string[] = [];

dartLines.push('// GENERATED FILE — DO NOT EDIT');
dartLines.push('// Re-generate via:  npm run codegen:errors  (in server/)');
dartLines.push('//');
dartLines.push(
  `// Source: src/lib/errors/codes.ts  (${codeEntries.length} codes)`
);
dartLines.push('');
dartLines.push(
  '/// Machine-readable error codes returned by the Get Gains API.'
);
dartLines.push('///');
dartLines.push('/// Each value maps 1-to-1 with the `code` field in the');
dartLines.push('/// `{ data, errors: [{ code, message, field? }] }` envelope.');
dartLines.push('enum ApiErrorCode {');

for (const code of codeEntries) {
  dartLines.push(`  /// \`${code}\``);
  dartLines.push(`  ${toCamelCase(code)}('${code}'),`);
}

// Unknown fallback
dartLines.push('');
dartLines.push(
  '  /// Fallback for codes added server-side but not yet in this enum.'
);
dartLines.push("  unknown('UNKNOWN');");
dartLines.push('');
dartLines.push('  const ApiErrorCode(this.value);');
dartLines.push('');
dartLines.push('  /// The raw SCREAMING_SNAKE_CASE string from the API.');
dartLines.push('  final String value;');
dartLines.push('');
dartLines.push(
  '  /// Parse a raw code string into the enum, falling back to [unknown].'
);
dartLines.push('  static ApiErrorCode fromString(String raw) {');
dartLines.push('    for (final code in values) {');
dartLines.push('      if (code.value == raw) return code;');
dartLines.push('    }');
dartLines.push('    return unknown;');
dartLines.push('  }');
dartLines.push('}');
dartLines.push('');

const dartSource = dartLines.join('\n');

// ── 4. Write to app/ repo ────────────────────────────────────────────
const outDir = path.resolve(__dirname, '../../app/lib/core/errors');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'api_error_codes.dart');
fs.writeFileSync(outFile, dartSource, 'utf-8');
console.log(`✅ Wrote ${outFile}`);
