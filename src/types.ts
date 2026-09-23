export type Topic = 'python' | 'sql';
export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface PracticeLink {
  id: string;
  uid: string;
  url?: string;
  title: string;
  topic: Topic;
  subTopic: string;
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

export type Card = PracticeLink; // Keep alias for compatibility during transition

export interface Submission {
  id: string;
  linkId: string;
  uid: string;
  audioData?: string; // base64 encoded audio
  transcript?: string;
  feedback?: string;
  grade?: number; // 1-5
  status: 'pending' | 'graded';
  createdAt: string;
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
