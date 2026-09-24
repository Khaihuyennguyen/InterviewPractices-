import React from 'react';
import { TopicAnalytics, PatternMetric } from '../lib/analytics';
import { Trophy, AlertTriangle, Flame, TrendingUp, Calendar, Layers, ChevronRight, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface PatternStatsBarProps {
  analytics: TopicAnalytics;
  activeTopic: string;
  selectedPattern: string | 'all';
  onSelectPattern: (pattern: string | 'all') => void;
  onStartPatternPractice?: (pattern: string) => void;
}

export const PatternStatsBar: React.FC<PatternStatsBarProps> = ({
  analytics,
  activeTopic,
  selectedPattern,
  onSelectPattern,
  onStartPatternPractice,
}) => {
  const isAll = activeTopic === 'all';
  const topicTitle = isAll ? 'Global Coding & SQL' : `${analytics.topic.toUpperCase()}`;

  return (
    <div className="space-y-6">
      {/* 1. Practice Frequency Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Today */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Today</span>
            <Flame className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-serif font-bold text-gray-900">{analytics.practicesToday}</span>
            <span className="text-[11px] font-mono text-gray-400 ml-1">solves</span>
          </div>
        </div>

        {/* This Week */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">This Week</span>
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-serif font-bold text-gray-900">{analytics.practicesThisWeek}</span>
            <span className="text-[11px] font-mono text-gray-400 ml-1">solves</span>
          </div>
        </div>

        {/* This Month */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">This Month</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-serif font-bold text-gray-900">{analytics.practicesThisMonth}</span>
            <span className="text-[11px] font-mono text-gray-400 ml-1">solves</span>
          </div>
        </div>

        {/* Total All-Time */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Total Solves</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-serif font-bold text-gray-900">{analytics.practicesTotal}</span>
            <span className="text-[11px] font-mono text-gray-400 ml-1">reps</span>
          </div>
        </div>

        {/* Daily Pace */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Avg / Day</span>
            <span className="text-[10px] font-mono font-bold text-gray-500">30d</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-serif font-bold text-gray-900">{analytics.dailyAverage}</span>
            <span className="text-[11px] font-mono text-gray-400 ml-1">/ day</span>
          </div>
        </div>

        {/* Weekly Pace */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Avg / Week</span>
            <span className="text-[10px] font-mono font-bold text-gray-500">4wk</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-serif font-bold text-gray-900">{analytics.weeklyAverage}</span>
            <span className="text-[11px] font-mono text-gray-400 ml-1">/ wk</span>
          </div>
        </div>
      </div>

      {/* 2. Most Practiced Pattern vs Pattern Needing Attention */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Most Practiced */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/70 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-sm">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-amber-800">
                Most Practiced Pattern
              </span>
              <h4 className="text-base font-serif font-bold text-gray-900">
                {analytics.mostPracticedPattern ? analytics.mostPracticedPattern.name : 'Not enough data yet'}
              </h4>
              <p className="text-xs font-mono text-gray-500">
                {analytics.mostPracticedPattern
                  ? `${analytics.mostPracticedPattern.totalPractices} session(s) • ${analytics.mostPracticedPattern.problemsCount} problem(s)`
                  : 'Start practicing to reveal your strongest pattern!'}
              </p>
            </div>
          </div>
          {analytics.mostPracticedPattern && (
            <button
              onClick={() => onSelectPattern(analytics.mostPracticedPattern!.name)}
              className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-50 rounded-xl text-xs font-mono font-semibold text-amber-900 transition-colors"
            >
              Filter
            </button>
          )}
        </div>

        {/* Needs Practice */}
        <div className="bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border border-blue-200/70 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-blue-800">
                Needs More Practice
              </span>
              <h4 className="text-base font-serif font-bold text-gray-900">
                {analytics.leastPracticedPattern ? analytics.leastPracticedPattern.name : 'All patterns balanced!'}
              </h4>
              <p className="text-xs font-mono text-gray-500">
                {analytics.leastPracticedPattern
                  ? `${analytics.leastPracticedPattern.totalPractices} session(s) • ${analytics.leastPracticedPattern.problemsCount} problem(s)`
                  : 'Great job maintaining equal coverage across patterns.'}
              </p>
            </div>
          </div>
          {analytics.leastPracticedPattern && (
            <button
              onClick={() => onSelectPattern(analytics.leastPracticedPattern!.name)}
              className="px-3 py-1.5 bg-white border border-blue-300 hover:bg-blue-50 rounded-xl text-xs font-mono font-semibold text-blue-900 transition-colors"
            >
              Filter
            </button>
          )}
        </div>
      </div>

      {/* 3. Interactive Pattern Taxonomy Pills Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gray-600" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-800">
              {topicTitle} Patterns & Curriculum
            </span>
          </div>
          <span className="text-[11px] font-mono text-gray-400">
            Click pattern to filter • {analytics.patternMetrics.length} patterns available
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => onSelectPattern('all')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all flex items-center gap-1.5 flex-shrink-0",
              selectedPattern === 'all'
                ? "bg-gray-900 text-white shadow-sm"
                : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"
            )}
          >
            <span>All Patterns</span>
            <span className="px-1.5 py-0.2 bg-white/20 rounded text-[10px]">
              {analytics.totalProblems}
            </span>
          </button>

          {analytics.patternMetrics.map(pat => {
            const isSelected = selectedPattern.toLowerCase() === pat.name.toLowerCase();
            return (
              <button
                key={pat.name}
                onClick={() => onSelectPattern(pat.name)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all flex items-center gap-1.5 flex-shrink-0 border",
                  isSelected
                    ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                    : pat.problemsCount > 0
                      ? "bg-white border-gray-200 text-gray-800 hover:border-gray-400"
                      : "bg-gray-50/70 border-gray-200/60 text-gray-400 hover:bg-gray-100"
                )}
              >
                <span>{pat.name}</span>
                {pat.problemsCount > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.2 rounded text-[10px] font-bold",
                    isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
                  )}>
                    {pat.problemsCount}
                  </span>
                )}
                {pat.dueCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title={`${pat.dueCount} due`} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
