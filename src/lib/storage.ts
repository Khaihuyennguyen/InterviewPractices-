import { PracticeLink } from '../types';
import { STARTER_PROBLEMS } from '../data/starterProblems';
import { calculatePriorityScore } from './srs';

const STORAGE_KEY = 'coderecall_practice_links_v1';
const GUEST_UID = 'guest_user';

export function getInitialProblems(): PracticeLink[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as PracticeLink[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(item => ({
          ...item,
          priorityScore: calculatePriorityScore(item)
        }));
      }
    }
  } catch (err) {
    console.error('Failed to load problems from local storage:', err);
  }

  // Fallback to starter problems with updated priority
  const starters: PracticeLink[] = STARTER_PROBLEMS.map(p => {
    const fullItem: PracticeLink = {
      ...p,
      uid: GUEST_UID,
    };
    return {
      ...fullItem,
      priorityScore: calculatePriorityScore(fullItem)
    };
  });
  saveLocalProblems(starters);
  return starters;
}

export function saveLocalProblems(problems: PracticeLink[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(problems));
  } catch (err) {
    console.error('Failed to save problems to local storage:', err);
  }
}

export function resetToStarterProblems(): PracticeLink[] {
  const starters: PracticeLink[] = STARTER_PROBLEMS.map(p => {
    const fullItem: PracticeLink = {
      ...p,
      uid: GUEST_UID,
    };
    return {
      ...fullItem,
      priorityScore: calculatePriorityScore(fullItem)
    };
  });
  saveLocalProblems(starters);
  return starters;
}

export function exportProblemsJSON(problems: PracticeLink[]): string {
  return JSON.stringify(problems, null, 2);
}

export function importProblemsJSON(jsonStr: string): PracticeLink[] {
  const data = JSON.parse(jsonStr);
  if (!Array.isArray(data)) {
    throw new Error('Invalid backup file: Expected an array of problems.');
  }
  const valid = data.map((item, idx) => {
    if (!item.title || !item.topic) {
      throw new Error(`Item at position ${idx + 1} is missing a title or topic.`);
    }
    const full: PracticeLink = {
      id: item.id || `custom-${Date.now()}-${idx}`,
      uid: item.uid || GUEST_UID,
      title: item.title,
      topic: item.topic || 'general',
      subTopic: item.subTopic || 'General',
      difficulty: item.difficulty || 'Intermediate',
      url: item.url || '',
      notes: item.notes || '',
      questionContent: item.questionContent || '',
      solutionContent: item.solutionContent || '',
      repetitions: Number(item.repetitions) || 0,
      interval: Number(item.interval) || 0,
      easinessFactor: Number(item.easinessFactor) || 2.5,
      nextReviewDate: item.nextReviewDate || new Date().toISOString(),
      lastReviewDate: item.lastReviewDate,
      totalTimeSpent: Number(item.totalTimeSpent) || 0,
      lastSolveTime: Number(item.lastSolveTime) || 0,
      averageSolveTime: Number(item.averageSolveTime) || 0,
      totalRepetitions: Number(item.totalRepetitions) || 0,
      personalDifficulty: Number(item.personalDifficulty) || 5,
      priorityScore: 0,
      createdAt: item.createdAt || new Date().toISOString(),
    };
    return {
      ...full,
      priorityScore: calculatePriorityScore(full)
    };
  });
  saveLocalProblems(valid);
  return valid;
}
