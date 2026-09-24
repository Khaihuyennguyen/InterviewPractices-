import React, { useState, useEffect, useMemo } from 'react';
import { PracticeLink, Topic, Difficulty, PracticeSessionRecord } from './types';
import { updateCardSRS, isDue, calculatePriorityScore, getNowInTZ, formatDateInTZ, parseDateInTZ } from './lib/srs';
import { PracticeLinkCard } from './components/PracticeLinkCard';
import { PatternStatsBar } from './components/PatternStatsBar';
import { 
  getInitialProblems, 
  saveLocalProblems, 
  resetToStarterProblems, 
  exportProblemsJSON, 
  importProblemsJSON,
  getPracticeHistory,
  recordPracticeSession
} from './lib/storage';
import { calculateTopicAnalytics, getProblemPattern } from './lib/analytics';
import { getStandardPatternsForTopic } from './data/patterns';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Sparkles, Database, Code2, CheckCircle2, BarChart3, Clock, 
  Filter, ExternalLink, Trash2, X, AlertCircle, RotateCcw, Pencil, 
  Play, Download, Upload, Target, Flame, Search, ArrowRight, BookOpen, Layers, Calendar, Trophy, TrendingUp
} from 'lucide-react';
import { cn, formatTopicName, getTopicBadgeClass } from './lib/utils';
import { differenceInDays, differenceInCalendarDays, parseISO, format, addDays, startOfDay } from 'date-fns';

export interface GoalSettings {
  targetDate: string; // YYYY-MM-DD
  targetCount: number;
}

const GOAL_STORAGE_KEY = 'coderecall_target_goal_v1';

function getInitialGoal(): GoalSettings {
  try {
    const saved = localStorage.getItem(GOAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.targetDate && parsed.targetCount) return parsed;
    }
  } catch (e) {}
  return {
    targetDate: `${new Date().getFullYear()}-12-31`,
    targetCount: 1000,
  };
}

