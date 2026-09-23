import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PracticeLink } from '../types';
import { cn } from '../lib/utils';
import { Check, X, RotateCcw, ExternalLink, Clock, Tag, BarChart, Sparkles, Mic2, Code2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { AudioRecorder } from './AudioRecorder';

interface PracticeLinkCardProps {
  link: PracticeLink;
  onRate: (quality: number, solveTime: number, personalDifficulty: number) => void;
  onAudioSubmit: (base64: string) => void;
  isSubmittingAudio?: boolean;
}

export const PracticeLinkCard: React.FC<PracticeLinkCardProps> = ({ link, onRate, onAudioSubmit, isSubmittingAudio }) => {
  const [mins, setMins] = React.useState<string>('0');
  const [secs, setSecs] = React.useState<string>('0');
  const [personalDifficulty, setPersonalDifficulty] = React.useState<number>(5);
  const [showSolution, setShowSolution] = React.useState(false);

  const handleRating = (q: number) => {
    const totalSeconds = (parseInt(mins) || 0) * 60 + (parseInt(secs) || 0);
    onRate(q, totalSeconds, personalDifficulty);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}m ${rs}s`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[32px] shadow-xl border border-gray-100 p-8 flex flex-col gap-8"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider bg-gray-100 text-gray-500 rounded">
              {link.topic}
            </span>
            <span className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider bg-blue-50 text-blue-600 rounded">
              {link.subTopic || 'General'}
            </span>
            <span className={cn(
              "px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded",
              link.difficulty === 'Beginner' && "bg-green-50 text-green-600",
              link.difficulty === 'Intermediate' && "bg-orange-50 text-orange-600",
              link.difficulty === 'Advanced' && "bg-red-50 text-red-600"
            )}>
              {link.difficulty}
            </span>
          </div>

          <h2 className="text-2xl font-serif font-medium text-gray-900 leading-tight">
            {link.title}
          </h2>

          {link.notes && (
            <p className="text-gray-500 text-sm leading-relaxed">
              {link.notes}
            </p>
          )}

          {link.questionContent && (
            <div className="mt-4 p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                <Code2 className="w-3 h-3" />
                Question / Problem Description
              </h3>
              <div className="text-gray-800 text-sm leading-relaxed prose prose-sm max-w-none">
                <Markdown>{link.questionContent}</Markdown>
              </div>
            </div>
          )}

          {link.solutionContent && (
            <div className="mt-4 space-y-3">
              <button
                onClick={() => setShowSolution(!showSolution)}
                className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-blue-500 hover:text-blue-600 transition-colors"
              >
                {showSolution ? 'Hide Ideal Solution' : 'View Ideal Solution'}
              </button>
              <AnimatePresence>
                {showSolution && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-6 bg-gray-900 rounded-2xl border border-gray-800 text-gray-300 text-sm font-mono whitespace-pre-wrap overflow-x-auto">
                      <Markdown>{link.solutionContent}</Markdown>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {link.transcript && (
            <div className="mt-4 p-6 bg-gray-50 rounded-2xl border border-gray-100">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-3">Practice Transcript / Reasoning</h3>
              <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap font-serif italic">
                "{link.transcript}"
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {link.url && (
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-6 bg-blue-600 text-white rounded-2xl font-medium hover:bg-blue-700 transition-all flex flex-col items-center justify-center gap-2 group shadow-lg shadow-blue-100"
            >
              <div className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5" />
                <span className="text-lg">Open Practice Link</span>
              </div>
              <span className="text-[10px] opacity-70 font-mono truncate max-w-[80%]">
                {link.url}
              </span>
            </a>
          )}
          <p className="text-center text-[10px] text-gray-400 italic">
            {link.url 
              ? "Practice the problem in the new tab, then come back to fill out your session stats."
              : "Review the transcript above, then fill out your session stats."}
          </p>
        </div>

        <div className="pt-8 border-t border-gray-100 flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span className="text-[10px] font-mono uppercase tracking-widest">Time Spent</span>
                </div>
                {link.averageSolveTime > 0 && (
                  <span className="text-[9px] font-mono text-gray-400">Avg: {formatTime(link.averageSolveTime)}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input 
                    type="number"
                    placeholder="Min"
                    value={mins}
                    onChange={e => setMins(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-mono text-center"
                  />
                </div>
                <span className="text-gray-300 font-mono">:</span>
                <div className="flex-1">
                  <input 
                    type="number"
                    placeholder="Sec"
                    value={secs}
                    onChange={e => setSecs(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-mono text-center"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-500">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-[10px] font-mono uppercase tracking-widest">Personal Difficulty</span>
                </div>
                <span className="text-sm font-mono font-bold text-blue-600">{personalDifficulty}</span>
              </div>
              <input 
                type="range"
                min="1"
                max="10"
                value={personalDifficulty}
                onChange={e => setPersonalDifficulty(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[8px] font-mono text-gray-400 uppercase tracking-tighter">
                <span>Easy</span>
                <span>Hard</span>
              </div>
            </div>
          </div>

          <div className="p-8 bg-gray-900 rounded-[40px] shadow-2xl border border-gray-800 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400">
                <Mic2 className="w-5 h-5" />
                <span className="text-xs font-mono uppercase tracking-[0.2em]">Tutoring Mode</span>
              </div>
              <div className="px-3 py-1 bg-emerald-400/10 text-emerald-400 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest">
                Active
              </div>
            </div>

            <p className="text-gray-400 text-sm leading-relaxed font-serif italic text-center px-4">
              "Explain your solution out loud. Record your reasoning, trade-offs, and logic. Gemini will grade your explanation and provide tutoring feedback."
            </p>

            <AudioRecorder 
              onStop={onAudioSubmit} 
              isSubmitting={isSubmittingAudio}
            />
          </div>

          <div className="space-y-6">
            <p className="text-xs font-mono text-gray-100 uppercase tracking-widest text-center px-6 py-2 bg-gray-900 rounded-full w-fit mx-auto">
              How well did you do?
            </p>
            <div className="grid grid-cols-5 gap-3">
              {[
                { q: 1, label: 'Forgot', icon: X, color: 'hover:bg-red-500' },
                { q: 2, label: 'Hard', icon: RotateCcw, color: 'hover:bg-orange-500' },
                { q: 3, label: 'Good', icon: Check, color: 'hover:bg-blue-500' },
                { q: 4, label: 'Easy', icon: Check, color: 'hover:bg-green-500' },
                { q: 5, label: 'Perfect', icon: Check, color: 'hover:bg-emerald-500' },
              ].map((btn) => (
                <button
                  key={btn.q}
                  onClick={() => handleRating(btn.q)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-2xl border border-gray-100 transition-all hover:text-white group",
                    btn.color
                  )}
                >
                  <btn.icon className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
