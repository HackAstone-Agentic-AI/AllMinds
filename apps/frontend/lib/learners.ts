import { LearnerProfile } from '@/types/database';

type LearnerLike = Pick<LearnerProfile, 'anonymous_id' | 'profile_data'>;

const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

const getProfileText = (
  profile: Record<string, unknown> | null | undefined,
  keys: string[],
) => {
  if (!profile) return '';

  const normalizedEntries = new Map(
    Object.entries(profile).map(([key, value]) => [normalizeKey(key), value]),
  );

  for (const key of keys) {
    const value = normalizedEntries.get(normalizeKey(key));
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();
      if (text) return text;
    }
  }

  return '';
};

export const getLearnerDisplayName = (learner: LearnerLike) => {
  const profile = learner.profile_data;
  const directName = getProfileText(profile, [
    'pseudonym',
    'preferred_name',
    'learner_name',
    'student_name',
    'display_name',
    'full_name',
    'fullName',
    'name',
  ]);

  if (directName) return directName;

  const firstName = getProfileText(profile, ['first_name', 'firstName', 'given_name']);
  const surname = getProfileText(profile, [
    'surname',
    'last_name',
    'lastName',
    'family_name',
  ]);
  const combinedName = [firstName, surname].filter(Boolean).join(' ');

  return combinedName || learner.anonymous_id || 'Unnamed learner';
};

export const getLearnerSecondaryLabel = (learner: LearnerLike) => {
  const displayName = getLearnerDisplayName(learner);
  return displayName === learner.anonymous_id ? '' : learner.anonymous_id;
};
