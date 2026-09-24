export type Topic = 'python' | 'sql' | 'system-design' | 'qa' | 'algorithms' | 'data-engineering' | string;
export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface PracticeLink {
  id: string;
  uid: string;
  url?: string;
  title: string;
  topic: Topic;
  subTopic: string;
  pattern?: string; // Standard pattern e.g. 'Two Pointers', 'Cyclic Sort', 'Window Functions'
  problemNumber?: number; // Number of the problem (e.g. 1, 2, 3...)
  difficulty: Difficulty;
  notes?: string;
  transcript?: string;
  questionContent?: string;
  solutionContent?: string;
  
  // SRS Fields (SM-2 Algorithm)
  repetitions: number;
  interval: number;
  easinessFactor: number;
  nextReviewDate: string;
  lastReviewDate?: string;
  
  // Performance Metrics
  totalTimeSpent: number; // in seconds
  lastSolveTime: number; // in seconds
  averageSolveTime: number; // in seconds
  totalRepetitions: number; // total times practiced across all sessions
  personalDifficulty?: number; // 1-10 manual rating (10 is hardest)
  priorityScore: number; // Calculated priority for review
  
  createdAt: string;
}

export type Card = PracticeLink; // Keep alias for compatibility

export interface PracticeSessionRecord {
  id: string;
  problemId: string;
  problemTitle: string;
  topic: string;
  pattern: string;
  timestamp: string; // ISO date string
  solveTimeSeconds: number;
  quality: number; // 1-5 rating, or 4 for quick mark done
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  stats: {
    totalReviews: number;
    streak: number;
    lastActiveDate: string;
  };
}
