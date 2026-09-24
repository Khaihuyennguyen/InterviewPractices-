import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PracticeLink } from '../types';
import { cn, formatTopicName, getTopicBadgeClass } from '../lib/utils';
import { Check, X, RotateCcw, ExternalLink, Clock, Sparkles, Code2, Play, Pause, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import Markdown from 'react-markdown';

interface PracticeLinkCardProps {
  link: PracticeLink;
  onRate: (quality: number, solveTime: number, personalDifficulty: number) => void;
  onClose?: () => void;
}

export const PracticeLinkCard: React.FC<PracticeLinkCardProps> = ({ link, onRate, onClose }) => {
  const [mins, setMins] = useState<string>('0');
  const [secs, setSecs] = useState<string>('0');
  const [personalDifficulty, setPersonalDifficulty] = useState<number>(link.personalDifficulty || 5);
  const [showSolution, setShowSolution] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Live stopwatch
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          const next = prev + 1;
          setMins(Math.floor(next / 60).toString());
          setSecs((next % 60).toString());
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const handleRating = (quality: number) => {
    setIsTimerRunning(false);
    const totalSeconds = (parseInt(mins) || 0) * 60 + (parseInt(secs) || 0);
    onRate(quality, totalSeconds, personalDifficulty);
  };

  const formatDisplayTime = (s: number) => {
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}m ${rs}s`;
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[32px] shadow-xl border border-gray-100 p-8 flex flex-col gap-8"
      >
        {/* Header Tags & Title */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {typeof link.problemNumber === 'number' && (
                <span className="px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border bg-gray-900 text-white">
                  #{link.problemNumber}
                </span>
              )}
              <span className={cn(
                "px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider rounded-lg border",
                getTopicBadgeClass(link.topic)
              )}>
                {formatTopicName(link.topic)}
              </span>
              <span className="px-2.5 py-1 text-[11px] font-mono font-medium uppercase tracking-wider bg-gray-100 text-gray-600 rounded-lg">
                {link.subTopic || 'General'}
              </span>
              <span className={cn(
                "px-2.5 py-1 text-[11px] font-mono font-medium uppercase tracking-wider rounded-lg",
                link.difficulty === 'Beginner' && "bg-green-50 text-green-700",
                link.difficulty === 'Intermediate' && "bg-amber-50 text-amber-700",
                link.difficulty === 'Advanced' && "bg-rose-50 text-rose-700"
              )}>
                {link.difficulty}
              </span>
            </div>

            {link.totalRepetitions > 0 && (
              <span className="text-xs font-mono text-gray-400">
                Reviewed {link.totalRepetitions}x • Last: {formatDisplayTime(link.lastSolveTime)}
              </span>
            )}
          </div>

          <h2 className="text-2xl md:text-3xl font-serif font-medium text-gray-900 leading-tight">
            {typeof link.problemNumber === 'number' ? `#${link.problemNumber}. ` : ''}{link.title}
          </h2>

          {link.notes && (
            <div className="p-4 bg-amber-50/60 border border-amber-100/80 rounded-2xl text-amber-900 text-sm leading-relaxed">
              <span className="font-semibold block text-xs uppercase tracking-wider text-amber-700 mb-1">Your Notes / Strategy</span>
              {link.notes}
            </div>
          )}
        </div>

        {/* Problem Description (Markdown) */}
        {link.questionContent && (
          <div className="p-6 bg-gray-50/70 rounded-2xl border border-gray-100">
            <h3 className="text-xs font-mono uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-gray-500" />
              Problem Description
            </h3>
            <div className="text-gray-800 text-sm leading-relaxed prose prose-sm max-w-none">
              <Markdown>{link.questionContent}</Markdown>
            </div>
          </div>
        )}

        {/* Action Link to problem */}
        {link.url && (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 px-6 bg-gray-900 text-white rounded-2xl font-medium hover:bg-black transition-all flex items-center justify-between group shadow-md shadow-gray-200"
          >
            <div className="flex items-center gap-3">
              <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
              <span className="text-base font-medium">Open Problem in External Tab</span>
            </div>
            <span className="text-xs font-mono opacity-60 truncate max-w-[240px]">
              {link.url.replace(/^https?:\/\/(www\.)?/, '')}
            </span>
          </a>
        )}

        {/* Ideal Solution Accordion */}
        {link.solutionContent && (
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowSolution(!showSolution)}
              className="w-full p-4 bg-gray-50 hover:bg-gray-100/80 transition-colors flex items-center justify-between text-left"
            >
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                {showSolution ? 'Hide Solution Reference' : 'Reveal Solution Reference'}
              </span>
              {showSolution ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            <AnimatePresence>
              {showSolution && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-6 bg-gray-950 text-gray-200 text-sm font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed"
                >
                  <Markdown>{link.solutionContent}</Markdown>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Practice Stats & Rating Controls */}
        <div className="pt-6 border-t border-gray-100 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Stopwatch & Manual input */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-gray-400" />
                  Practice Timer
                </span>
                <button
                  type="button"
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-mono font-medium flex items-center gap-1.5 transition-all",
                    isTimerRunning
                      ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                      : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  )}
                >
                  {isTimerRunning ? (
                    <>
                      <Pause className="w-3 h-3 fill-current" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" /> Start Timer
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Min"
                  value={mins}
                  onChange={e => {
                    setMins(e.target.value);
                    setTimerSeconds((parseInt(e.target.value) || 0) * 60 + (parseInt(secs) || 0));
                  }}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <span className="font-mono text-gray-400">:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="Sec"
                  value={secs}
                  onChange={e => {
                    setSecs(e.target.value);
                    setTimerSeconds((parseInt(mins) || 0) * 60 + (parseInt(e.target.value) || 0));
                  }}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>

            {/* Personal Difficulty Slider */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-gray-400" />
                  Your Felt Difficulty
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">
                  {personalDifficulty} / 10
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={personalDifficulty}
                onChange={e => setPersonalDifficulty(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
              />
              <div className="flex justify-between text-[10px] font-mono text-gray-400 uppercase">
                <span>1 - Trivial</span>
                <span>5 - Moderate</span>
                <span>10 - Challenging</span>
              </div>
            </div>
          </div>

          {/* Rate Response Quality (SM-2 Spaced Repetition) */}
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-xs font-mono uppercase tracking-wider text-gray-500">
                Rate your recall & solve performance:
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                The SM-2 algorithm will automatically schedule your next review interval.
              </p>
            </div>

            <div className="grid grid-cols-5 gap-2 sm:gap-3">
              {[
                { q: 1, label: 'Forgot', sub: 'Blank / Needed answer', color: 'hover:bg-rose-500 hover:border-rose-500', icon: X },
                { q: 2, label: 'Hard', sub: 'Struggled / Many hints', color: 'hover:bg-amber-500 hover:border-amber-500', icon: RotateCcw },
                { q: 3, label: 'Good', sub: 'Correct with effort', color: 'hover:bg-blue-500 hover:border-blue-500', icon: Check },
                { q: 4, label: 'Easy', sub: 'Smooth solve', color: 'hover:bg-teal-500 hover:border-teal-500', icon: Check },
                { q: 5, label: 'Perfect', sub: 'Instant recall & code', color: 'hover:bg-emerald-600 hover:border-emerald-600', icon: Check },
              ].map(btn => (
                <button
                  key={btn.q}
                  type="button"
                  onClick={() => handleRating(btn.q)}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-2xl border border-gray-200 bg-white hover:text-white transition-all text-gray-700 shadow-sm group text-center",
                    btn.color
                  )}
                >
                  <btn.icon className="w-5 h-5 mb-1 text-gray-400 group-hover:text-white transition-colors" />
                  <span className="text-xs font-bold uppercase tracking-wider">{btn.label}</span>
                  <span className="text-[9px] opacity-70 hidden sm:block mt-0.5 leading-tight group-hover:opacity-90">{btn.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
