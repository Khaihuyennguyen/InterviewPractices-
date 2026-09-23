import React from 'react';
import { motion } from 'motion/react';
import { googleProvider, signInWithPopup, auth } from '../firebase';
import { LogIn, Code2, Database } from 'lucide-react';

export const Auth: React.FC = () => {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[32px] p-12 shadow-sm border border-gray-100 text-center"
      >
        <div className="flex justify-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <Code2 className="w-6 h-6" />
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <Database className="w-6 h-6" />
          </div>
        </div>
        
        <h1 className="text-3xl font-serif font-medium text-gray-900 mb-4">CodeRecall</h1>
        <p className="text-gray-500 mb-12 leading-relaxed">
          Master Python and SQL through scientifically-proven spaced repetition. 
          Retain concepts longer with active recall.
        </p>

        <button
          onClick={handleLogin}
          className="w-full py-4 bg-gray-900 text-white rounded-2xl font-medium hover:bg-black transition-all flex items-center justify-center gap-3 shadow-lg shadow-gray-200"
        >
          <LogIn className="w-5 h-5" />
          Sign in with Google
        </button>
        
        <p className="mt-8 text-[10px] uppercase tracking-widest text-gray-400 font-mono">
          Powered by SM-2 Algorithm & Gemini AI
        </p>
      </motion.div>
    </div>
  );
};
