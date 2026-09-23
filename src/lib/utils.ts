import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTopicName(topic: string): string {
  if (!topic) return 'General';
  const t = topic.toLowerCase().trim();
  if (t === 'sql') return 'SQL';
  if (t === 'python') return 'Python';
  if (t === 'system-design' || t === 'system design') return 'System Design';
  if (t === 'qa' || t === 'q&a') return 'Q&A';
  if (t === 'algorithms') return 'Algorithms';
  if (t === 'data-engineering') return 'Data Engineering';
  return topic.charAt(0).toUpperCase() + topic.slice(1);
}

export function getTopicBadgeClass(topic: string): string {
  if (!topic) return 'bg-gray-100 text-gray-700 border-gray-200';
  const t = topic.toLowerCase().trim();
  if (t === 'python') return 'bg-blue-50 text-blue-700 border-blue-100';
  if (t === 'sql') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (t.includes('system') || t.includes('design')) return 'bg-purple-50 text-purple-700 border-purple-100';
  if (t.includes('qa') || t.includes('q&a') || t.includes('concept') || t.includes('behavioral')) return 'bg-amber-50 text-amber-800 border-amber-100';
  if (t.includes('algo')) return 'bg-rose-50 text-rose-700 border-rose-100';
  if (t.includes('data')) return 'bg-teal-50 text-teal-700 border-teal-100';
  return 'bg-indigo-50 text-indigo-700 border-indigo-100';
}
