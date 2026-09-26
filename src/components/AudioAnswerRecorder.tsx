import React, { useState, useEffect, useRef } from 'react';
import { PracticeLink } from '../types';
import { 
  SpokenEvaluationResult, 
  evaluateSpokenAnswerOffline, 
  evaluateSpokenAnswerWithAI 
} from '../lib/speechEvaluation';
import { 
  Mic, MicOff, Square, Play, Pause, Volume2, Sparkles, CheckCircle2, 
  AlertTriangle, RotateCcw, Award, Check, Clock, Edit3, Key, ShieldCheck, ChevronRight 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AudioAnswerRecorderProps {
  problem: PracticeLink;
  onApplyRating?: (quality: number, solveTimeSeconds: number) => void;
}

export const AudioAnswerRecorder: React.FC<AudioAnswerRecorderProps> = ({ problem, onApplyRating }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<SpokenEvaluationResult | null>(null);
  const [hasSpeechRecognition, setHasSpeechRecognition] = useState(true);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') || '' : '';
  });
  const [showKeyInput, setShowKeyInput] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Speech Recognition capability check
  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setHasSpeechRecognition(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, [audioUrl]);

  // Start Voice Recording
  const startRecording = async () => {
    setRecordingError(null);
    setEvaluation(null);
    setTranscript('');
    setRecordingDuration(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        // Stop all audio tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);

      // Start elapsed timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // Start SpeechRecognition if supported
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        const recognition = new SpeechRec();
        speechRecognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let accumulated = '';
        recognition.onresult = (event: any) => {
          let currentSession = '';
          for (let i = 0; i < event.results.length; i++) {
            currentSession += event.results[i][0].transcript + ' ';
          }
          setTranscript(currentSession.trim());
        };

        recognition.onerror = (err: any) => {
          console.warn('SpeechRecognition error:', err);
        };

        try {
          recognition.start();
        } catch (e) {}
      }
    } catch (err: any) {
      console.error('Microphone access failed:', err);
      setRecordingError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Microphone permission was denied. Please allow microphone access in your browser address bar to record your spoken answer.'
          : 'Unable to access your microphone. You can still type your answer below for evaluation.'
      );
      setIsRecording(false);
    }
  };

  // Stop Recording
  const stopRecording = () => {
    setIsRecording(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
    }
  };

  // Audio Playback toggle
  const togglePlayAudio = () => {
    if (!audioUrl) return;
    if (!audioElementRef.current) {
      audioElementRef.current = new Audio(audioUrl);
      audioElementRef.current.onended = () => setIsPlayingAudio(false);
    }

    if (isPlayingAudio) {
      audioElementRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioElementRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  // Evaluate Answer
  const handleEvaluate = async () => {
    if (!transcript.trim()) {
      setRecordingError('Please speak or type your answer before evaluating.');
      return;
    }

    setIsEvaluating(true);
    setRecordingError(null);

    try {
      const result = await evaluateSpokenAnswerWithAI(
        transcript,
        problem,
        recordingDuration > 0 ? recordingDuration : 30,
        customApiKey
      );
      setEvaluation(result);
    } catch (err) {
      const fallback = evaluateSpokenAnswerOffline(
        transcript,
        problem,
        recordingDuration > 0 ? recordingDuration : 30
      );
      setEvaluation(fallback);
    } finally {
      setIsEvaluating(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-3xl border border-gray-200/80 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-gray-200/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gray-900 text-white rounded-xl flex items-center justify-center shadow-xs">
            <Mic className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-bold text-base text-gray-900">
                Spoken Answer & Pronunciation Evaluator
              </h3>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider">
                Interview Practice
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Speak your explanation out loud. We evaluate pronunciation clarity, speech pacing, and technical correctness.
            </p>
          </div>
        </div>

        {/* Gemini AI Key Toggle */}
        <button
          onClick={() => setShowKeyInput(!showKeyInput)}
          className="text-xs font-mono text-gray-500 hover:text-gray-900 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span>{customApiKey ? 'AI Key Connected' : 'Optional Gemini AI'}</span>
        </button>
      </div>

      {/* Optional Gemini API Key Drawer */}
      <AnimatePresence>
        {showKeyInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-white rounded-2xl border border-purple-100 shadow-sm space-y-2 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-gray-800 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-purple-600" />
                Gemini 2.5 Flash API Key (Optional)
              </span>
              <span className="text-[11px] text-gray-400">Works 100% offline without key as well!</span>
            </div>
            <p className="text-gray-500 text-[11px]">
              If you have a Google AI Studio key, paste it here for deep conversational critique. Stored locally in your browser.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="AIzaSy..."
                value={customApiKey}
                onChange={e => {
                  setCustomApiKey(e.target.value);
                  localStorage.setItem('gemini_api_key', e.target.value);
                }}
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
              {customApiKey && (
                <button
                  onClick={() => {
                    setCustomApiKey('');
                    localStorage.removeItem('gemini_api_key');
                  }}
                  className="px-3 py-2 text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-50 font-mono"
                >
                  Clear
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording Controls Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-md shadow-rose-200 transition-all cursor-pointer group"
            >
              <Mic className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
              <span>Record My Spoken Answer</span>
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer animate-pulse"
            >
              <Square className="w-4 h-4 fill-current text-rose-400" />
              <span>Stop Recording ({formatSeconds(recordingDuration)})</span>
            </button>
          )}

          {/* Recording Timer & Waveform indicator */}
          {isRecording && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
              <span className="text-xs font-mono font-bold text-rose-700">Listening & Transcribing...</span>
            </div>
          )}

          {/* Playback Button if recorded */}
          {audioUrl && !isRecording && (
            <button
              onClick={togglePlayAudio}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              {isPlayingAudio ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause Recording</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Listen to My Voice ({formatSeconds(recordingDuration)})</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Evaluate Action */}
        <button
          onClick={handleEvaluate}
          disabled={isRecording || (!transcript.trim() && !audioUrl) || isEvaluating}
          className={cn(
            "px-6 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm",
            isEvaluating || (!transcript.trim() && !audioUrl)
              ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"
          )}
        >
          <Sparkles className="w-4 h-4" />
          <span>{isEvaluating ? 'Evaluating Speech...' : 'Evaluate Spoken Answer'}</span>
        </button>
      </div>

      {/* Recording Error Alert */}
      {recordingError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>{recordingError}</span>
        </div>
      )}

      {/* Live Transcript / Answer Box */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-gray-500">
          <span className="flex items-center gap-1.5 uppercase tracking-wider font-semibold">
            <Volume2 className="w-3.5 h-3.5 text-gray-400" />
            Transcribed Spoken Answer:
          </span>
          <button
            onClick={() => setIsEditingTranscript(!isEditingTranscript)}
            className="hover:text-gray-900 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3 h-3" />
            <span>{isEditingTranscript ? 'Done Editing' : 'Edit Text / Type Answer'}</span>
          </button>
        </div>

        {isEditingTranscript ? (
          <textarea
            rows={4}
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            placeholder="Type or refine your spoken answer here..."
            className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-sm font-sans focus:outline-none focus:ring-2 focus:ring-gray-900 leading-relaxed"
          />
        ) : (
          <div className="p-4 bg-white border border-gray-200 rounded-2xl min-h-[90px] text-sm text-gray-800 leading-relaxed font-sans">
            {transcript ? (
              <p className="whitespace-pre-wrap">{transcript}</p>
            ) : (
              <p className="text-gray-400 italic text-xs font-mono">
                {isRecording 
                  ? 'Listening to your microphone... speak clearly.' 
                  : 'Click "Record My Spoken Answer" above or click "Edit Text" to type your explanation.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Evaluation Results Card */}
      <AnimatePresence>
        {evaluation && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="bg-white rounded-3xl border border-gray-200 p-6 shadow-md space-y-6"
          >
            {/* Top Score Banner */}
            <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center font-serif font-bold text-xl shadow-xs",
                  evaluation.correctnessScore >= 80 ? "bg-emerald-100 text-emerald-800" :
                  evaluation.correctnessScore >= 60 ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                )}>
                  {evaluation.correctnessScore}%
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-serif font-bold text-lg text-gray-900">
                      {evaluation.verdict}
                    </h4>
                    {evaluation.isAiGenerated && (
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-[10px] font-mono font-bold">
                        Gemini AI Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {evaluation.verdictSummary}
                  </p>
                </div>
              </div>

              {/* Apply Rating Button */}
              {onApplyRating && (
                <button
                  onClick={() => onApplyRating(evaluation.suggestedRating, evaluation.durationSeconds)}
                  className="px-4 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Log Rating ({evaluation.suggestedRating}/5 Quality)</span>
                </button>
              )}
            </div>

            {/* Score Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Correctness */}
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 font-semibold">
                  Technical Accuracy
                </span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-serif font-bold text-gray-900">{evaluation.correctnessScore}</span>
                  <span className="text-xs font-mono text-gray-400">/100</span>
                </div>
              </div>

              {/* Pronunciation & Articulation */}
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 font-semibold">
                  Pronunciation & Clarity
                </span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-serif font-bold text-emerald-600">{evaluation.pronunciationScore}</span>
                  <span className="text-xs font-mono text-gray-400">/100</span>
                </div>
              </div>

              {/* Speaking Pace */}
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 font-semibold">
                  Speaking Pace
                </span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-serif font-bold text-gray-900">{evaluation.wpm}</span>
                  <span className="text-xs font-mono text-gray-400">WPM</span>
                </div>
                <span className="text-[10px] font-mono text-blue-600 mt-1 font-semibold">{evaluation.paceRating}</span>
              </div>

              {/* Filler Words */}
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 font-semibold">
                  Verbal Fillers
                </span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className={cn(
                    "text-2xl font-serif font-bold",
                    evaluation.totalFillerCount === 0 ? "text-emerald-600" : "text-amber-600"
                  )}>
                    {evaluation.totalFillerCount}
                  </span>
                  <span className="text-xs font-mono text-gray-400">used</span>
                </div>
                <span className="text-[10px] font-mono text-gray-400 mt-1">
                  {evaluation.totalFillerCount === 0 ? 'Flawless flow' : 'um/uh/basically'}
                </span>
              </div>
            </div>

            {/* Concepts Covered vs Missed */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-700 block">
                Key Concepts Breakdown:
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Covered */}
                <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl space-y-2">
                  <span className="text-xs font-mono font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Articulated Correctly ({evaluation.coveredConcepts.length}):
                  </span>
                  {evaluation.coveredConcepts.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {evaluation.coveredConcepts.map(c => (
                        <span key={c} className="px-2 py-0.5 bg-white border border-emerald-200 text-emerald-900 rounded-md text-[11px] font-mono font-semibold">
                          ✅ {c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-700/80 italic">No expected technical keywords recognized yet.</p>
                  )}
                </div>

                {/* Missing */}
                <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl space-y-2">
                  <span className="text-xs font-mono font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Missing / Could Expand On ({evaluation.missingConcepts.length}):
                  </span>
                  {evaluation.missingConcepts.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {evaluation.missingConcepts.map(c => (
                        <span key={c} className="px-2 py-0.5 bg-white border border-amber-200 text-amber-900 rounded-md text-[11px] font-mono font-semibold">
                          ⚠️ {c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-800 italic">All essential concepts covered! Excellent job.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Pronunciation & Coach Feedback */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-700 block">
                Speech Delivery & Coach Feedback:
              </span>
              <ul className="space-y-1.5 text-xs text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">•</span>
                  <span>{evaluation.paceFeedback}</span>
                </li>
                {evaluation.pronunciationFeedback.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
                {evaluation.technicalAccuracyFeedback.map((acc, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-purple-500 font-bold">•</span>
                    <span>{acc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
