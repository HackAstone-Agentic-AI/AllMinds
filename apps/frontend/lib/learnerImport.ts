import { findPii } from '@/lib/pii';

// Columns whose header alone says they hold identifying information.
const PII_HEADER_RULES: { match: RegExp; reason: string; canPseudonymise: boolean }[] = [
  { match: /^(full\s*name|name|learner\s*name|student\s*name|first\s*name|given\s*name)$/i, reason: 'Learner name', canPseudonymise: true },
  { match: /surname|last\s*name|family\s*name/i, reason: 'Surname', canPseudonymise: false },
  { match: /\bid\s*(number|no)\b|identity|passport|birth\s*cert/i, reason: 'ID number', canPseudonymise: false },
  { match: /e-?mail/i, reason: 'E-mail address', canPseudonymise: false },
  { match: /phone|cell|mobile|contact\s*(number|no)/i, reason: 'Phone number', canPseudonymise: false },
  { match: /address|street|suburb/i, reason: 'Address', canPseudonymise: false },
  { match: /parent|guardian|mother|father|caregiver/i, reason: 'Parent or guardian details', canPseudonymise: false },
  { match: /date\s*of\s*birth|\bdob\b|birth\s*date/i, reason: 'Date of birth', canPseudonymise: false },
];

// Profile fields the app reads as lists (chips in analytics, AI context).
const LIST_FIELDS: Record<string, string> = {
  supportneeds: 'supportNeeds',
  supportneed: 'supportNeeds',
  learningsupportneeds: 'supportNeeds',
  strengths: 'strengths',
  learnerstrengths: 'strengths',
  neurotypetags: 'neurotypeTags',
  neurotype: 'neurotypeTags',
  profile: 'neurotypeTags',
  conditions: 'neurotypeTags',
};

export type ColumnAction = 'keep' | 'remove' | 'pseudonym';

export interface PiiColumn {
  header: string;
  reason: string;
  canPseudonymise: boolean;
}

const ID_HEADERS = ['anonymous_id', 'Anonymous ID', 'AnonymousID', 'learner_id'];

export function detectPiiColumns(headers: string[], rows: Record<string, unknown>[]): PiiColumn[] {
  const found: PiiColumn[] = [];
  for (const header of headers) {
    if (ID_HEADERS.includes(header)) continue;
    const rule = PII_HEADER_RULES.find((r) => r.match.test(header.trim()));
    if (rule) {
      found.push({ header, reason: rule.reason, canPseudonymise: rule.canPseudonymise });
      continue;
    }
    // Values can reveal PII even when the header looks harmless (e.g. a "notes" column with phone numbers).
    const hits = new Set<string>();
    for (const row of rows.slice(0, 200)) {
      findPii(String(row[header] ?? '')).forEach((hit) => hits.add(hit));
    }
    if (hits.size > 0) {
      found.push({ header, reason: `Contains ${Array.from(hits).join(', ')}`, canPseudonymise: false });
    }
  }
  return found;
}

// "Sipho Dlamini" -> "Sipho D." so teachers still recognise the learner without a full name.
export function toPseudonym(value: unknown): string {
  const parts = String(value ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

const normaliseKey = (key: string) => key.toLowerCase().replace(/[^a-z]/g, '');

export function applyColumnActions(
  rows: Record<string, unknown>[],
  actions: Record<string, ColumnAction>,
): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const action = actions[key] ?? 'keep';
      if (action === 'remove') continue;
      if (action === 'pseudonym') {
        const pseudonym = toPseudonym(value);
        if (pseudonym) out.pseudonym = pseudonym;
        continue;
      }
      const listField = LIST_FIELDS[normaliseKey(key)];
      if (listField && typeof value === 'string') {
        out[listField] = value.split(/[;,|]/).map((item) => item.trim()).filter(Boolean);
      } else if (normaliseKey(key) === 'grade' || normaliseKey(key) === 'gradelevel') {
        out.grade = value;
      } else {
        out[key] = value;
      }
    }
    return out;
  });
}

const csvCell = (value: unknown) => {
  const text = Array.isArray(value) ? value.join('; ') : value == null ? '' : String(value);
  // Quote when needed and neutralise spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  return [headers.map(csvCell).join(','), ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(','))].join('\n');
}

export const LEARNER_TEMPLATE_HEADERS = [
  'anonymous_id',
  'pseudonym',
  'grade',
  'neurotypeTags',
  'supportNeeds',
  'strengths',
  'recentNotes',
];

export const LEARNER_TEMPLATE_EXAMPLE: Record<string, unknown> = {
  anonymous_id: 'LRN-001',
  pseudonym: 'Learner A',
  grade: 'Grade 2',
  neurotypeTags: 'ADHD',
  supportNeeds: 'Movement breaks; Chunked instructions',
  strengths: 'Storytelling; Helping peers',
  recentNotes: 'Settles well with a visual timer',
};

// Compared after normaliseKey(), so "Anonymous ID", "anonymous_id" and "AnonymousID" all match.
const ID_KEYS = ['anonymousid', 'learnerid'];
const NAME_KEYS = [
  'pseudonym', 'preferredname', 'learnername', 'studentname', 'displayname',
  'fullname', 'name', 'firstname', 'givenname',
];

const firstValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const [key, value] of Object.entries(row)) {
    if (!keys.includes(normaliseKey(key))) continue;
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
};

export interface RowIssue {
  row: number; // spreadsheet row number (header is row 1)
  reason: string;
}

// A learner record needs at least an ID or a name/pseudonym; IDs must be unique within
// the file and must not already exist for this teacher. Invalid rows are skipped and listed.
export function validateLearnerRows(
  rows: Record<string, unknown>[],
  existingIds: Set<string>,
): { validIndexes: number[]; issues: RowIssue[] } {
  const validIndexes: number[] = [];
  const issues: RowIssue[] = [];
  const seen = new Map<string, number>();
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const id = firstValue(row, ID_KEYS);
    const name = firstValue(row, NAME_KEYS);
    if (!id && !name) {
      issues.push({ row: rowNumber, reason: 'No learner ID or name' });
      return;
    }
    if (id) {
      const key = id.toLowerCase();
      if (seen.has(key)) {
        issues.push({ row: rowNumber, reason: `Duplicate ID "${id}" (same as row ${seen.get(key)})` });
        return;
      }
      seen.set(key, rowNumber);
      if (existingIds.has(key)) {
        issues.push({ row: rowNumber, reason: `ID "${id}" already exists in your learner profiles` });
        return;
      }
    }
    validIndexes.push(index);
  });
  return { validIndexes, issues };
}
