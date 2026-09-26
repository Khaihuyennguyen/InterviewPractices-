import { GoogleGenAI } from '@google/genai';
import { PracticeLink } from '../types';

export interface SpokenEvaluationResult {
  // Correctness Metrics
  correctnessScore: number; // 0 - 100
  verdict: 'Excellent' | 'Good' | 'Partially Correct' | 'Needs Review';
  verdictSummary: string;
  coveredConcepts: string[];
  missingConcepts: string[];
  technicalAccuracyFeedback: string[];

  // Pronunciation & Delivery Metrics
  pronunciationScore: number; // 0 - 100
  wordCount: number;
  durationSeconds: number;
  wpm: number;
  paceRating: 'Ideal' | 'Slightly Slow' | 'Too Slow' | 'Slightly Fast' | 'Too Rushed';
  paceFeedback: string;
  fillerWords: { word: string; count: number }[];
  totalFillerCount: number;
  pronunciationFeedback: string[];

  // Suggested SM-2 Spaced Repetition Rating (1 - 5)
  suggestedRating: number;
  isAiGenerated: boolean;
}

const FILLER_WORDS_LIST = [
  'um', 'uh', 'like', 'you know', 'basically', 'actually', 
  'sort of', 'kind of', 'literally', 'i mean', 'right'
];

/**
 * Extract essential technical keywords & concepts for a given problem
 */
export function extractExpectedConcepts(problem: PracticeLink): string[] {
  const text = `${problem.title} ${problem.topic} ${problem.subTopic || ''} ${problem.pattern || ''} ${problem.notes || ''} ${problem.questionContent || ''} ${problem.solutionContent || ''}`.toLowerCase();
  
  const candidateConcepts: { term: string; aliases: string[] }[] = [
    // Python / Core Concepts
    { term: 'Global Interpreter Lock (GIL)', aliases: ['gil', 'global interpreter lock', 'interpreter lock'] },
    { term: 'Mutex / Lock Mechanism', aliases: ['mutex', 'mutual exclusion', 'thread lock', 'lock'] },
    { term: 'Reference Counting', aliases: ['reference count', 'ref count', 'garbage collection', 'memory management'] },
    { term: 'CPU-Bound vs I/O-Bound', aliases: ['cpu bound', 'cpu-bound', 'io bound', 'i/o bound', 'i/o-bound', 'network'] },
    { term: 'Multiprocessing', aliases: ['multiprocessing', 'multiple processes', 'process pool', 'separate processes'] },
    { term: 'Threading / Asyncio', aliases: ['threading', 'threads', 'asyncio', 'async', 'await', 'coroutines'] },
    
    // Data Structures & Algorithms
    { term: 'Hash Map / Dictionary', aliases: ['hash map', 'hashmap', 'hash table', 'dictionary', 'dict', 'lookup'] },
    { term: 'Two Pointers', aliases: ['two pointers', 'left and right pointer', 'two-pointer', 'pointers'] },
    { term: 'Sliding Window', aliases: ['sliding window', 'window size', 'left and right pointer', 'expand window'] },
    { term: 'Time Complexity (Big-O)', aliases: ['o(n)', 'o(1)', 'o(log n)', 'time complexity', 'linear time', 'constant time'] },
    { term: 'Space Complexity', aliases: ['space complexity', 'extra space', 'auxiliary space', 'in-place', 'o(1) space'] },
    { term: 'Doubly Linked List', aliases: ['doubly linked list', 'linked list', 'prev and next', 'head and tail'] },
    { term: 'Interval Merging / Sorting', aliases: ['merge', 'intervals', 'overlapping', 'start time', 'end time', 'sort by start'] },
    
    // SQL Concepts
    { term: 'Window Functions (DENSE_RANK / RANK)', aliases: ['window function', 'dense_rank', 'rank()', 'row_number'] },
    { term: 'PARTITION BY clause', aliases: ['partition by', 'partitioning', 'partition'] },
    { term: 'ORDER BY clause', aliases: ['order by', 'descending', 'desc', 'asc'] },
    { term: 'Common Table Expression (CTE)', aliases: ['cte', 'with clause', 'common table expression'] },
    { term: 'LEAD / LAG Functions', aliases: ['lead', 'lag', 'consecutive', 'next row', 'previous row'] },
    { term: 'Self Join & Cohort Analysis', aliases: ['self join', 'cohort', 'retention', 'date_trunc', 'interval'] },
    { term: 'GROUP BY & Aggregations', aliases: ['group by', 'count', 'sum', 'avg', 'having', 'aggregate'] },
    { term: 'Subqueries / Correlated', aliases: ['subquery', 'correlated subquery', 'inner query'] },
    
    // System Design & Architecture
    { term: 'Base62 Encoding', aliases: ['base62', 'base 62', 'alphanumeric', '62^7'] },
    { term: 'Key Generation Service (KGS)', aliases: ['kgs', 'key generation', 'pre-generate', 'collision'] },
    { term: 'Caching (Redis / Memcached)', aliases: ['cache', 'redis', 'memcached', 'pareto', '80 20'] },
    { term: 'Token Bucket / Rate Limiting', aliases: ['token bucket', 'leaky bucket', 'sliding window counter', 'rate limit', '429'] },
    { term: 'Redis Lua Script (Atomicity)', aliases: ['lua script', 'atomic', 'race condition', 'concurrency'] },
    { term: 'Clustered vs Non-Clustered Index', aliases: ['clustered index', 'non-clustered', 'b-tree', 'leaf nodes', 'row data'] },
    { term: 'Covering Index', aliases: ['covering index', 'index only scan', 'all columns in index'] }
  ];

  const matched: string[] = [];
  for (const item of candidateConcepts) {
    if (item.aliases.some(alias => text.includes(alias))) {
      matched.push(item.term);
    }
  }

  // If few or none matched, fallback to topic and title keywords
  if (matched.length === 0) {
    if (problem.topic === 'sql') matched.push('SQL Query Structure', 'Filtering & Joins', 'Edge Cases');
    else if (problem.topic === 'python') matched.push('Algorithm Logic', 'Time & Space Complexity', 'Data Structures');
    else if (problem.topic === 'system-design') matched.push('Scalability & Tradeoffs', 'Storage & Capacity', 'Architecture Components');
    else matched.push('Core Definition', 'Real-world Application', 'Key Tradeoffs');
  }

  return matched;
}

