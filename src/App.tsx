import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, auth, db, signOut } from './firebase';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { PracticeLink, Topic, Difficulty, Submission } from './types';
import { updateCardSRS, isDue, calculatePriorityScore, getNowInTZ, formatDateInTZ, parseDateInTZ, TIMEZONE } from './lib/srs';
import { format, differenceInHours, addDays, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { gradeSubmission } from './services/geminiService';
import { Auth } from './components/Auth';
import { PracticeLinkCard } from './components/PracticeLinkCard';
import { AudioRecorder } from './components/AudioRecorder';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, Plus, Sparkles, Database, Code2, CheckCircle2, ChevronRight, BarChart3, Clock, Filter, ExternalLink, Trash2, X, AlertCircle, RotateCcw, Pencil, Play, Mic2, History, Star } from 'lucide-react';
import { cn } from './lib/utils';
import Markdown from 'react-markdown';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<PracticeLink[]>([]);
  const [activeTopic, setActiveTopic] = useState<Topic | 'all'>('all');
  const [activeDifficulty, setActiveDifficulty] = useState<Difficulty | 'all'>('all');
  const [activeSubTopic, setActiveSubTopic] = useState<string | 'all'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [selectedPracticeLink, setSelectedPracticeLink] = useState<PracticeLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tutoring'>('dashboard');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isSubmittingAudio, setIsSubmittingAudio] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  
  // New Link Form State
  const [newLink, setNewLink] = useState({
    url: '',
    title: '',
    topic: 'python' as Topic,
    subTopic: '',
    difficulty: 'Beginner' as Difficulty,
    notes: '',
    transcript: '',
    questionContent: '',
    solutionContent: '',
    initialTimeMins: '0',
    initialTimeSecs: '0',
    initialPersonalDifficulty: 5,
    lastReviewDate: getNowInTZ().toISOString().split('T')[0],
    totalRepetitions: 1,
    repetitions: 1
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setActiveDifficulty('all');
    setActiveSubTopic('all');
  }, [activeTopic]);

  useEffect(() => {
    if (!user) {
      setLinks([]);
      return;
    }

    const q = query(collection(db, 'practiceLinks'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const linkData = snapshot.docs.map(doc => {
        const data = doc.data() as PracticeLink;
        // RE-CALCULATE PRIORITY ON THE FLY
        // This ensures the "Overdue" factor is always accurate to the current minute.
        const currentScore = calculatePriorityScore({ ...data, id: doc.id });
        return { id: doc.id, ...data, priorityScore: currentScore } as PracticeLink;
      });
      // Sort by priorityScore descending
      linkData.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
      setLinks(linkData);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'practiceLinks');
      setError('Failed to load practice links. Please check your permissions.');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSubmissions([]);
      return;
    }

    const q = query(collection(db, 'submissions'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const subData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
      subData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSubmissions(subData);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'submissions');
    });

    return () => unsubscribe();
  }, [user]);

  const subTopics = useMemo(() => {
    const subs = new Set(links.map(c => c.subTopic).filter(Boolean));
    return Array.from(subs);
  }, [links]);

  const dueLinks = useMemo(() => {
    return links.filter(c => {
      const matchesTopic = activeTopic === 'all' || c.topic === activeTopic;
      const matchesDifficulty = activeDifficulty === 'all' || c.difficulty === activeDifficulty;
      const matchesSubTopic = activeSubTopic === 'all' || c.subTopic === activeSubTopic;
      return matchesTopic && matchesDifficulty && matchesSubTopic && isDue(c);
    }).sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
  }, [links, activeTopic, activeDifficulty, activeSubTopic]);

  const handleAudioSubmit = async (link: PracticeLink, audioBase64: string) => {
    if (!user) return;
    setIsSubmittingAudio(true);
    try {
      const grading = await gradeSubmission(
        audioBase64, 
        link.title, 
        link.notes || link.transcript || '',
        link.questionContent,
        link.solutionContent
      );
      
      const newSubmission: Omit<Submission, 'id'> = {
        linkId: link.id,
        uid: user.uid,
        audioData: audioBase64,
        transcript: grading.transcript,
        feedback: grading.feedback,
        grade: grading.grade,
        status: 'graded',
        createdAt: getNowInTZ().toISOString()
      };

      await setDoc(doc(collection(db, 'submissions')), newSubmission);
      alert('Explanation submitted and graded successfully!');
      setActiveTab('tutoring');
    } catch (err) {
      console.error('Failed to submit audio:', err);
      setError('Failed to grade audio submission.');
    } finally {
      setIsSubmittingAudio(false);
    }
  };

  const handleStartPractice = async (link: PracticeLink) => {
    setSelectedPracticeLink(link);
    setIsReviewing(true);
    
    // Update lastReviewDate when the practice panel is opened
    try {
      const now = getNowInTZ();
      const nowIso = now.toISOString();
      const updates: any = {
        lastReviewDate: nowIso
      };

      // If next review is in the past or earlier than now, 
      // move it to tomorrow to ensure Next Review >= Last Practice
      // and to respect the "just practiced" state.
      const nextReview = new Date(link.nextReviewDate);
      if (nextReview < now) {
        updates.nextReviewDate = addDays(startOfDay(now), 1).toISOString();
        // Also ensure interval is at least 1 if we're pushing it to tomorrow
        if ((link.interval || 0) < 1) {
          updates.interval = 1;
        }
      }

      await updateDoc(doc(db, 'practiceLinks', link.id), updates);
    } catch (err) {
      console.error('Failed to update last practice time:', err);
    }
  };

  const handleRate = async (link: PracticeLink, quality: number, solveTime: number, personalDifficulty: number) => {
    const updates = updateCardSRS(link, quality, solveTime, personalDifficulty);
    try {
      await updateDoc(doc(db, 'practiceLinks', link.id), updates);
      
      if (selectedPracticeLink) {
        setSelectedPracticeLink(null);
        setIsReviewing(false);
      } else if (dueLinks.length === 1) {
        setSessionComplete(true);
        setIsReviewing(false);
      }
    } catch (err) {
      const wrappedError = handleFirestoreError(err, OperationType.UPDATE, `practiceLinks/${link.id}`);
      setError('Failed to update practice link. ' + (err instanceof Error && err.message.includes('permission') ? 'Insufficient permissions.' : ''));
      console.error('Update failed:', wrappedError);
    }
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user || !newLink.url || !newLink.title) return;
    
    const id = editingId || Math.random().toString(36).substring(2, 15);
    const initialSeconds = (parseInt(newLink.initialTimeMins) || 0) * 60 + (parseInt(newLink.initialTimeSecs) || 0);
    
    // Create a temporary card to calculate initial priority score
    const now = getNowInTZ();
    const nowIso = now.toISOString();
    const lastPracticeDate = parseDateInTZ(newLink.lastReviewDate);
    const lastPracticeDateObj = toZonedTime(new Date(lastPracticeDate), TIMEZONE);
    
    // If last practice was today or in the future (relative to now), set next review to tomorrow
    // Otherwise, if it was in the past, it might be due now.
    const isPracticedRecently = differenceInHours(now, lastPracticeDateObj) < 16;
    const nextReviewDate = isPracticedRecently 
      ? addDays(startOfDay(now), 1).toISOString() 
      : nowIso;

    const tempCard: any = {
      difficulty: newLink.difficulty,
      averageSolveTime: initialSeconds,
      personalDifficulty: newLink.initialPersonalDifficulty,
      totalRepetitions: 1, // Automatically count as 1 when adding
      createdAt: nowIso,
      lastReviewDate: lastPracticeDate
    };
    const priorityScore = calculatePriorityScore(tempCard);

    try {
      const linkData: any = {
        id,
        uid: user.uid,
        url: newLink.url,
        title: newLink.title,
        topic: newLink.topic,
        subTopic: newLink.subTopic,
        difficulty: newLink.difficulty,
        notes: newLink.notes,
        transcript: newLink.transcript,
        questionContent: newLink.questionContent,
        solutionContent: newLink.solutionContent,
        personalDifficulty: newLink.initialPersonalDifficulty,
        lastReviewDate: lastPracticeDate,
        totalRepetitions: Number(newLink.totalRepetitions) || 0, // Allow 0
        repetitions: Number(newLink.repetitions) || 0, // Allow 0
        priorityScore
      };

      if (editingId) {
        // When editing, we update the core fields and the last review date (which affects priority)
        // We also recalculate nextReviewDate if they changed the last practice date to today
        await updateDoc(doc(db, 'practiceLinks', id), {
          ...linkData,
          nextReviewDate
        });
      } else {
        // When adding new, initialize SRS fields
        await setDoc(doc(db, 'practiceLinks', id), {
          ...linkData,
          repetitions: Number(newLink.repetitions) || 0,
          interval: isPracticedRecently ? 1 : 0,
          easinessFactor: 2.5,
          nextReviewDate,
          createdAt: nowIso,
          totalTimeSpent: initialSeconds,
          lastSolveTime: initialSeconds,
          averageSolveTime: initialSeconds,
          totalRepetitions: Number(newLink.totalRepetitions) || 0,
        });
      }

      setNewLink({
        url: '',
        title: '',
        topic: 'python',
        subTopic: '',
        difficulty: 'Beginner',
        notes: '',
        transcript: '',
        questionContent: '',
        solutionContent: '',
        initialTimeMins: '0',
        initialTimeSecs: '0',
        initialPersonalDifficulty: 5,
        lastReviewDate: getNowInTZ().toISOString().split('T')[0],
        totalRepetitions: 1,
        repetitions: 1
      });
      setIsAdding(false);
      setEditingId(null);
    } catch (err) {
      const wrappedError = handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, `practiceLinks/${id}`);
      setError(`Failed to ${editingId ? 'update' : 'add'} practice link. ` + (err instanceof Error && err.message.includes('permission') ? 'Insufficient permissions. Please ensure all fields are valid.' : ''));
      console.error(`${editingId ? 'Update' : 'Add'} failed:`, wrappedError);
    }
  };

  const handleEditClick = (link: PracticeLink) => {
    setNewLink({
      url: link.url || '',
      title: link.title,
      topic: link.topic,
      subTopic: link.subTopic,
      difficulty: link.difficulty,
      notes: link.notes || '',
      transcript: link.transcript || '',
      questionContent: link.questionContent || '',
      solutionContent: link.solutionContent || '',
      initialTimeMins: Math.floor((link.lastSolveTime || 0) / 60).toString(),
      initialTimeSecs: ((link.lastSolveTime || 0) % 60).toString(),
      initialPersonalDifficulty: link.personalDifficulty || 5,
      lastReviewDate: link.lastReviewDate ? formatDateInTZ(link.lastReviewDate, 'yyyy-MM-dd') : getNowInTZ().toISOString().split('T')[0],
      totalRepetitions: link.totalRepetitions || 0,
      repetitions: link.repetitions || 0
    });
    setEditingId(link.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this link?')) return;
    try {
      await deleteDoc(doc(db, 'practiceLinks', id));
    } catch (err) {
      const wrappedError = handleFirestoreError(err, OperationType.DELETE, `practiceLinks/${id}`);
      setError('Failed to delete practice link.');
      console.error('Delete failed:', wrappedError);
    }
  };

  const handleResetAllToToday = async () => {
    const now = getNowInTZ();
    const todayStr = format(now, 'MMM d');
    if (!confirm(`This will set the Last Practice date for ALL problems to today (${todayStr}). Continue?`)) return;
    
    const today = now.toISOString();
    const tomorrow = addDays(startOfDay(now), 1).toISOString();

    const batchPromises = links.map(link => {
      const tempCard = { 
        ...link, 
        lastReviewDate: today, 
        nextReviewDate: tomorrow,
        totalRepetitions: (link.totalRepetitions || 0) + 1,
        repetitions: 1
      };
      const newPriority = calculatePriorityScore(tempCard);
      return updateDoc(doc(db, 'practiceLinks', link.id), {
        lastReviewDate: today,
        nextReviewDate: tomorrow,
        interval: 1,
        repetitions: 1,
        totalRepetitions: (link.totalRepetitions || 0) + 1,
        priorityScore: newPriority
      });
    });

    try {
      await Promise.all(batchPromises);
      alert('All problems updated to today!');
    } catch (err) {
      console.error('Bulk update failed:', err);
      setError('Failed to update all problems.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-gray-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50 px-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-serif font-medium text-lg tracking-tight">CodeRecall</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 ml-4">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "text-sm font-medium transition-all",
                activeTab === 'dashboard' ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
              )}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('tutoring')}
              className={cn(
                "text-sm font-medium transition-all flex items-center gap-2",
                activeTab === 'tutoring' ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Mic2 className="w-4 h-4" />
              Tutoring
            </button>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wider">
            <Clock className="w-3 h-3" />
            {dueLinks.length} Due
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="pt-24 pb-12 px-6 max-w-[1600px] mx-auto">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="flex-grow">{error}</p>
              <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {sessionComplete ? (
            <motion.div 
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto text-center py-20 bg-white rounded-[32px] p-12 shadow-sm border border-gray-100"
            >
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-serif font-medium mb-2">Session Complete!</h2>
              <p className="text-gray-500 mb-8 leading-relaxed">
                You've reviewed all due links for this topic. Great job keeping your streak alive!
              </p>
              <button
                onClick={() => setSessionComplete(false)}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-medium hover:bg-black transition-all"
              >
                Back to Dashboard
              </button>
            </motion.div>
          ) : isReviewing && (selectedPracticeLink || dueLinks.length > 0) ? (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center"
            >
              <div className="mb-8 text-center flex items-center gap-4">
                <button 
                  onClick={() => {
                    setIsReviewing(false);
                    setSelectedPracticeLink(null);
                  }}
                  className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-900"
                >
                  <X className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-sm font-mono text-gray-400 uppercase tracking-[0.2em] mb-1">
                    {selectedPracticeLink ? 'Practicing' : `Reviewing ${activeTopic}`}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{selectedPracticeLink ? 'Single Session' : `${dueLinks.length} remaining`}</span>
                  </div>
                </div>
              </div>
              <PracticeLinkCard 
                link={selectedPracticeLink || dueLinks[0]} 
                onRate={(q, t, p) => handleRate(selectedPracticeLink || dueLinks[0], q, t, p)} 
                onAudioSubmit={(base64) => handleAudioSubmit(selectedPracticeLink || dueLinks[0], base64)}
                isSubmittingAudio={isSubmittingAudio}
              />
            </motion.div>
          ) : activeTab === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Top Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h1 className="text-3xl font-serif font-medium text-gray-900">Practice Dashboard</h1>
                  <p className="text-gray-500 text-sm">Manage and review your practice problems.</p>
                </div>
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl font-medium hover:bg-black transition-all shadow-lg shadow-gray-200"
                >
                  <Plus className="w-5 h-5" />
                  Add Practice Link
                </button>
              </div>

              {/* Stats & Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">Total Links</p>
                    <p className="text-2xl font-serif font-medium">{links.length}</p>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">Due Today</p>
                    <p className="text-2xl font-serif font-medium">{links.filter(isDue).length}</p>
                  </div>
                </div>

                {dueLinks.length > 0 ? (
                  <button
                    onClick={() => handleStartPractice(dueLinks[0])}
                    className="py-4 bg-emerald-600 text-white rounded-3xl font-medium hover:bg-emerald-700 transition-all flex flex-col items-center justify-center gap-0.5 shadow-lg shadow-emerald-100 group"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      <span className="text-lg">Start Practice</span>
                    </div>
                    <span className="text-[10px] opacity-70 uppercase tracking-widest font-mono">
                      {dueLinks.length} items waiting
                    </span>
                  </button>
                ) : (
                  <div className="bg-gray-50 rounded-3xl p-6 border border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-xs font-medium">
                    All caught up!
                  </div>
                )}

                <button
                  onClick={handleResetAllToToday}
                  className="py-4 border border-gray-200 rounded-3xl text-[10px] font-mono uppercase tracking-widest text-gray-500 hover:bg-white hover:border-gray-900 hover:text-gray-900 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset All to Today
                </button>
              </div>

              <div className="space-y-6">
                {/* Filters */}
                  <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-400 px-2">
                      <Filter className="w-4 h-4" />
                      <span className="text-[10px] font-mono uppercase tracking-wider">Filters</span>
                    </div>
                    
                    <div className="flex gap-2">
                      {['all', 'python', 'sql'].map((t) => (
                        <button
                          key={t}
                          onClick={() => setActiveTopic(t as any)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                            activeTopic === t ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    <div className="w-px h-4 bg-gray-100" />

                    <select 
                      value={activeDifficulty}
                      onChange={(e) => setActiveDifficulty(e.target.value as any)}
                      className="bg-transparent text-xs font-medium text-gray-600 outline-none cursor-pointer"
                    >
                      <option value="all">All Difficulties</option>
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>

                    <div className="w-px h-4 bg-gray-100" />

                    <select 
                      value={activeSubTopic}
                      onChange={(e) => setActiveSubTopic(e.target.value)}
                      className="bg-transparent text-xs font-medium text-gray-600 outline-none cursor-pointer max-w-[150px] truncate"
                    >
                      <option value="all">All Sub-topics</option>
                      {subTopics.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  {/* Table View */}
                  <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-50">
                            <th className="px-4 py-6 text-[10px] font-mono uppercase tracking-widest text-gray-400"></th>
                            <th className="px-8 py-6 text-[10px] font-mono uppercase tracking-widest text-gray-400">Problem</th>
                            <th className="px-6 py-6 text-[10px] font-mono uppercase tracking-widest text-gray-400">Topic</th>
                            <th className="px-6 py-6 text-[10px] font-mono uppercase tracking-widest text-gray-400">Difficulty</th>
                            <th className="px-6 py-6 text-[10px] font-mono uppercase tracking-widest text-gray-400">Performance</th>
                            <th className="px-6 py-6 text-[10px] font-mono uppercase tracking-widest text-gray-400">SRS</th>
                            <th className="px-6 py-6 text-[10px] font-mono uppercase tracking-widest text-gray-400">Priority</th>
                            <th className="px-6 py-6 text-[10px] font-mono uppercase tracking-widest text-gray-400">Last Practice</th>
                            <th className="px-6 py-6 text-[10px] font-mono uppercase tracking-widest text-gray-400">Next Review</th>
                            <th className="px-6 py-6 text-[10px] font-mono uppercase tracking-widest text-gray-400"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {links.filter(l => {
                            const matchesTopic = activeTopic === 'all' || l.topic === activeTopic;
                            const matchesDifficulty = activeDifficulty === 'all' || l.difficulty === activeDifficulty;
                            const matchesSubTopic = activeSubTopic === 'all' || l.subTopic === activeSubTopic;
                            return matchesTopic && matchesDifficulty && matchesSubTopic;
                          }).map((link) => (
                            <tr key={link.id} className="group hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-6">
                                <button
                                  onClick={() => handleStartPractice(link)}
                                  className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm group-hover:scale-110"
                                  title="Practice Now"
                                >
                                  <Play className="w-4 h-4 fill-current" />
                                </button>
                              </td>
                              <td className="px-8 py-6">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-serif font-medium text-gray-900">{link.title}</span>
                                    {link.transcript && (
                                      <div className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[8px] font-bold uppercase tracking-wider" title="Has Transcript">
                                        Transcript
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                    {link.url ? (
                                      <>
                                        <span className="truncate max-w-[200px]">{link.url}</span>
                                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      </>
                                    ) : (
                                      <span className="italic">Transcript Only</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-6">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{link.topic}</span>
                                  <span className="text-[10px] text-gray-400">{link.subTopic || 'General'}</span>
                                </div>
                              </td>
                              <td className="px-6 py-6">
                                <div className="flex flex-col gap-2">
                                  <span className={cn(
                                    "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider w-fit",
                                    link.difficulty === 'Beginner' && "bg-green-50 text-green-600",
                                    link.difficulty === 'Intermediate' && "bg-orange-50 text-orange-600",
                                    link.difficulty === 'Advanced' && "bg-red-50 text-red-600"
                                  )}>
                                    {link.difficulty}
                                  </span>
                                  {link.personalDifficulty && (
                                    <div className="flex items-center gap-1 text-blue-500 font-bold" title="Personal Difficulty">
                                      <Sparkles className="w-3 h-3" />
                                      <span className="text-[9px] font-mono">{link.personalDifficulty}/10</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-6">
                                <div className="flex flex-col gap-2">
                                  <div className="flex flex-wrap items-center gap-3 text-[9px] font-mono text-gray-400">
                                    <div className="flex items-center gap-1" title="Total Practices">
                                      <RotateCcw className="w-3 h-3" />
                                      <span>{link.totalRepetitions || 0}x</span>
                                    </div>
                                    <div className="flex items-center gap-1" title="Average Solve Time">
                                      <Clock className="w-3 h-3" />
                                      <span>Avg: {Math.floor((link.averageSolveTime || 0) / 60)}m</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-[9px] font-mono font-bold text-gray-500">
                                    <Clock className="w-3 h-3 text-blue-400" />
                                    <span>Last: {Math.floor((link.lastSolveTime || 0) / 60)}m {link.lastSolveTime % 60}s</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-6">
                                <div className="flex flex-col gap-1 text-[9px] font-mono text-gray-500">
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-gray-400 uppercase tracking-tighter">Streak:</span>
                                    <span className="font-bold text-gray-700">{link.repetitions}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-gray-400 uppercase tracking-tighter">Interval:</span>
                                    <span className="font-bold text-gray-700">{link.interval}d</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-gray-400 uppercase tracking-tighter">EF:</span>
                                    <span className="font-bold text-gray-700">{link.easinessFactor.toFixed(2)}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-6">
                                <div className="flex items-center gap-2">
                                  <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                      className={cn(
                                        "h-full rounded-full",
                                        (link.priorityScore || 0) < 0 ? "bg-blue-300" :
                                        (link.priorityScore || 0) > 10000 ? "bg-red-500" : 
                                        (link.priorityScore || 0) > 5000 ? "bg-orange-500" : "bg-green-500"
                                      )}
                                      style={{ width: `${(link.priorityScore || 0) < 0 ? 100 : Math.min(100, (link.priorityScore || 0) / 150)}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-gray-600">
                                    {(link.priorityScore || 0) < 0 ? "FRESH" : (link.priorityScore || 0)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-6">
                                <div className="flex items-center gap-2 text-[10px] font-mono text-gray-500">
                                  {link.lastReviewDate ? (
                                    <span>{formatDateInTZ(link.lastReviewDate)}</span>
                                  ) : (
                                    <span className="text-gray-300 italic">Never</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-6">
                                <div className="flex items-center gap-2 text-[10px] font-mono text-gray-500">
                                  {isDue(link) ? (
                                    <span className="text-orange-500 font-bold">DUE NOW</span>
                                  ) : (
                                    <span>{formatDateInTZ(link.nextReviewDate)}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={() => handleEditClick(link)}
                                    className="p-2 text-gray-300 hover:text-blue-500 transition-colors"
                                    title="Edit Problem"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleDelete(link.id)}
                                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                    title="Delete Problem"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {links.length === 0 && (
                            <tr>
                              <td colSpan={10} className="px-8 py-20 text-center text-gray-400 italic text-sm">
                                No practice links added yet. Click "Add Practice Link" to get started.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </motion.div>
          ) : (
            <motion.div
              key="tutoring"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-serif font-medium text-gray-900">Tutoring & Grading</h1>
                  <p className="text-gray-500 text-sm">Review your recorded explanations and AI feedback.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                    <h3 className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Submission History
                    </h3>
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                      {submissions.map((sub) => {
                        const link = links.find(l => l.id === sub.linkId);
                        return (
                          <button
                            key={sub.id}
                            onClick={() => setSelectedSubmission(sub)}
                            className={cn(
                              "w-full text-left p-4 rounded-2xl border transition-all",
                              selectedSubmission?.id === sub.id 
                                ? "bg-gray-900 border-gray-900 text-white shadow-lg" 
                                : "bg-white border-gray-100 hover:border-gray-300 text-gray-900"
                            )}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-serif font-medium truncate flex-1">{link?.title || 'Unknown Problem'}</span>
                              <div className="flex items-center gap-1 bg-yellow-400/20 text-yellow-600 px-1.5 py-0.5 rounded text-[8px] font-bold">
                                <Star className="w-2 h-2 fill-current" />
                                {sub.grade}/5
                              </div>
                            </div>
                            <p className={cn(
                              "text-[10px] font-mono uppercase tracking-tighter",
                              selectedSubmission?.id === sub.id ? "text-gray-400" : "text-gray-400"
                            )}>
                              {new Date(sub.createdAt).toLocaleDateString()} • {new Date(sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </button>
                        );
                      })}
                      {submissions.length === 0 && (
                        <div className="text-center py-12 text-gray-400 italic text-sm">
                          No submissions yet. Record an explanation during practice to get started.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <AnimatePresence mode="wait">
                    {selectedSubmission ? (
                      <motion.div
                        key={selectedSubmission.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-white rounded-[40px] p-10 shadow-sm border border-gray-100 space-y-8"
                      >
                        <div className="flex items-center justify-between border-b border-gray-50 pb-6">
                          <div>
                            <h2 className="text-2xl font-serif font-medium text-gray-900">
                              {links.find(l => l.id === selectedSubmission.linkId)?.title || 'Submission Details'}
                            </h2>
                            <p className="text-gray-400 text-xs font-mono uppercase tracking-widest mt-1">
                              Graded on {new Date(selectedSubmission.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="text-4xl font-serif font-bold text-gray-900">{selectedSubmission.grade}</div>
                            <div className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Score / 5</div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-3">
                            <h3 className="text-[10px] font-mono uppercase tracking-widest text-gray-400 flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-emerald-500" />
                              AI Feedback
                            </h3>
                            <div className="bg-emerald-50/30 p-6 rounded-3xl border border-emerald-100/50 text-gray-700 text-sm leading-relaxed prose prose-sm max-w-none">
                              <Markdown>{selectedSubmission.feedback}</Markdown>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h3 className="text-[10px] font-mono uppercase tracking-widest text-gray-400 flex items-center gap-2">
                              <Mic2 className="w-4 h-4 text-blue-500" />
                              Transcript
                            </h3>
                            <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 text-gray-600 text-sm leading-relaxed italic font-serif">
                              "{selectedSubmission.transcript}"
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="h-full min-h-[400px] bg-gray-50/50 rounded-[40px] border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-4">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                          <Mic2 className="w-8 h-8 text-gray-200" />
                        </div>
                        <p className="text-sm font-medium">Select a submission to view grading details</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Add Link Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAdding(false);
                setEditingId(null);
              }}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[40px] p-10 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-serif font-medium">{editingId ? 'Edit Problem' : 'Add Practice Link'}</h2>
                <button onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddLink} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-gray-400 ml-1">URL</label>
                  <input
                    required
                    type="url"
                    placeholder="https://leetcode.com/problems/..."
                    value={newLink.url}
                    onChange={e => setNewLink({ ...newLink, url: e.target.value })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-gray-400 ml-1">Title</label>
                  <input
                    required
                    type="text"
                    placeholder="Problem Title"
                    value={newLink.title}
                    onChange={e => setNewLink({ ...newLink, title: e.target.value })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-gray-400 ml-1">Topic</label>
                    <select
                      value={newLink.topic}
                      onChange={e => setNewLink({ ...newLink, topic: e.target.value as Topic })}
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm appearance-none"
                    >
                      <option value="python">Python</option>
                      <option value="sql">SQL</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-gray-400 ml-1">Difficulty</label>
                    <select
                      value={newLink.difficulty}
                      onChange={e => setNewLink({ ...newLink, difficulty: e.target.value as Difficulty })}
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm appearance-none"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-gray-400 ml-1">Sub-topic</label>
                  <input
                    type="text"
                    placeholder="e.g. Data Types, JOINs"
                    value={newLink.subTopic}
                    onChange={e => setNewLink({ ...newLink, subTopic: e.target.value })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-gray-400 ml-1">Last Practice Date</label>
                  <input
                    type="date"
                    value={newLink.lastReviewDate}
                    onChange={e => setNewLink({ ...newLink, lastReviewDate: e.target.value })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-gray-400 ml-1">Total Practices</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNewLink({ ...newLink, totalRepetitions: Math.max(0, (Number(newLink.totalRepetitions) || 0) - 1) })}
                        className="p-4 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={newLink.totalRepetitions}
                        onChange={e => setNewLink({ ...newLink, totalRepetitions: parseInt(e.target.value) || 0 })}
                        className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-center font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => setNewLink({ ...newLink, totalRepetitions: (Number(newLink.totalRepetitions) || 0) + 1 })}
                        className="p-4 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-gray-400 ml-1">Current Streak</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNewLink({ ...newLink, repetitions: Math.max(0, (Number(newLink.repetitions) || 0) - 1) })}
                        className="p-4 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={newLink.repetitions}
                        onChange={e => setNewLink({ ...newLink, repetitions: parseInt(e.target.value) || 0 })}
                        className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-center font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => setNewLink({ ...newLink, repetitions: (Number(newLink.repetitions) || 0) + 1 })}
                        className="p-4 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-gray-400 ml-1">Question Content</label>
                  <textarea
                    placeholder="Paste the problem description or question here..."
                    value={newLink.questionContent}
                    onChange={e => setNewLink({ ...newLink, questionContent: e.target.value })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm min-h-[100px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-gray-400 ml-1">Solution Content</label>
                  <textarea
                    placeholder="Paste the ideal solution or code here..."
                    value={newLink.solutionContent}
                    onChange={e => setNewLink({ ...newLink, solutionContent: e.target.value })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm min-h-[100px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-gray-400 ml-1">Transcript / Reasoning Practice</label>
                  <textarea
                    placeholder="Paste your solution walkthrough or reasoning transcript here..."
                    value={newLink.transcript}
                    onChange={e => setNewLink({ ...newLink, transcript: e.target.value })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm min-h-[120px] resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6 p-6 bg-gray-50 rounded-3xl border border-gray-100">
                  <div className="space-y-3">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-gray-400 ml-1">Initial Time Solved</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Min"
                        value={newLink.initialTimeMins}
                        onChange={e => setNewLink({ ...newLink, initialTimeMins: e.target.value })}
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl outline-none text-xs font-mono"
                      />
                      <span className="text-gray-300">:</span>
                      <input
                        type="number"
                        placeholder="Sec"
                        value={newLink.initialTimeSecs}
                        onChange={e => setNewLink({ ...newLink, initialTimeSecs: e.target.value })}
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl outline-none text-xs font-mono"
                      />
                    </div>
                    <p className="text-[8px] text-gray-400 font-mono uppercase tracking-tighter">30 min max recommended</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-gray-400 ml-1">Personal Difficulty</label>
                      <span className="text-xs font-bold text-blue-600">{newLink.initialPersonalDifficulty}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={newLink.initialPersonalDifficulty}
                      onChange={e => setNewLink({ ...newLink, initialPersonalDifficulty: parseInt(e.target.value) })}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-[8px] font-mono text-gray-400 uppercase tracking-tighter">
                      <span>Easy</span>
                      <span>Hard</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-5 bg-gray-900 text-white rounded-3xl font-medium hover:bg-black transition-all shadow-xl shadow-gray-200 mt-4"
                >
                  {editingId ? 'Save Changes' : 'Save Practice Link'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