export default function App() {
  const [links, setLinks] = useState<PracticeLink[]>(() => getInitialProblems());
  const [practiceHistory, setPracticeHistory] = useState<PracticeSessionRecord[]>(() => getPracticeHistory());
  const [activeScreen, setActiveScreen] = useState<'python' | 'sql' | 'system-design' | 'qa' | 'all'>('python');
  const [selectedPattern, setSelectedPattern] = useState<string | 'all'>('all');
  const [activeDifficulty, setActiveDifficulty] = useState<Difficulty | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyDue, setOnlyDue] = useState(false);

  // Goal & Countdown State
  const [goalSettings, setGoalSettings] = useState<GoalSettings>(getInitialGoal);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [tempGoalDate, setTempGoalDate] = useState(goalSettings.targetDate);
  const [tempGoalCount, setTempGoalCount] = useState(goalSettings.targetCount.toString());

  // Practice session state
  const [isPracticing, setIsPracticing] = useState(false);
  const [currentPracticeItem, setCurrentPracticeItem] = useState<PracticeLink | null>(null);
  const [sessionSuccessMessage, setSessionSuccessMessage] = useState<string | null>(null);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupJsonText, setBackupJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    topic: 'python' as string,
    customTopic: '',
    pattern: 'Two Pointers',
    customPattern: '',
    subTopic: '',
    difficulty: 'Intermediate' as Difficulty,
    personalDifficulty: 5,
    alreadyPracticed: true, // Default: user just practiced this problem today!
    lastPracticeDate: format(getNowInTZ(), 'yyyy-MM-dd'),
    nextReviewDate: format(addDays(getNowInTZ(), 1), 'yyyy-MM-dd'),
    initialSolveTimeMins: '15',
    initialSolveTimeSecs: '0',
    totalRepetitions: 1,
    notes: '',
    questionContent: '',
    solutionContent: '',
  });

  // Save changes to localStorage whenever links change
  useEffect(() => {
    saveLocalProblems(links);
  }, [links]);

  // Target Deadline & Pace Calculation
  const deadlineInfo = useMemo(() => {
    const now = getNowInTZ();
    const target = new Date(`${goalSettings.targetDate}T23:59:59`);
    const daysRemaining = Math.max(0, differenceInCalendarDays(target, now));
    const targetCount = goalSettings.targetCount;
    const solvedCount = links.length;
    const remainingProblems = Math.max(0, targetCount - solvedCount);
    const dailyPace = daysRemaining > 0 ? Math.ceil(remainingProblems / daysRemaining) : remainingProblems;
    const progressPercent = Math.min(100, Math.round((solvedCount / targetCount) * 100));

    return {
      deadlineDate: target,
      formattedDate: format(target, 'MMM d, yyyy'),
      daysRemaining,
      targetCount,
      solvedCount,
      remainingProblems,
      dailyPace,
      progressPercent,
    };
  }, [goalSettings, links.length]);

  // Screen-specific due item counts for navigation badges
  const pythonDueCount = useMemo(() => {
    return links.filter(l => l.topic.toLowerCase().trim() === 'python' && isDue(l)).length;
  }, [links]);

  const sqlDueCount = useMemo(() => {
    return links.filter(l => l.topic.toLowerCase().trim() === 'sql' && isDue(l)).length;
  }, [links]);

  const systemDesignDueCount = useMemo(() => {
    return links.filter(l => l.topic.toLowerCase().trim() === 'system-design' && isDue(l)).length;
  }, [links]);

  const qaDueCount = useMemo(() => {
    return links.filter(l => l.topic.toLowerCase().trim() === 'qa' && isDue(l)).length;
  }, [links]);

  const allDueCount = useMemo(() => links.filter(isDue).length, [links]);

  const pythonCount = useMemo(() => links.filter(l => l.topic.toLowerCase().trim() === 'python').length, [links]);
  const sqlCount = useMemo(() => links.filter(l => l.topic.toLowerCase().trim() === 'sql').length, [links]);
  const systemDesignCount = useMemo(() => links.filter(l => l.topic.toLowerCase().trim() === 'system-design').length, [links]);
  const qaCount = useMemo(() => links.filter(l => l.topic.toLowerCase().trim() === 'qa').length, [links]);

  // Problems matching the active topic screen
  const currentScreenProblems = useMemo(() => {
    if (activeScreen === 'all') return links;
    return links.filter(l => l.topic.toLowerCase().trim() === activeScreen.toLowerCase().trim());
  }, [links, activeScreen]);

  // Topic Analytics computed for the active screen
  const topicAnalytics = useMemo(() => {
    return calculateTopicAnalytics(links, practiceHistory, activeScreen);
  }, [links, practiceHistory, activeScreen]);

  // Priority sorted items for current screen:
  // 1. Due items ALWAYS appear at the top, sorted by priority score (highest first).
  // 2. Non-due items appear below, sorted by next review date (soonest first).
  const sortedLinks = useMemo(() => {
    return [...currentScreenProblems].sort((a, b) => {
      const aDue = isDue(a);
      const bDue = isDue(b);
      
      // Due items always come before non-due items
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;

      // If both are due, sort by priority score descending
      if (aDue && bDue) {
        return (b.priorityScore || 0) - (a.priorityScore || 0);
      }

      // If neither is due, sort by next review date ascending (soonest first)
      const aNext = a.nextReviewDate ? new Date(a.nextReviewDate).getTime() : 0;
      const bNext = b.nextReviewDate ? new Date(b.nextReviewDate).getTime() : 0;
      if (aNext !== bNext) return aNext - bNext;

      return (b.priorityScore || 0) - (a.priorityScore || 0);
    });
  }, [currentScreenProblems]);

  // Due items list for current topic screen
  const dueItems = useMemo(() => {
    return sortedLinks.filter(isDue);
  }, [sortedLinks]);

  // Filtered links for table
  const filteredLinks = useMemo(() => {
    return sortedLinks.filter(item => {
      if (activeDifficulty !== 'all' && item.difficulty !== activeDifficulty) return false;
      if (selectedPattern !== 'all' && getProblemPattern(item).toLowerCase().trim() !== selectedPattern.toLowerCase().trim()) return false;
      if (onlyDue && !isDue(item)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchTopic = item.topic.toLowerCase().includes(q);
        const matchPattern = getProblemPattern(item).toLowerCase().includes(q);
        const matchNotes = item.notes?.toLowerCase().includes(q);
        if (!matchTitle && !matchTopic && !matchPattern && !matchNotes) return false;
      }
      return true;
    });
  }, [sortedLinks, activeDifficulty, selectedPattern, onlyDue, searchQuery]);

  // Topic-specific Recommendation engine: Only recommends items for the current active screen!
  const topRecommendation = useMemo(() => {
    if (currentScreenProblems.length === 0) return null;
    
    // First priority: highest priority due item in this topic
    if (dueItems.length > 0) {
      const topDue = dueItems[0];
      return {
        item: topDue,
        allCaughtUp: false,
        reason: topDue.totalRepetitions === 0 
          ? `New ${formatTopicName(topDue.topic)} problem — ready for your initial practice!` 
          : `Spaced review is due for this ${formatTopicName(topDue.topic)} concept.`
      };
    }

    // Second: items never practiced in this topic
    const unpracticed = sortedLinks.find(l => (l.totalRepetitions || 0) === 0);
    if (unpracticed) {
      return {
        item: unpracticed,
        allCaughtUp: false,
        reason: `Recommended new ${formatTopicName(unpracticed.topic)} problem to expand your syllabus.`
      };
    }

    // Check if everything in this topic was already reviewed recently (<16h)
    const allRecent = sortedLinks.length > 0 && sortedLinks.every(l => (l.priorityScore || 0) <= -1000000);
    if (allRecent) {
      return {
        item: sortedLinks[0],
        allCaughtUp: true,
        reason: `All caught up with ${activeScreen === 'all' ? 'all problems' : formatTopicName(activeScreen)} for today! 🎉 All reviews are scheduled for future dates.`
      };
    }

    // Fallback: highest priority item overall in this topic
    return {
      item: sortedLinks[0],
      allCaughtUp: false,
      reason: 'Recommended for extra reinforcement.'
    };
  }, [currentScreenProblems, dueItems, sortedLinks, activeScreen]);

  // Progress stats
  const stats = useMemo(() => {
    const total = links.length;
    const dueCount = dueItems.length;
    const mastered = links.filter(l => (l.repetitions || 0) >= 2 || (l.interval || 0) >= 5).length;
    const totalTimeSecs = links.reduce((acc, curr) => acc + (curr.totalTimeSpent || 0), 0);
    const totalReviews = links.reduce((acc, curr) => acc + (curr.totalRepetitions || 0), 0);

    // Topic breakdown for all present topics
    const topicKeys = Array.from(new Set(links.map(l => l.topic.toLowerCase().trim()).filter(Boolean)));
    const topicBreakdown = topicKeys.map(tKey => {
      const topicLinks = links.filter(l => l.topic.toLowerCase().trim() === tKey);
      const count = topicLinks.length;
      const mastered = topicLinks.filter(l => (l.repetitions || 0) >= 2 || (l.interval || 0) >= 5).length;
      return {
        topic: tKey,
        count,
        mastered,
        percent: count > 0 ? Math.round((mastered / count) * 100) : 0,
      };
    }).sort((a, b) => b.count - a.count);

    return {
      total,
      dueCount,
      mastered,
      masteryPercent: total > 0 ? Math.round((mastered / total) * 100) : 0,
      totalHours: (totalTimeSecs / 3600).toFixed(1),
      totalReviews,
      topicBreakdown,
    };
  }, [links, dueItems]);

  // Start practice session
  const handleStartPractice = (item: PracticeLink) => {
    setCurrentPracticeItem(item);
    setIsPracticing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Complete rating
  const handleRatePractice = (quality: number, solveTime: number, personalDifficulty: number) => {
    if (!currentPracticeItem) return;

    const updates = updateCardSRS(currentPracticeItem, quality, solveTime, personalDifficulty);
    setLinks(prev => prev.map(l => {
      if (l.id === currentPracticeItem.id) {
        return {
          ...l,
          ...updates,
        } as PracticeLink;
      }
      return l;
    }));

    // Record session history
    const record = recordPracticeSession({
      problemId: currentPracticeItem.id,
      problemTitle: currentPracticeItem.title,
      topic: currentPracticeItem.topic,
      pattern: getProblemPattern(currentPracticeItem),
      solveTimeSeconds: solveTime,
      quality,
    });
    setPracticeHistory(prev => [record, ...prev]);

    setSessionSuccessMessage(`Saved! Quality ${quality}/5 logged. Next review in ${updates.interval || 1} day(s).`);
    setTimeout(() => setSessionSuccessMessage(null), 4000);

    // If there are other due items, offer the next one or close
    const remainingDue = dueItems.filter(d => d.id !== currentPracticeItem.id);
    if (remainingDue.length > 0) {
      setCurrentPracticeItem(remainingDue[0]);
    } else {
      setIsPracticing(false);
      setCurrentPracticeItem(null);
    }
  };

  // Quick mark problem as solved today directly from table row
  const handleQuickMarkDone = (item: PracticeLink) => {
    const now = getNowInTZ();
    const tomorrow = addDays(startOfDay(now), 1);
    const newTotalRepetitions = Math.max(1, (item.totalRepetitions || 0) + 1);
    const newRepetitions = Math.max(1, (item.repetitions || 0) + 1);
    const newInterval = 1;
    const solveTime = item.lastSolveTime && item.lastSolveTime > 0 ? item.lastSolveTime : 900;
    
    setLinks(prev => prev.map(l => {
      if (l.id === item.id) {
        const updated: PracticeLink = {
          ...l,
          repetitions: newRepetitions,
          interval: newInterval,
          lastReviewDate: now.toISOString(),
          nextReviewDate: tomorrow.toISOString(),
          totalRepetitions: newTotalRepetitions,
          totalTimeSpent: (l.totalTimeSpent || 0) + solveTime,
          lastSolveTime: solveTime,
          averageSolveTime: Math.round(((l.totalTimeSpent || 0) + solveTime) / newTotalRepetitions),
        };
        return {
          ...updated,
          priorityScore: calculatePriorityScore(updated)
        };
      }
      return l;
    }));

    // Record session history
    const record = recordPracticeSession({
      problemId: item.id,
      problemTitle: item.title,
      topic: item.topic,
      pattern: getProblemPattern(item),
      solveTimeSeconds: solveTime,
      quality: 4,
    });
    setPracticeHistory(prev => [record, ...prev]);

    if (currentPracticeItem?.id === item.id) {
      setIsPracticing(false);
      setCurrentPracticeItem(null);
    }

    setSessionSuccessMessage(`Marked "${item.title}" as completed today! 🎉 Next review scheduled for tomorrow (${format(tomorrow, 'MMM d')}).`);
    setTimeout(() => setSessionSuccessMessage(null), 4000);
  };

  // Open add modal
  const handleOpenAdd = () => {
    const todayStr = format(getNowInTZ(), 'yyyy-MM-dd');
    const tomorrowStr = format(addDays(getNowInTZ(), 1), 'yyyy-MM-dd');
    const defaultTopic = activeScreen === 'all' ? 'python' : activeScreen;
    const defaultPatterns = getStandardPatternsForTopic(defaultTopic);

    setEditingId(null);
    setFormData({
      title: '',
      url: '',
      topic: defaultTopic,
      customTopic: '',
      pattern: defaultPatterns[0] || 'General',
      customPattern: '',
      subTopic: defaultPatterns[0] || 'General',
      difficulty: 'Intermediate',
      personalDifficulty: 5,
      alreadyPracticed: true, // Default to true so newly solved problems don't get re-prompted today
      lastPracticeDate: todayStr,
      nextReviewDate: tomorrowStr,
      initialSolveTimeMins: '15',
      initialSolveTimeSecs: '0',
      totalRepetitions: 1,
      notes: '',
      questionContent: '',
      solutionContent: '',
    });
    setIsFormOpen(true);
  };

  // Open edit modal
  const handleOpenEdit = (item: PracticeLink) => {
    setEditingId(item.id);
    const standardTopics = ['sql', 'python', 'system-design', 'qa', 'algorithms', 'data-engineering'];
    const isStandard = standardTopics.includes(item.topic.toLowerCase().trim());
    const lastDate = item.lastReviewDate 
      ? formatDateInTZ(item.lastReviewDate, 'yyyy-MM-dd') 
      : format(getNowInTZ(), 'yyyy-MM-dd');
    const nextDate = item.nextReviewDate 
      ? formatDateInTZ(item.nextReviewDate, 'yyyy-MM-dd') 
      : format(addDays(getNowInTZ(), 1), 'yyyy-MM-dd');

    const itemPat = getProblemPattern(item);
    const standardPatterns = getStandardPatternsForTopic(item.topic);
    const isStandardPat = standardPatterns.some(p => p.toLowerCase() === itemPat.toLowerCase());

    setFormData({
      title: item.title,
      url: item.url || '',
      topic: isStandard ? item.topic.toLowerCase().trim() : '__custom__',
      customTopic: isStandard ? '' : item.topic,
      pattern: isStandardPat ? itemPat : '__custom__',
      customPattern: isStandardPat ? '' : itemPat,
      subTopic: itemPat,
      difficulty: item.difficulty,
      personalDifficulty: item.personalDifficulty || 5,
      alreadyPracticed: Boolean(item.lastReviewDate && item.totalRepetitions > 0),
      lastPracticeDate: lastDate,
      nextReviewDate: nextDate,
      initialSolveTimeMins: Math.floor((item.lastSolveTime || 0) / 60).toString(),
      initialSolveTimeSecs: ((item.lastSolveTime || 0) % 60).toString(),
      totalRepetitions: item.totalRepetitions || 1,
      notes: item.notes || '',
      questionContent: item.questionContent || '',
      solutionContent: item.solutionContent || '',
    });
    setIsFormOpen(true);
  };

  // Save form (Add or Edit)
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Please provide a problem title.');
      return;
    }

    const effectiveTopic = formData.topic === '__custom__'
      ? (formData.customTopic.trim() || 'General')
      : formData.topic;

    const effectivePattern = formData.pattern === '__custom__'
      ? (formData.customPattern.trim() || 'General')
      : (formData.pattern.trim() || formData.subTopic.trim() || 'General');

    const now = getNowInTZ();
    const nowIso = now.toISOString();
    const solveTimeSeconds = (parseInt(formData.initialSolveTimeMins) || 0) * 60 + (parseInt(formData.initialSolveTimeSecs) || 0);

    // Compute lastReviewDate and nextReviewDate
    let lastReviewDate: string | undefined = undefined;
    let nextReviewDateIso: string = nowIso;
    let repetitions = 0;
    let totalRepetitions = 0;
    let interval = 0;

    if (formData.alreadyPracticed) {
      lastReviewDate = parseDateInTZ(formData.lastPracticeDate || format(now, 'yyyy-MM-dd'));
      if (formData.nextReviewDate) {
        nextReviewDateIso = parseDateInTZ(formData.nextReviewDate);
      } else {
        nextReviewDateIso = addDays(startOfDay(now), 1).toISOString();
      }
      repetitions = Math.max(1, formData.totalRepetitions || 1);
      totalRepetitions = Math.max(1, formData.totalRepetitions || 1);
      interval = Math.max(1, differenceInCalendarDays(new Date(nextReviewDateIso), new Date(lastReviewDate)));
    }

    if (editingId) {
      setLinks(prev => prev.map(item => {
        if (item.id === editingId) {
          const updated: PracticeLink = {
            ...item,
            title: formData.title,
            url: formData.url,
            topic: effectiveTopic,
            subTopic: effectivePattern,
            pattern: effectivePattern,
            difficulty: formData.difficulty,
            personalDifficulty: formData.personalDifficulty,
            notes: formData.notes,
            questionContent: formData.questionContent,
            solutionContent: formData.solutionContent,
            lastReviewDate: formData.alreadyPracticed 
              ? (formData.lastPracticeDate ? parseDateInTZ(formData.lastPracticeDate) : item.lastReviewDate) 
              : undefined,
            nextReviewDate: formData.nextReviewDate 
              ? parseDateInTZ(formData.nextReviewDate) 
              : item.nextReviewDate,
            lastSolveTime: solveTimeSeconds > 0 ? solveTimeSeconds : item.lastSolveTime,
            totalRepetitions: formData.alreadyPracticed 
              ? Math.max(1, formData.totalRepetitions || item.totalRepetitions) 
              : 0,
            repetitions: formData.alreadyPracticed 
              ? Math.max(1, repetitions || item.repetitions) 
              : 0,
            interval: formData.alreadyPracticed 
              ? Math.max(1, interval || item.interval) 
              : 0,
          };
          return {
            ...updated,
            priorityScore: calculatePriorityScore(updated)
          };
        }
        return item;
      }));
    } else {
      const newId = `prob-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newItem: PracticeLink = {
        id: newId,
        uid: 'guest_user',
        title: formData.title,
        url: formData.url,
        topic: effectiveTopic,
        subTopic: effectivePattern,
        pattern: effectivePattern,
        difficulty: formData.difficulty,
        personalDifficulty: formData.personalDifficulty,
        notes: formData.notes,
        questionContent: formData.questionContent,
        solutionContent: formData.solutionContent,
        repetitions,
        interval,
        easinessFactor: 2.5,
        lastReviewDate,
        nextReviewDate: nextReviewDateIso,
        totalTimeSpent: solveTimeSeconds,
        lastSolveTime: solveTimeSeconds,
        averageSolveTime: solveTimeSeconds,
        totalRepetitions,
        priorityScore: 0,
        createdAt: nowIso,
      };
      newItem.priorityScore = calculatePriorityScore(newItem);
      setLinks(prev => [newItem, ...prev]);
    }

    setIsFormOpen(false);
    setEditingId(null);
  };

  // Delete problem
  const handleDeleteItem = (id: string, title: string) => {
    if (confirm(`Delete "${title}"?`)) {
      setLinks(prev => prev.filter(l => l.id !== id));
      if (currentPracticeItem?.id === id) {
        setIsPracticing(false);
        setCurrentPracticeItem(null);
      }
    }
  };

  // Reset to starter problems
  const handleResetToStarters = () => {
    if (confirm('Reset your collection to the curated SQL & Python starter set? Any custom problems will be overwritten unless exported.')) {
      const starters = resetToStarterProblems();
      setLinks(starters);
      setIsPracticing(false);
      setCurrentPracticeItem(null);
    }
  };

  // Export data
  const handleExportData = () => {
    const jsonStr = exportProblemsJSON(links);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coderecall_interview_practice_${formatDateInTZ(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Open import modal
  const handleOpenImport = () => {
    setBackupJsonText('');
    setIsBackupModalOpen(true);
  };

  // Import JSON data
  const handleConfirmImport = () => {
    try {
      const imported = importProblemsJSON(backupJsonText);
      setLinks(imported);
      setIsBackupModalOpen(false);
      alert(`Successfully loaded ${imported.length} problems!`);
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : 'Invalid JSON format'}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 font-sans selection:bg-blue-100">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-900 rounded-2xl flex items-center justify-center text-white shadow-sm">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-xl tracking-tight text-gray-900">CodeRecall</span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider">
                  Python & SQL Tracker
                </span>
              </div>
              <p className="text-xs text-gray-500 hidden sm:block">
                Spaced Repetition & Recommendation Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleExportData}
              title="Export JSON Backup"
              className="p-2 sm:px-3 sm:py-2 border border-gray-200 rounded-xl text-xs font-mono text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-gray-500" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={handleOpenImport}
              title="Import JSON Backup"
              className="p-2 sm:px-3 sm:py-2 border border-gray-200 rounded-xl text-xs font-mono text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4 text-gray-500" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-medium hover:bg-black transition-all flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Problem</span>
            </button>
          </div>
        </div>
      </header>

      {/* Topic-Focused Screen Navigation */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-2.5 sticky top-[73px] z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
            {[
              { id: 'python', label: 'Python / Coding', icon: Code2, count: pythonCount, due: pythonDueCount, color: 'text-blue-600' },
              { id: 'sql', label: 'SQL', icon: Database, count: sqlCount, due: sqlDueCount, color: 'text-indigo-600' },
              { id: 'system-design', label: 'System Design', icon: Layers, count: systemDesignCount, due: systemDesignDueCount, color: 'text-purple-600' },
              { id: 'qa', label: 'Q&A / Conceptual', icon: BookOpen, count: qaCount, due: qaDueCount, color: 'text-teal-600' },
              { id: 'all', label: 'All Topics', icon: Flame, count: links.length, due: allDueCount, color: 'text-amber-600' },
            ].map(tab => {
              const isActive = activeScreen === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveScreen(tab.id as any);
                    setSelectedPattern('all');
                  }}
                  className={cn(
                    "px-4 py-2 rounded-2xl text-xs font-mono font-bold flex items-center gap-2 transition-all flex-shrink-0 cursor-pointer",
                    isActive
                      ? "bg-gray-900 text-white shadow-sm ring-1 ring-gray-900"
                      : "bg-gray-50/80 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200/60"
                  )}
                >
                  <Icon className={cn("w-4 h-4", isActive ? "text-white" : tab.color)} />
                  <span>{tab.label}</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px]",
                    isActive ? "bg-white/20 text-white" : "bg-gray-200/80 text-gray-700"
                  )}>
                    {tab.count}
                  </span>
                  {tab.due > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold animate-pulse">
                      {tab.due} due
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {dueItems.length > 0 && (
            <button
              onClick={() => handleStartPractice(dueItems[0])}
              className="hidden md:flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-mono font-bold shadow-sm transition-all flex-shrink-0 cursor-pointer"
              title={`Start practicing due problems for ${activeScreen === 'all' ? 'all topics' : formatTopicName(activeScreen)}`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Practice Queue ({dueItems.length} Due)</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* Success Alert Banner */}
        <AnimatePresence>
          {sessionSuccessMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-sm shadow-sm"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>{sessionSuccessMessage}</span>
              </div>
              <button onClick={() => setSessionSuccessMessage(null)} className="p-1 text-emerald-600 hover:bg-emerald-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Practice Card Modal / View */}
        <AnimatePresence>
          {isPracticing && currentPracticeItem && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="relative bg-white/70 backdrop-blur-sm p-4 sm:p-8 rounded-[36px] border border-gray-200 shadow-xl"
            >
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-700">
                    Live Practice Session
                  </span>
                  {dueItems.length > 0 && (
                    <span className="text-xs font-mono text-gray-400">
                      ({dueItems.length} problem{dueItems.length > 1 ? 's' : ''} due)
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setIsPracticing(false);
                    setCurrentPracticeItem(null);
                  }}
                  className="px-3 py-1 text-xs font-mono text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                >
                  <X className="w-4 h-4" /> Exit Session
                </button>
              </div>

              <PracticeLinkCard
                link={currentPracticeItem}
                onRate={handleRatePractice}
                onClose={() => {
                  setIsPracticing(false);
                  setCurrentPracticeItem(null);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Hero: Deadline Countdown & Smart Recommendation */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Target Deadline & Problem Count Goal Card */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-3xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider text-blue-200 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-blue-400" />
                  Interview Goal
                </span>
                <button
                  onClick={() => {
                    setTempGoalDate(goalSettings.targetDate);
                    setTempGoalCount(goalSettings.targetCount.toString());
                    setIsGoalModalOpen(true);
                  }}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] font-mono text-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
                  title="Customize Target Deadline & Problems Count"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit Goal</span>
                </button>
              </div>

              <div>
                <p className="text-xs text-gray-400 font-mono uppercase tracking-wider">
                  Target: {deadlineInfo.formattedDate}
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl sm:text-5xl font-serif font-bold text-white tracking-tight">
                    {deadlineInfo.daysRemaining}
                  </span>
                  <span className="text-sm font-mono text-gray-300">days left</span>
                </div>
              </div>

              {/* Progress towards target count */}
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-300">
                    <strong className="text-white font-bold">{deadlineInfo.solvedCount}</strong> / {deadlineInfo.targetCount} problems
                  </span>
                  <span className="text-emerald-400 font-bold">{deadlineInfo.progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full transition-all duration-500" 
                    style={{ width: `${deadlineInfo.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-gray-300">
              <span>Required Pace:</span>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-bold">
                ~{deadlineInfo.dailyPace} problems / day
              </span>
            </div>
          </div>

          {/* Smart Recommendation Hero Card */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
            {topRecommendation ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "p-1.5 rounded-xl",
                      topRecommendation.allCaughtUp ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {topRecommendation.allCaughtUp ? <CheckCircle2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    </span>
                    <span className={cn(
                      "text-xs font-mono font-bold uppercase tracking-wider",
                      topRecommendation.allCaughtUp ? "text-emerald-700" : "text-amber-700"
                    )}>
                      {topRecommendation.allCaughtUp ? 'All Caught Up Today' : 'Recommended Next Problem'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
                    {topRecommendation.allCaughtUp 
                      ? `Next Review: ${formatDateInTZ(topRecommendation.item.nextReviewDate, 'MMM d')}`
                      : `Priority Score: ${topRecommendation.item.priorityScore}`}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cn(
                      "px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded border",
                      getTopicBadgeClass(topRecommendation.item.topic)
                    )}>
                      {formatTopicName(topRecommendation.item.topic)}
                    </span>
                    <span className="text-xs font-mono text-gray-400">
                      {topRecommendation.item.subTopic || 'General'}
                    </span>
                    <span className="text-xs text-gray-300">•</span>
                    <span className="text-xs font-mono text-gray-500">
                      {topRecommendation.item.difficulty}
                    </span>
                  </div>
                  <h3 className="text-xl font-serif font-bold text-gray-900">
                    {topRecommendation.item.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 italic">
                    Why: {topRecommendation.reason}
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2 flex-wrap">
                  <button
                    onClick={() => handleStartPractice(topRecommendation.item)}
                    className={cn(
                      "px-6 py-3 rounded-2xl font-medium text-sm transition-all flex items-center gap-2 shadow-md group cursor-pointer",
                      topRecommendation.allCaughtUp
                        ? "bg-gray-900 hover:bg-black text-white shadow-gray-200"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100"
                    )}
                  >
                    <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                    <span>{topRecommendation.allCaughtUp ? 'Practice Ahead (Optional)' : `Start ${activeScreen === 'all' ? '' : formatTopicName(activeScreen) + ' '}Practice`}</span>
                  </button>
                  {dueItems.length > 1 && (
                    <button
                      onClick={() => handleStartPractice(dueItems[0])}
                      className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl text-xs font-mono font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Practice all due problems in this topic back-to-back"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Practice Queue ({dueItems.length} Due)</span>
                    </button>
                  )}
                  {topRecommendation.item.url && (
                    <a
                      href={topRecommendation.item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-3 border border-gray-200 rounded-2xl text-xs font-mono text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Link</span>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
                <BookOpen className="w-8 h-8 mb-2 stroke-1" />
                <p className="text-sm font-serif">No problems added yet for {formatTopicName(activeScreen)}.</p>
                <button
                  onClick={handleResetToStarters}
                  className="mt-3 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-medium cursor-pointer"
                >
                  Load Curated Starter Problems
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Topic-Focused Practice Stats & Pattern Curriculum */}
        <PatternStatsBar
          analytics={topicAnalytics}
          activeTopic={activeScreen}
          selectedPattern={selectedPattern}
          onSelectPattern={setSelectedPattern}
          onStartPatternPractice={(pattern) => {
            setSelectedPattern(pattern);
            const patternProblems = currentScreenProblems.filter(p => getProblemPattern(p).toLowerCase() === pattern.toLowerCase());
            const dueProblem = patternProblems.find(isDue);
            if (dueProblem) {
              handleStartPractice(dueProblem);
            } else if (patternProblems.length > 0) {
              handleStartPractice(patternProblems[0]);
            }
          }}
        />

        {/* Filters and Search Bar */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-2.5 items-center">
            {/* Active Topic Screen Indicator */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-2xl text-xs font-mono font-bold text-gray-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{activeScreen === 'all' ? 'All Topics' : formatTopicName(activeScreen)} Catalog</span>
              <span className="px-1.5 py-0.2 bg-white rounded-md text-[10px] text-gray-600 font-semibold shadow-xs">
                {filteredLinks.length}
              </span>
            </div>

            {/* Pattern Filter Dropdown */}
            <select
              value={selectedPattern}
              onChange={e => setSelectedPattern(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-700 focus:outline-none max-w-[200px] truncate"
            >
              <option value="all">All Patterns ({currentScreenProblems.length})</option>
              {topicAnalytics.patternMetrics.map(pm => (
                <option key={pm.name} value={pm.name}>
                  {pm.name} ({pm.problemsCount})
                </option>
              ))}
            </select>

            {/* Difficulty Filter */}
            <select
              value={activeDifficulty}
              onChange={e => setActiveDifficulty(e.target.value as any)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-700 focus:outline-none"
            >
              <option value="all">All Difficulties</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>

            {/* Only Due Toggle */}
            <button
              onClick={() => setOnlyDue(!onlyDue)}
              className={cn(
                "px-3 py-2 rounded-xl text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer",
                onlyDue
                  ? "bg-amber-100 text-amber-800 border border-amber-300 shadow-sm"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Only Due ({dueItems.length})</span>
            </button>

            {/* Reset Filters button if any filter is active */}
            {(selectedPattern !== 'all' || activeDifficulty !== 'all' || onlyDue || searchQuery.trim() !== '') && (
              <button
                onClick={() => {
                  setSelectedPattern('all');
                  setActiveDifficulty('all');
                  setOnlyDue(false);
                  setSearchQuery('');
                }}
                className="px-2.5 py-1.5 text-xs font-mono text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${activeScreen === 'all' ? 'all' : formatTopicName(activeScreen)} problems, notes...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>

        {/* Problems & Projects Table */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-serif font-bold text-lg text-gray-900">Your Practice Catalog</h2>
              <span className="text-xs font-mono text-gray-400">({filteredLinks.length} items)</span>
            </div>

            <button
              onClick={handleResetToStarters}
              className="text-xs font-mono text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to Starters</span>
            </button>
          </div>

          {filteredLinks.length === 0 ? (
            <div className="p-12 text-center text-gray-400 font-serif">
              <p>No practice items match your current filter.</p>
              <button
                onClick={() => {
                  setSelectedPattern('all');
                  setActiveDifficulty('all');
                  setOnlyDue(false);
                  setSearchQuery('');
                }}
                className="mt-2 text-xs font-mono text-blue-600 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Problem</th>
                    <th className="px-6 py-4">Topic & Area</th>
                    <th className="px-6 py-4">Difficulty</th>
                    <th className="px-6 py-4">SRS State</th>
                    <th className="px-6 py-4">Last / Next</th>
                    <th className="px-6 py-4 text-right">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {filteredLinks.map(item => {
                    const itemIsDue = isDue(item);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/70 transition-colors group">
                        {/* Practice Button */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleStartPractice(item)}
                              className={cn(
                                "p-2 sm:px-3 sm:py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 text-xs font-mono font-medium",
                                itemIsDue
                                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-900 hover:text-white"
                              )}
                              title="Practice problem now"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span className="hidden sm:inline">Practice</span>
                            </button>
                            {itemIsDue && (
                              <button
                                onClick={() => handleQuickMarkDone(item)}
                                className="p-2 sm:px-2.5 sm:py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white transition-all text-xs font-mono font-medium flex items-center gap-1"
                                title="One-click: I already solved this today! Mark done & schedule next review for tomorrow."
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 hover:text-white" />
                                <span>Done</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Problem Title & External Link */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-serif font-bold text-gray-900 leading-tight">
                              {item.title}
                            </span>
                            {item.url ? (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-mono text-blue-600 hover:text-blue-800 flex items-center gap-1 max-w-[240px] truncate"
                              >
                                <span className="truncate">{item.url.replace(/^https?:\/\//, '')}</span>
                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              </a>
                            ) : (
                              <span className="text-[10px] font-mono text-gray-400 italic">Self-contained</span>
                            )}
                          </div>
                        </td>

                        {/* Topic & Subtopic */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider w-fit border",
                              getTopicBadgeClass(item.topic)
                            )}>
                              {formatTopicName(item.topic)}
                            </span>
                            <span className="text-[11px] font-mono text-gray-600 font-medium truncate max-w-[160px]">
                              {getProblemPattern(item)}
                            </span>
                          </div>
                        </td>

                        {/* Difficulty */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider w-fit",
                              item.difficulty === 'Beginner' && "bg-green-50 text-green-700",
                              item.difficulty === 'Intermediate' && "bg-amber-50 text-amber-700",
                              item.difficulty === 'Advanced' && "bg-rose-50 text-rose-700"
                            )}>
                              {item.difficulty}
                            </span>
                            <span className="text-[10px] font-mono text-gray-400">
                              Felt: {item.personalDifficulty || 5}/10
                            </span>
                          </div>
                        </td>

                        {/* SRS Stats */}
                        <td className="px-6 py-4 font-mono text-xs text-gray-600">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 uppercase">Interval:</span>
                              <span className="font-bold text-gray-900">{item.interval || 0}d</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 uppercase">Practiced:</span>
                              <span>{item.totalRepetitions || 0}x</span>
                            </div>
                          </div>
                        </td>

                        {/* Dates */}
                        <td className="px-6 py-4 font-mono text-xs">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                "w-2 h-2 rounded-full",
                                itemIsDue ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                              )} />
                              <span className={cn("text-xs", itemIsDue ? "font-bold text-amber-700" : "text-gray-700")}>
                                {itemIsDue ? 'Due Now' : `Next: ${formatDateInTZ(item.nextReviewDate, 'MMM d')}`}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-400">
                              {item.lastReviewDate 
                                ? `Last: ${formatDateInTZ(item.lastReviewDate, 'MMM d, yyyy')}` 
                                : 'Backlog (Not yet practiced)'}
                            </span>
                          </div>
                        </td>

                        {/* Edit & Delete Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Edit problem"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id, item.title)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete problem"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-gray-100 my-8 space-y-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <h3 className="text-xl font-serif font-bold text-gray-900">
                  {editingId ? 'Edit Practice Problem' : 'Add New Problem / Project'}
                </h3>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-900 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveForm} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1.5">
                    Problem Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Department Top 3 Salaries or LRU Cache"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1.5">
                      Problem Type / Topic *
                    </label>
                    <select
                      value={formData.topic}
                      onChange={e => {
                        const newTopic = e.target.value;
                        const standardPatterns = getStandardPatternsForTopic(newTopic);
                        setFormData({
                          ...formData,
                          topic: newTopic,
                          pattern: standardPatterns[0] || 'General',
                          customPattern: '',
                          subTopic: standardPatterns[0] || 'General',
                        });
                      }}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      <option value="python">Python / Coding</option>
                      <option value="sql">SQL</option>
                      <option value="system-design">System Design</option>
                      <option value="qa">Q&A / Conceptual</option>
                      <option value="algorithms">Algorithms & Data Structures</option>
                      <option value="data-engineering">Data Engineering</option>
                      <option value="__custom__">+ Custom Category...</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1.5">
                      Difficulty
                    </label>
                    <select
                      value={formData.difficulty}
                      onChange={e => setFormData({ ...formData, difficulty: e.target.value as Difficulty })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>
                </div>

                {formData.topic === '__custom__' && (
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1.5">
                      Custom Category Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Behavioral, ML System Design, Spark, etc."
                      value={formData.customTopic}
                      onChange={e => setFormData({ ...formData, customTopic: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1.5">
                      Pattern / Technique *
                    </label>
                    <select
                      value={formData.pattern}
                      onChange={e => {
                        const pat = e.target.value;
                        setFormData({
                          ...formData,
                          pattern: pat,
                          subTopic: pat === '__custom__' ? formData.customPattern : pat,
                        });
                      }}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      {getStandardPatternsForTopic(formData.topic).map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                      <option value="__custom__">+ Custom Pattern...</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1.5">
                      Felt Difficulty (1 - 10)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={formData.personalDifficulty}
                      onChange={e => setFormData({ ...formData, personalDifficulty: parseInt(e.target.value) || 5 })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono"
                    />
                  </div>
                </div>

                {formData.pattern === '__custom__' && (
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1.5">
                      Custom Pattern Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Interval Tree, Monotonic Stack, Backtracking..."
                      value={formData.customPattern}
                      onChange={e => setFormData({ ...formData, customPattern: e.target.value, subTopic: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1.5">
                    Link / Problem URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://leetcode.com/... or GitHub link"
                    value={formData.url}
                    onChange={e => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                {/* Practice Status & Dates Section */}
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3.5">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-2">
                      Practice Status *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const todayStr = format(getNowInTZ(), 'yyyy-MM-dd');
                          const tomorrowStr = format(addDays(getNowInTZ(), 1), 'yyyy-MM-dd');
                          setFormData(prev => ({
                            ...prev,
                            alreadyPracticed: true,
                            lastPracticeDate: prev.lastPracticeDate || todayStr,
                            nextReviewDate: prev.nextReviewDate || tomorrowStr,
                            totalRepetitions: Math.max(1, prev.totalRepetitions || 1),
                          }));
                        }}
                        className={cn(
                          "p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 cursor-pointer",
                          formData.alreadyPracticed
                            ? "bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20"
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold font-mono text-emerald-900">✅ Solved / Done</span>
                          {formData.alreadyPracticed && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        </div>
                        <span className="text-[11px] text-gray-500">
                          I already solved this today. Review will be scheduled for tomorrow.
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            alreadyPracticed: false,
                            totalRepetitions: 0,
                          }));
                        }}
                        className={cn(
                          "p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 cursor-pointer",
                          !formData.alreadyPracticed
                            ? "bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-500/20"
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold font-mono text-amber-900">⏳ To-Do / Backlog</span>
                          {!formData.alreadyPracticed && <Clock className="w-4 h-4 text-amber-600" />}
                        </div>
                        <span className="text-[11px] text-gray-500">
                          Haven't solved it yet. Put in queue for upcoming practice.
                        </span>
                      </button>
                    </div>
                  </div>

                  {formData.alreadyPracticed ? (
                    <div className="space-y-3 pt-2 border-t border-gray-200/70">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-1">
                            Last Practiced Date *
                          </label>
                          <input
                            type="date"
                            required={formData.alreadyPracticed}
                            value={formData.lastPracticeDate}
                            onChange={e => {
                              const newLastDate = e.target.value;
                              setFormData(prev => {
                                let next = prev.nextReviewDate;
                                if (newLastDate && (!next || next <= newLastDate)) {
                                  try {
                                    next = format(addDays(new Date(newLastDate), 1), 'yyyy-MM-dd');
                                  } catch (err) {}
                                }
                                return {
                                  ...prev,
                                  lastPracticeDate: newLastDate,
                                  nextReviewDate: next,
                                };
                              });
                            }}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-1">
                            Next Scheduled Review *
                          </label>
                          <input
                            type="date"
                            required={formData.alreadyPracticed}
                            value={formData.nextReviewDate}
                            onChange={e => setFormData({ ...formData, nextReviewDate: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                          />
                        </div>
                      </div>

                      {/* Quick Presets for Next Review */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono text-gray-400">Quick schedule next review:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const base = formData.lastPracticeDate ? new Date(formData.lastPracticeDate) : getNowInTZ();
                            setFormData({ ...formData, nextReviewDate: format(addDays(base, 1), 'yyyy-MM-dd') });
                          }}
                          className="px-2 py-0.5 bg-white border border-gray-200 hover:border-gray-400 rounded text-[10px] font-mono text-gray-700 transition-colors"
                        >
                          Tomorrow (+1d)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const base = formData.lastPracticeDate ? new Date(formData.lastPracticeDate) : getNowInTZ();
                            setFormData({ ...formData, nextReviewDate: format(addDays(base, 3), 'yyyy-MM-dd') });
                          }}
                          className="px-2 py-0.5 bg-white border border-gray-200 hover:border-gray-400 rounded text-[10px] font-mono text-gray-700 transition-colors"
                        >
                          +3 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const base = formData.lastPracticeDate ? new Date(formData.lastPracticeDate) : getNowInTZ();
                            setFormData({ ...formData, nextReviewDate: format(addDays(base, 7), 'yyyy-MM-dd') });
                          }}
                          className="px-2 py-0.5 bg-white border border-gray-200 hover:border-gray-400 rounded text-[10px] font-mono text-gray-700 transition-colors"
                        >
                          +1 Week
                        </button>
                      </div>

                      {/* Solve time & Repetitions */}
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-1">
                            Solve Time (Mins)
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="15"
                            value={formData.initialSolveTimeMins}
                            onChange={e => setFormData({ ...formData, initialSolveTimeMins: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-1">
                            Times Solved
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={formData.totalRepetitions}
                            onChange={e => setFormData({ ...formData, totalRepetitions: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                          />
                        </div>
                      </div>

                      <p className="text-[11px] font-mono text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
                        <span>Saved as completed. It will not be re-prompted today and will wait until your scheduled Next Review date.</span>
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] font-mono text-gray-500 bg-white p-2.5 rounded-lg border border-gray-200/70">
                      ℹ️ This problem will be added to your study backlog ready for your initial practice.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1.5">
                    Your Notes / Key Insights
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Gotchas, time complexity, tips to remember..."
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1.5">
                    Ideal Solution (Markdown / Code)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Paste reference SQL query or Python function..."
                    value={formData.solutionContent}
                    onChange={e => setFormData({ ...formData, solutionContent: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 text-xs font-mono text-gray-500 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-medium hover:bg-black transition-all"
                  >
                    {editingId ? 'Save Changes' : 'Create Problem'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Backup / Restore JSON Modal */}
      <AnimatePresence>
        {isBackupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-100 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="text-lg font-serif font-bold text-gray-900">Import Practice Backup</h3>
                <button onClick={() => setIsBackupModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-900">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-gray-500">
                Paste your exported JSON backup text below to restore or sync your practice progress.
              </p>

              <textarea
                rows={8}
                placeholder="[ { ... } ]"
                value={backupJsonText}
                onChange={e => setBackupJsonText(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
              />

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  onClick={() => setIsBackupModalOpen(false)}
                  className="px-4 py-2 text-xs font-mono text-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={!backupJsonText.trim()}
                  className="px-5 py-2.5 bg-gray-900 disabled:opacity-50 text-white rounded-xl text-xs font-medium hover:bg-black transition-all"
                >
                  Confirm Import
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Goal Settings Modal */}
      <AnimatePresence>
        {isGoalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-6"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <Target className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-serif font-bold text-gray-900">Customize Target Goal</h3>
                </div>
                <button onClick={() => setIsGoalModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-900 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1.5">
                    Target Deadline Date
                  </label>
                  <input
                    type="date"
                    value={tempGoalDate}
                    onChange={e => setTempGoalDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Your target completion date (default: Dec 31).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1.5">
                    Target Problem Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={tempGoalCount}
                    onChange={e => setTempGoalCount(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Number of problems you want to practice & master (e.g., 1000).
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="px-4 py-2 text-xs font-mono text-gray-500 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const count = Math.max(1, parseInt(tempGoalCount) || 1000);
                    const newGoal: GoalSettings = {
                      targetDate: tempGoalDate || `${new Date().getFullYear()}-12-31`,
                      targetCount: count,
                    };
                    setGoalSettings(newGoal);
                    try {
                      localStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(newGoal));
                    } catch (e) {}
                    setIsGoalModalOpen(false);
                  }}
                  className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-medium hover:bg-black transition-all"
                >
                  Save Goal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