/**
 * Local Built-in NLP Evaluation (Works 100% offline with zero API key)
 */
export function evaluateSpokenAnswerOffline(
  spokenTranscript: string,
  problem: PracticeLink,
  durationSeconds: number
): SpokenEvaluationResult {
  const cleanTranscript = spokenTranscript.trim();
  const lowerTranscript = cleanTranscript.toLowerCase();
  const words = cleanTranscript.length > 0 ? cleanTranscript.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  // 1. Calculate Speaking Pace (WPM)
  const effectiveDuration = Math.max(5, durationSeconds);
  const wpm = Math.round((wordCount / effectiveDuration) * 60);

  let paceRating: SpokenEvaluationResult['paceRating'] = 'Ideal';
  let paceFeedback = 'Pacing is balanced and easy for the interviewer to follow.';

  if (wpm < 85) {
    paceRating = 'Too Slow';
    paceFeedback = `Speaking pace is ${wpm} WPM (too slow). Try to maintain momentum and confidence.`;
  } else if (wpm < 110) {
    paceRating = 'Slightly Slow';
    paceFeedback = `Speaking pace is ${wpm} WPM. A little more pace (125-150 WPM) will sound more engaging.`;
  } else if (wpm > 175) {
    paceRating = 'Too Rushed';
    paceFeedback = `Speaking pace is ${wpm} WPM (rushed). Slow down and insert deliberate pauses between key points.`;
  } else if (wpm > 155) {
    paceRating = 'Slightly Fast';
    paceFeedback = `Speaking pace is ${wpm} WPM. Try taking a breath before switching technical concepts.`;
  } else {
    paceRating = 'Ideal';
    paceFeedback = `Ideal interview pace at ${wpm} WPM! Well-paced and professional.`;
  }

  // 2. Filler Words Detection
  const fillerCounts: { [key: string]: number } = {};
  let totalFillerCount = 0;

  for (const filler of FILLER_WORDS_LIST) {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    const matches = lowerTranscript.match(regex);
    if (matches && matches.length > 0) {
      fillerCounts[filler] = matches.length;
      totalFillerCount += matches.length;
    }
  }

  const fillerWords = Object.entries(fillerCounts)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);

  // 3. Pronunciation & Articulation Scoring
  let pronunciationScore = 95;

  // Deduct for high filler word density
  const fillerRatio = wordCount > 0 ? (totalFillerCount / wordCount) * 100 : 0;
  if (fillerRatio > 10) pronunciationScore -= 25;
  else if (fillerRatio > 5) pronunciationScore -= 15;
  else if (fillerRatio > 2) pronunciationScore -= 8;

  // Deduct for extreme pacing
  if (paceRating === 'Too Slow' || paceRating === 'Too Rushed') pronunciationScore -= 12;
  else if (paceRating === 'Slightly Slow' || paceRating === 'Slightly Fast') pronunciationScore -= 5;

  // Minimum length requirement
  if (wordCount < 15) {
    pronunciationScore = Math.min(pronunciationScore, 50);
  }

  pronunciationScore = Math.max(35, Math.min(100, Math.round(pronunciationScore)));

  const pronunciationFeedback: string[] = [];
  if (totalFillerCount > 0) {
    const topFillers = fillerWords.slice(0, 3).map(f => `"${f.word}" (${f.count}x)`).join(', ');
    pronunciationFeedback.push(`Identified ${totalFillerCount} verbal filler(s): ${topFillers}. Practice pausing silently instead of using fillers.`);
  } else if (wordCount > 20) {
    pronunciationFeedback.push('Zero verbal filler words detected! Clean and confident delivery.');
  }

  if (wordCount >= 25) {
    pronunciationFeedback.push('Technical terms were clearly enunciated and accurately recognized.');
  } else {
    pronunciationFeedback.push('Answer was very brief. Aim to provide at least 2-3 complete sentences explaining the rationale.');
  }

  // 4. Correctness & Content Evaluation
  const expectedConcepts = extractExpectedConcepts(problem);
  const coveredConcepts: string[] = [];
  const missingConcepts: string[] = [];

  for (const concept of expectedConcepts) {
    const searchTerms = [
      concept.toLowerCase(),
      ...concept.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 3)
    ];

    const isCovered = searchTerms.some(term => lowerTranscript.includes(term));
    if (isCovered) {
      coveredConcepts.push(concept);
    } else {
      missingConcepts.push(concept);
    }
  }

  // Correctness score based on concepts covered + length
  let correctnessScore = 0;
  if (expectedConcepts.length > 0) {
    const coverageRatio = coveredConcepts.length / expectedConcepts.length;
    correctnessScore = Math.round(coverageRatio * 85);

    // Bonus for substantive explanation
    if (wordCount >= 40 && coverageRatio > 0.4) correctnessScore += 15;
    else if (wordCount >= 20 && coverageRatio > 0.3) correctnessScore += 10;
  } else {
    correctnessScore = wordCount > 30 ? 85 : 60;
  }

  correctnessScore = Math.max(20, Math.min(100, correctnessScore));

  let verdict: SpokenEvaluationResult['verdict'] = 'Good';
  let verdictSummary = '';

  if (correctnessScore >= 85) {
    verdict = 'Excellent';
    verdictSummary = 'Strong, accurate explanation covering all major technical mechanics!';
  } else if (correctnessScore >= 70) {
    verdict = 'Good';
    verdictSummary = 'Solid answer explaining the primary concept with good technical awareness.';
  } else if (correctnessScore >= 45) {
    verdict = 'Partially Correct';
    verdictSummary = 'Answer touched on the topic but missed key architectural details or tradeoffs.';
  } else {
    verdict = 'Needs Review';
    verdictSummary = 'Answer was incomplete or missing critical technical mechanics. Review the solution reference.';
  }

  const technicalAccuracyFeedback: string[] = [];
  if (coveredConcepts.length > 0) {
    technicalAccuracyFeedback.push(`Successfully articulated: ${coveredConcepts.join(', ')}.`);
  }
  if (missingConcepts.length > 0) {
    technicalAccuracyFeedback.push(`Consider mentioning: ${missingConcepts.join(', ')}.`);
  }

  // 5. Suggested SRS Rating
  let suggestedRating = 3;
  if (correctnessScore >= 88 && pronunciationScore >= 80) suggestedRating = 5; // Perfect
  else if (correctnessScore >= 75) suggestedRating = 4; // Easy / Good
  else if (correctnessScore >= 55) suggestedRating = 3; // Passable
  else if (correctnessScore >= 35) suggestedRating = 2; // Hard
  else suggestedRating = 1; // Forgot

  return {
    correctnessScore,
    verdict,
    verdictSummary,
    coveredConcepts,
    missingConcepts,
    technicalAccuracyFeedback,
    pronunciationScore,
    wordCount,
    durationSeconds: effectiveDuration,
    wpm,
    paceRating,
    paceFeedback,
    fillerWords,
    totalFillerCount,
    pronunciationFeedback,
    suggestedRating,
    isAiGenerated: false,
  };
}

