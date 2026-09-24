import { PracticeLink, PracticeSessionRecord } from '../types';
import { getStandardPatternsForTopic } from '../data/patterns';
import { 
  differenceInCalendarDays, 
  isSameDay, 
  isSameWeek, 
  isSameMonth, 
  subDays 
} from 'date-fns';
import { getNowInTZ } from './srs';

export interface PatternMetric {
  name: string;
  problemsCount: number;
  totalPractices: number;
  masteredCount: number;
  dueCount: number;
}

export interface TopicAnalytics {
  topic: string;
  practicesToday: number;
  practicesThisWeek: number;
  practicesThisMonth: number;
  practicesTotal: number;
  dailyAverage: string;
  weeklyAverage: string;
  totalProblems: number;
  dueProblems: number;
  masteredProblems: number;
  masteryPercentage: number;
  totalTimeSpentSeconds: number;
  mostPracticedPattern: PatternMetric | null;
  leastPracticedPattern: PatternMetric | null;
  patternMetrics: PatternMetric[];
}

/**
 * Normalizes pattern/subtopic name for consistent aggregation.
 */
export function getProblemPattern(problem: PracticeLink): string {
  return problem.pattern?.trim() || problem.subTopic?.trim() || 'General';
}

/**
 * Calculates comprehensive practice and pattern statistics for a given topic or all topics.
 */
export function calculateTopicAnalytics(
  problems: PracticeLink[],
  history: PracticeSessionRecord[],
  activeTopic: string
): TopicAnalytics {
  const now = getNowInTZ();
  const isAll = activeTopic === 'all';

  // Filter problems for the active topic
  const filteredProblems = isAll
    ? problems
    : problems.filter(p => p.topic.toLowerCase().trim() === activeTopic.toLowerCase().trim());

  // Filter session history for the active topic
  const filteredHistory = isAll
    ? history
    : history.filter(h => h.topic.toLowerCase().trim() === activeTopic.toLowerCase().trim());

  // Time-windowed practice counts
  // 1. From recorded session history
  let todayFromHistory = 0;
  let weekFromHistory = 0;
  let monthFromHistory = 0;

  filteredHistory.forEach(record => {
    const recordDate = new Date(record.timestamp);
    if (isSameDay(recordDate, now)) todayFromHistory++;
    if (isSameWeek(recordDate, now, { weekStartsOn: 1 })) weekFromHistory++;
    if (isSameMonth(recordDate, now)) monthFromHistory++;
  });

  // 2. Also account for problems that have lastReviewDate matching today/this week
  // if history was empty or not yet logged
  let todayFromProblems = 0;
  filteredProblems.forEach(p => {
    if (p.lastReviewDate) {
      const d = new Date(p.lastReviewDate);
      if (isSameDay(d, now)) {
        todayFromProblems++;
      }
    }
  });

  const practicesToday = Math.max(todayFromHistory, todayFromProblems);
  const practicesThisWeek = Math.max(weekFromHistory, practicesToday);
  const practicesThisMonth = Math.max(monthFromHistory, practicesThisWeek);

  // Total practice count across all filtered problems
  const totalRepetitionsFromProblems = filteredProblems.reduce(
    (sum, p) => sum + (p.totalRepetitions || 0), 
    0
  );
  const practicesTotal = Math.max(filteredHistory.length, totalRepetitionsFromProblems);

  // Averages
  const dailyAverage = (practicesThisMonth / 30).toFixed(1);
  const weeklyAverage = (practicesThisMonth / 4.3).toFixed(1);

  // Total time spent
  const totalTimeSpentSeconds = filteredProblems.reduce(
    (sum, p) => sum + (p.totalTimeSpent || 0), 
    0
  );

  // Mastery & Due counts
  const totalProblems = filteredProblems.length;
  const masteredProblems = filteredProblems.filter(
    p => (p.repetitions || 0) >= 2 || (p.interval || 0) >= 5
  ).length;
  const masteryPercentage = totalProblems > 0 
    ? Math.round((masteredProblems / totalProblems) * 100) 
    : 0;

  // Patterns aggregation
  // Get standard patterns for topic + any custom patterns from user problems
  const standardPatterns = getStandardPatternsForTopic(activeTopic);
  const patternSet = new Set<string>();
  
  // Always include standard patterns
  standardPatterns.forEach(p => patternSet.add(p));
  
  // Include patterns present in problems
  filteredProblems.forEach(p => {
    const pat = getProblemPattern(p);
    if (pat) patternSet.add(pat);
  });

  const patternMetrics: PatternMetric[] = Array.from(patternSet).map(patternName => {
    const norm = patternName.toLowerCase().trim();
    const matchingProblems = filteredProblems.filter(
      p => getProblemPattern(p).toLowerCase().trim() === norm
    );
    const problemsCount = matchingProblems.length;
    
    // Sum practice count from history + problem repetitions
    const historyPractices = filteredHistory.filter(
      h => (h.pattern || '').toLowerCase().trim() === norm
    ).length;
    const problemPractices = matchingProblems.reduce(
      (sum, p) => sum + (p.totalRepetitions || 0), 
      0
    );
    const totalPractices = Math.max(historyPractices, problemPractices);

    const masteredCount = matchingProblems.filter(
      p => (p.repetitions || 0) >= 2 || (p.interval || 0) >= 5
    ).length;

    // Check due items
    const dueCount = matchingProblems.filter(p => {
      if (!p.nextReviewDate) return false;
      return new Date(p.nextReviewDate) <= now;
    }).length;

    return {
      name: patternName,
      problemsCount,
      totalPractices,
      masteredCount,
      dueCount,
    };
  });

  // Sort pattern metrics by total practices descending
  patternMetrics.sort((a, b) => b.totalPractices - a.totalPractices);

  // Identify most practiced pattern (must have at least 1 practice or problem)
  const patternsWithActivity = patternMetrics.filter(p => p.totalPractices > 0 || p.problemsCount > 0);
  const mostPracticedPattern = patternsWithActivity.length > 0 
    ? patternsWithActivity[0] 
    : null;

  // Identify pattern needing attention (has problems but 0 practices, or lowest practices)
  const patternsNeedingWork = patternMetrics
    .filter(p => p.problemsCount > 0)
    .sort((a, b) => a.totalPractices - b.totalPractices);
  const leastPracticedPattern = patternsNeedingWork.length > 0 
    ? patternsNeedingWork[0] 
    : null;

  return {
    topic: activeTopic,
    practicesToday,
    practicesThisWeek,
    practicesThisMonth,
    practicesTotal,
    dailyAverage,
    weeklyAverage,
    totalProblems,
    dueProblems: filteredProblems.filter(p => {
      if (!p.nextReviewDate) return false;
      return new Date(p.nextReviewDate) <= now;
    }).length,
    masteredProblems,
    masteryPercentage,
    totalTimeSpentSeconds,
    mostPracticedPattern,
    leastPracticedPattern,
    patternMetrics: patternMetrics.filter(p => p.problemsCount > 0 || standardPatterns.includes(p.name)),
  };
}
