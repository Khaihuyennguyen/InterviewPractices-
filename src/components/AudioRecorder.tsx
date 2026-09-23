import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Trash2, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface AudioRecorderProps {
  onStop: (base64: string) => void;
  isSubmitting?: boolean;
}

export function AudioRecorder({ onStop, isSubmitting }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        
        // Convert to base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          onStop(base64data.split(',')[1]); // Send only the data part
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const reset = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
  };

  return (
    <div className="bg-[#151619] rounded-3xl p-6 shadow-2xl border border-gray-800 w-full max-w-md mx-auto">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center justify-between w-full mb-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">Audio Input</span>
          <div className={cn(
            "w-2 h-2 rounded-full",
            isRecording ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" : "bg-gray-700"
          )} />
        </div>

        <div className="relative flex items-center justify-center w-32 h-32">
          {/* Radial Track Background */}
          <div className="absolute inset-0 border border-dashed border-gray-800 rounded-full" />
          
          <AnimatePresence mode="wait">
            {!audioBlob ? (
              <motion.button
                key="record"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={isRecording ? stopRecording : startRecording}
                className={cn(
                  "relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300",
                  isRecording 
                    ? "bg-red-500 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)]" 
                    : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                )}
              >
                {isRecording ? <Square className="w-8 h-8 fill-current" /> : <Mic className="w-8 h-8" />}
              </motion.button>
            ) : (
              <motion.div
                key="preview"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-4"
              >
                <button
                  onClick={() => {
                    const audio = new Audio(audioUrl!);
                    audio.play();
                  }}
                  className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-600 transition-all"
                >
                  <Play className="w-8 h-8 fill-current ml-1" />
                </button>
                <button
                  onClick={reset}
                  className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-700 transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="text-center">
          <div className="text-3xl font-mono font-medium text-white mb-1 tracking-tighter">
            {formatTime(recordingTime)}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">
            {isRecording ? 'Recording Explanation...' : audioBlob ? 'Review Recording' : 'Ready to Record'}
          </div>
        </div>

        {audioBlob && !isSubmitting && (
          <div className="w-full pt-4 border-t border-gray-800">
            <p className="text-[10px] text-gray-400 mb-4 text-center leading-relaxed">
              Submit your explanation for AI grading. Gemini will analyze your logic, clarity, and technical correctness.
            </p>
          </div>
        )}

        {isSubmitting && (
          <div className="flex items-center gap-3 text-emerald-400 font-mono text-[10px] uppercase tracking-widest">
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing Audio...
          </div>
        )}
      </div>
    </div>
  );
}