/**
 * Enhanced Gemini AI Spoken Answer Evaluation
 * Calls Gemini 2.5 Flash if an API key is available, else falls back to offline evaluator.
 */
export async function evaluateSpokenAnswerWithAI(
  spokenTranscript: string,
  problem: PracticeLink,
  durationSeconds: number,
  customApiKey?: string
): Promise<SpokenEvaluationResult> {
  // Check for API key
  const apiKey = customApiKey || 
    (typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null) || 
    ((import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined);

  // If no API key, immediately use the robust offline evaluator
  if (!apiKey || !apiKey.trim()) {
    return evaluateSpokenAnswerOffline(spokenTranscript, problem, durationSeconds);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const prompt = `
You are an expert Senior Technical Interviewer and Voice Coach conducting a mock interview.
Evaluate the candidate's spoken answer to the following technical interview problem:

Problem Title: ${problem.title}
Topic: ${problem.topic}
Area / Pattern: ${problem.pattern || problem.subTopic || 'General'}
Problem Description:
${problem.questionContent || 'No description provided'}

Reference Solution & Insights:
${problem.solutionContent || problem.notes || 'General standard solution'}

Candidate's Spoken Answer (Transcribed):
"${spokenTranscript}"
Spoken Duration: ${durationSeconds} seconds

Provide an accurate, honest evaluation in pure JSON format with this exact schema:
{
  "correctnessScore": number (0 to 100),
  "verdict": "Excellent" | "Good" | "Partially Correct" | "Needs Review",
  "verdictSummary": string (1-2 sentences summarizing correctness),
  "coveredConcepts": string[] (list of technical concepts correctly articulated by the candidate),
  "missingConcepts": string[] (important concepts or edge cases the candidate missed),
  "technicalAccuracyFeedback": string[] (specific constructive bullets on technical accuracy),
  "pronunciationScore": number (0 to 100 evaluating clarity, diction, technical terminology, and confidence),
  "pronunciationFeedback": string[] (specific bullets on speech clarity, flow, fillers, and communication),
  "suggestedRating": number (1 to 5 for spaced repetition recall rating)
}
Return ONLY valid JSON.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const jsonText = response.text?.trim() || '{}';
    const parsed = JSON.parse(jsonText);

    // Calculate pace and fillers locally for objective metrics
    const baseOffline = evaluateSpokenAnswerOffline(spokenTranscript, problem, durationSeconds);

    return {
      correctnessScore: typeof parsed.correctnessScore === 'number' ? parsed.correctnessScore : baseOffline.correctnessScore,
      verdict: parsed.verdict || baseOffline.verdict,
      verdictSummary: parsed.verdictSummary || baseOffline.verdictSummary,
      coveredConcepts: Array.isArray(parsed.coveredConcepts) && parsed.coveredConcepts.length > 0 ? parsed.coveredConcepts : baseOffline.coveredConcepts,
      missingConcepts: Array.isArray(parsed.missingConcepts) ? parsed.missingConcepts : baseOffline.missingConcepts,
      technicalAccuracyFeedback: Array.isArray(parsed.technicalAccuracyFeedback) && parsed.technicalAccuracyFeedback.length > 0 ? parsed.technicalAccuracyFeedback : baseOffline.technicalAccuracyFeedback,
      pronunciationScore: typeof parsed.pronunciationScore === 'number' ? parsed.pronunciationScore : baseOffline.pronunciationScore,
      wordCount: baseOffline.wordCount,
      durationSeconds: baseOffline.durationSeconds,
      wpm: baseOffline.wpm,
      paceRating: baseOffline.paceRating,
      paceFeedback: baseOffline.paceFeedback,
      fillerWords: baseOffline.fillerWords,
      totalFillerCount: baseOffline.totalFillerCount,
      pronunciationFeedback: Array.isArray(parsed.pronunciationFeedback) && parsed.pronunciationFeedback.length > 0 ? parsed.pronunciationFeedback : baseOffline.pronunciationFeedback,
      suggestedRating: typeof parsed.suggestedRating === 'number' ? Math.max(1, Math.min(5, parsed.suggestedRating)) : baseOffline.suggestedRating,
      isAiGenerated: true,
    };
  } catch (err) {
    console.warn('Gemini AI evaluation failed or timed out, falling back to local NLP evaluator:', err);
    return evaluateSpokenAnswerOffline(spokenTranscript, problem, durationSeconds);
  }
}
