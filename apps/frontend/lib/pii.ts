// Detects personal information that should never be posted publicly about a learner.
// Mirrors apps/backend/src/utils/pii.js: the browser gives instant feedback, the server enforces.
// Deliberately pattern-based so ordinary words like "student" or "name" are allowed.
const PII_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: 'an ID number', regex: /\b\d{13}\b/ },
  { label: 'an e-mail address', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  { label: 'a phone number', regex: /(?:\+27|\b0)[\s-]?[1-9]\d[\s-]?\d{3}[\s-]?\d{4}\b/ },
  {
    label: 'a street address',
    regex: /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Crescent|Close|Way)\b/,
  },
  { label: "a child's full name", regex: /\b(?:named|called|name is)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/ },
];

export function findPii(text: string): string[] {
  return PII_PATTERNS.filter(({ regex }) => regex.test(text)).map(({ label }) => label);
}

export function piiMessage(found: string[]): string {
  return `Please remove ${found.join(', ')} before posting. Use a pseudonym instead of real learner details.`;
}
