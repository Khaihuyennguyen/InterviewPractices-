import { addDays, startOfDay, differenceInHours, differenceInCalendarDays, format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { Card } from '../types';

export const TIMEZONE = 'America/Chicago';

/**
 * Gets the current time in the application's timezone (CDT/CST).
 */
export function getNowInTZ(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

/**
 * Formats a date string or Date object in the application's timezone.
 */
export function formatDateInTZ(date: string | Date, formatStr: string = 'MM/dd/yyyy'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(toZonedTime(d, TIMEZONE), formatStr);
}

/**
 * Parses a date string (YYYY-MM-DD) as being in the application's timezone.
 * If the date is today, it uses the current time to satisfy the 16-hour spacing rule.
 */
export function parseDateInTZ(dateStr: string): string {
  const now = getNowInTZ();
  const todayStr = format(now, 'yyyy-MM-dd');
  
  if (dateStr === todayStr) {
    // Use current absolute time for "today" to ensure differenceInHours < 16
    return new Date().toISOString();
  }
  
  // Parse YYYY-MM-DD at start of day in Chicago
  const date = fromZonedTime(`${dateStr} 00:00:00`, TIMEZONE);
  return date.toISOString();
}

/**
 * Calculates a priority score based on Spaced Repetition (SRS) science.
 * As a productivity expert, we optimize for the "Forgetting Curve".
 * 
 * Priority = (Overdue Ratio ^ 2) * Difficulty
 * 
 * This ensures that:
 * 1. Items practiced within the last 16 hours have near-zero priority (Spacing Effect).
 * 2. Items that are "Overdue" explode in priority.
 * 3. Personal difficulty is the primary tie-breaker for overdue items.
 */
export function calculatePriorityScore(card: Card): number {
  const now = getNowInTZ();
  const lastReview = card.lastReviewDate ? toZonedTime(new Date(card.lastReviewDate), TIMEZONE) : toZonedTime(new Date(card.createdAt), TIMEZONE);
  
  const hoursSinceLastReview = Math.max(0, differenceInHours(now, lastReview));
  const daysSinceLastReview = Math.max(0, differenceInCalendarDays(now, lastReview));
  
  // SCIENTIST'S RULE: The Spacing Effect
  // We use a 16-hour window for "Today" to avoid UTC midnight flips.
  // If you practiced recently, your memory is too fresh for effective review.
  if (hoursSinceLastReview < 16) {
    // FORCE RULE: Return a massive negative score to ensure it stays at the absolute bottom.
    // Even if other items have 0 priority, this will be lower.
    return -1000000;
  }

  // FORGETTING CURVE LOGIC:
  // We calculate how "Overdue" a card is relative to its scheduled interval.
  const interval = Math.max(1, card.interval || 1);
  const overdueRatio = daysSinceLastReview / interval;
  
  // Base score for anything outside the "Today" window.
  const baseScore = 5000;
  
  // Quadratic growth for overdue items. 
  // This makes "Last Week" significantly higher than "Yesterday".
  const overdueScore = Math.pow(overdueRatio, 2) * 2000;
  
  // DIFFICULTY WEIGHTING:
  // We prioritize Personal Difficulty (your subjective feeling) over Objective Difficulty.
  // Personal Difficulty (1-10) -> Max 5000 points
  const personalDiffScore = (card.personalDifficulty || 5) * 500;
  
  // Objective Difficulty (Beginner/Intermediate/Advanced) -> Max 2000 points
  // This is "Medium" weight: significant, but always smaller than a high Personal Difficulty.
  const objectiveDiffScore = card.difficulty === 'Advanced' ? 2000 : card.difficulty === 'Intermediate' ? 1000 : 0;

  // REPETITION WEIGHTING:
  // As requested: "Like same everything but one has prace 3 times, 1 is 4 times, we priority the 3 times"
  // We subtract a penalty for each practice session to prioritize newer/less-practiced items.
  // Each practice reduces priority by 100 points.
  const repetitionPenalty = (card.totalRepetitions || 0) * 100;

  return Math.round(baseScore + overdueScore + personalDiffScore + objectiveDiffScore - repetitionPenalty);
}

/**
 * SuperMemo-2 (SM-2) Algorithm implementation with time-based adjustments.
 * @param card The current card state.
 * @param quality Quality of response (0-5).
 * @param solveTime Time spent on the session in seconds.
 * @param personalDifficulty Manual difficulty rating (1-10, 10 is hardest).
 * @returns Updated card state.
 */
export function updateCardSRS(card: Card, quality: number, solveTime?: number, personalDifficulty?: number): Partial<Card> {
  let { repetitions, interval, easinessFactor, totalTimeSpent, totalRepetitions } = card;

  // Initialize metrics if they don't exist (for existing cards)
  totalTimeSpent = totalTimeSpent || 0;
  totalRepetitions = totalRepetitions || 0;

  // 1. Update Easiness Factor (EF)
  // EF' := EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  let baseEFChange = (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // Time-based adjustment (optional bonus for speed)
  if (solveTime && quality >= 3) {
    const targetTimes = {
      'Beginner': 300,
      'Intermediate': 900,
      'Advanced': 1800
    };
    const target = targetTimes[card.difficulty] || 600;
    
    // If solved in less than 50% of target time, add a small bonus
    if (solveTime < target * 0.5) {
      baseEFChange += 0.05;
    } 
    // If solved in more than 150% of target time, add a small penalty
    else if (solveTime > target * 1.5) {
      baseEFChange -= 0.05;
    }
  }

  // Personal Difficulty adjustment (10 is hardest, 1 is easiest)
  if (personalDifficulty) {
    // If personal difficulty is high (> 7), apply a small penalty to EF
    if (personalDifficulty > 7) {
      baseEFChange -= 0.05;
    }
    // If personal difficulty is low (< 3), apply a small bonus to EF
    else if (personalDifficulty < 3) {
      baseEFChange += 0.05;
    }
  }

  easinessFactor = Math.max(1.3, easinessFactor + baseEFChange);

  // 2. Update Repetitions and Interval
  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      // If it's "Perfect" or "Easy" on the first try, jump ahead
      if (quality >= 5) {
        interval = 6;
      } else if (quality >= 4) {
        interval = 4;
      } else {
        interval = 1;
      }
    } else if (repetitions === 1) {
      // Second successful review
      interval = quality >= 5 ? 12 : 6;
    } else {
      interval = Math.round(interval * easinessFactor);
    }
    repetitions++;
  }

  // 3. Update Performance Metrics
  const newTotalRepetitions = (totalRepetitions || 0) + 1;
  const newTotalTimeSpent = (totalTimeSpent || 0) + (solveTime || 0);
  const newAverageSolveTime = Math.round(newTotalTimeSpent / newTotalRepetitions);

  const now = getNowInTZ();
  const nextReviewDate = addDays(startOfDay(now), interval).toISOString();
  const lastReviewDate = now.toISOString();

  // Create a temporary card to calculate priority score
  const tempCard: Card = {
    ...card,
    repetitions,
    interval,
    easinessFactor,
    nextReviewDate,
    lastReviewDate,
    totalTimeSpent: newTotalTimeSpent,
    lastSolveTime: solveTime || 0,
    averageSolveTime: newAverageSolveTime,
    totalRepetitions: newTotalRepetitions,
    personalDifficulty: personalDifficulty || card.personalDifficulty,
  };

  const priorityScore = calculatePriorityScore(tempCard);

  return {
    repetitions,
    interval,
    easinessFactor,
    nextReviewDate,
    lastReviewDate,
    totalTimeSpent: newTotalTimeSpent,
    lastSolveTime: solveTime || 0,
    averageSolveTime: newAverageSolveTime,
    totalRepetitions: newTotalRepetitions,
    personalDifficulty: personalDifficulty || card.personalDifficulty,
    priorityScore,
  };
}

export function isDue(card: Card): boolean {
  const now = getNowInTZ();
  const lastReview = card.lastReviewDate ? toZonedTime(new Date(card.lastReviewDate), TIMEZONE) : null;
  
  // SPACING EFFECT: If practiced within the last 16 hours, it's NEVER due.
  if (lastReview && differenceInHours(now, lastReview) < 16) {
    return false;
  }

  const nextReview = toZonedTime(new Date(card.nextReviewDate), TIMEZONE);
  return now >= nextReview;
}
