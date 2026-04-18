/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Clock, Play, RotateCcw, Home, X, Check, Timer, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Constants ---
const COLS = 6;
const ROWS = 10;
const INITIAL_ROWS = 5;
const MAX_VAL = 9;
const TICK_RATE = 1000; // 1 second

type GameMode = 'classic' | 'time';
type GameStatus = 'menu' | 'playing' | 'gameover';

interface Block {
  id: string;
  value: number;
  color: string;
}

const COLORS = [
  'bg-blue-500',   // 1
  'bg-emerald-500', // 2
  'bg-amber-500',  // 3
  'bg-rose-500',    // 4
  'bg-indigo-500', // 5
  'bg-orange-500', // 6
  'bg-teal-500',   // 7
  'bg-purple-500', // 8
  'bg-pink-500',   // 9
];

// --- Helper Functions ---
const generateId = () => Math.random().toString(36).substring(2, 9);

const getRandomBlock = (): Block => {
  const value = Math.floor(Math.random() * MAX_VAL) + 1;
  return {
    id: generateId(),
    value,
    color: COLORS[value - 1]
  };
};

export default function App() {
  const [status, setStatus] = useState<GameStatus>('menu');
  const [mode, setMode] = useState<GameMode>('classic');
  const [grid, setGrid] = useState<(Block | null)[][]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetSum, setTargetSum] = useState(10);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(15);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [isGolden, setIsGolden] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize game
  const startGame = (selectedMode: GameMode) => {
    setMode(selectedMode);
    setScore(0);
    setLevel(1);
    setCombo(0);
    setIsGolden(false);
    setSelectedIds([]);
    
    // Create empty grid
    const newGrid: (Block | null)[][] = Array.from({ length: ROWS }, () => 
      Array.from({ length: COLS }, () => null)
    );

    // Initial rows (from bottom)
    for (let r = ROWS - INITIAL_ROWS; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        newGrid[r][c] = getRandomBlock();
      }
    }

    setGrid(newGrid);
    setTargetSum(generateTargetSum(10, 20));
    setStatus('playing');

    if (selectedMode === 'time') {
      setTimeLeft(15);
      setTotalTime(15);
    }
  };

  const generateTargetSum = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  // Add a new row at the bottom and push up
  const addRow = useCallback(() => {
    setGrid(prev => {
      // Check if top row has blocks (Game Over)
      if (prev[0].some(cell => cell !== null)) {
        setStatus('gameover');
        return prev;
      }

      const next = [...prev.map(row => [...row])];
      // Shift everything one row up
      for (let r = 0; r < ROWS - 1; r++) {
        next[r] = next[r + 1];
      }
      // New row at the bottom
      next[ROWS - 1] = Array.from({ length: COLS }, () => getRandomBlock());
      return next;
    });

    if (mode === 'time') {
      setTimeLeft(totalTime);
    }
  }, [mode, totalTime]);

  // Handle Game Loop for Time Mode
  useEffect(() => {
    if (status === 'playing' && mode === 'time') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            addRow();
            return totalTime;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, mode, addRow, totalTime]);

  // Handle Selection
  const toggleBlock = (blockId: string) => {
    if (status !== 'playing') return;

    setSelectedIds(prev => {
      if (prev.includes(blockId)) {
        return prev.filter(id => id !== blockId);
      }
      return [...prev, blockId];
    });
  };

  // Gravity logic
  const applyGravity = (currentGrid: (Block | null)[][]) => {
    const next = [...currentGrid.map(row => [...row])];
    for (let c = 0; c < COLS; c++) {
      let writePointer = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (next[r][c] !== null) {
          const temp = next[r][c];
          next[r][c] = null;
          next[writePointer][c] = temp;
          writePointer--;
        }
      }
    }
    return next;
  };

  // Check sum when selection changes
  useEffect(() => {
    if (selectedIds.length === 0) return;

    // Find all selected blocks and their values
    const selectedBlocks: Block[] = [];
    grid.forEach(row => {
      row.forEach(cell => {
        if (cell && selectedIds.includes(cell.id)) {
          selectedBlocks.push(cell);
        }
      });
    });

    const currentSum = selectedBlocks.reduce((acc, b) => acc + b.value, 0);

    if (currentSum === targetSum) {
      // MATCH!
      const isMultiMatch = selectedIds.length >= 4;
      const newCombo = combo + 1;
      setCombo(newCombo);

      // Check for Golden Mode (after 3 consecutive matches or 1 large match)
      if (newCombo >= 3 || isMultiMatch) {
        setIsGolden(true);
      }

      const points = (selectedIds.length * 10 * level) * (isGolden ? 2 : 1) * (newCombo > 1 ? newCombo : 1);
      setScore(s => s + points);
      
      // Remove blocks
      const newGrid = grid.map(row => 
        row.map(cell => (cell && selectedIds.includes(cell.id)) ? null : cell)
      );

      // Apply gravity
      const stableGrid = applyGravity(newGrid);
      setGrid(stableGrid);
      setSelectedIds([]);
      setTargetSum(generateTargetSum(10 + Math.floor(score / 500), 20 + Math.floor(score / 500)));
      
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e']
      });

      if (mode === 'classic') {
        addRow();
      } else {
        // Reset timer for time mode on success?
        // Rules say: "强制新增一行且该轮不得分". 
        // Typically in these games, matching resets timer.
        setTimeLeft(totalTime);
      }

      // Check level up
      if (score > level * 1000) {
        setLevel(l => l + 1);
        if (mode === 'time') {
          setTotalTime(prev => Math.max(5, prev - 1));
        }
      }
    } else if (currentSum > targetSum) {
      // EXCEEDED
      setSelectedIds([]);
      setCombo(0);
    }
  }, [selectedIds, targetSum, grid, score, level, mode, addRow, totalTime]);

  useEffect(() => {
    const localHigh = localStorage.getItem('sumstack_highscore');
    if (localHigh) setHighScore(parseInt(localHigh));
  }, []);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('sumstack_highscore', score.toString());
    }
  }, [score, highScore]);

  useEffect(() => {
    if (isGolden) {
      const timer = setTimeout(() => setIsGolden(false), 5000);
      return () => clearTimeout(timer);
    }
    // If user takes too long, combo might reset? For now just reset if wrong sum
  }, [isGolden]);

  // Calculate current sum for display
  const currentSum = selectedIds.reduce((acc, id) => {
    let val = 0;
    grid.forEach(r => r.forEach(c => {
      if (c && c.id === id) val = c.value;
    }));
    return acc + val;
  }, 0);

  return (
    <div 
      className={`min-h-screen bg-bg text-text flex flex-col items-center justify-center p-4 font-sans select-none overflow-hidden transition-all duration-700 ${isGolden ? 'ring-[50px] ring-inset ring-amber-500/10' : ''}`}
    >
      {/* Golden Mode Announcement */}
      <AnimatePresence>
        {isGolden && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="fixed top-20 z-[100] pointer-events-none"
          >
            <div className="bg-amber-500 text-bg font-black px-8 py-3 rounded-full shadow-[0_0_40px_rgba(245,158,11,0.6)] flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-[0.3em]">Special Ability Active</span>
              <span className="text-2xl italic tracking-tighter">"The boy's eyes turned golden"</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Menu --- */}
      {status === 'menu' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-12"
          id="menu"
        >
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter text-white">
              SUM<span className="text-amber-500">STACK</span>
            </h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">The Golden Puzzle</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={() => startGame('classic')}
              className="bg-slate-900 border-2 border-slate-800 p-6 rounded-3xl hover:border-amber-500 transition-all text-left flex items-center justify-between group"
              id="mode-classic"
            >
              <div>
                <span className="text-2xl font-black block">Classic</span>
                <span className="text-slate-500 text-xs">Endless climb</span>
              </div>
              <Play className="w-8 h-8 text-amber-500 group-hover:scale-110 transition-transform" />
            </button>

            <button 
              onClick={() => startGame('time')}
              className="bg-slate-900 border-2 border-slate-800 p-6 rounded-3xl hover:border-emerald-500 transition-all text-left flex items-center justify-between group"
              id="mode-time"
            >
              <div>
                <span className="text-2xl font-black block">Time</span>
                <span className="text-slate-500 text-xs">Against the clock</span>
              </div>
              <Clock className="w-8 h-8 text-emerald-500 group-hover:scale-110 transition-transform" />
            </button>
          </div>

          <div className="pt-8">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 rounded-full border border-slate-800">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Master Score: <span className="text-white">{highScore}</span></span>
            </div>
          </div>
        </motion.div>
      )}

      {/* --- Gameplay --- */}
      {status === 'playing' && (
        <div className="w-full max-w-xl flex flex-col items-center gap-8" id="game-view">
          {/* Header */}
          <div className="w-full flex items-center justify-between px-4">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Score</span>
              <span className="text-lg font-black">{score.toLocaleString()}</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Goal State</span>
              <div className="flex items-center gap-1">
                {combo > 0 && Array.from({ length: Math.min(3, combo) }).map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                ))}
              </div>
            </div>

            <button onClick={() => setStatus('menu')} className="p-3 bg-slate-900 rounded-2xl hover:bg-slate-800 transition-colors">
              <Home className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Goal Display */}
          <div className="flex flex-col items-center gap-2">
             <div className="bg-white text-bg px-8 py-3 rounded-3xl shadow-[0_20px_50px_rgba(255,255,255,0.1)] flex flex-col items-center">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Target Number</span>
                <motion.span 
                  key={targetSum}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="text-4xl font-black font-mono leading-none"
                >
                  {targetSum}
                </motion.span>
             </div>
             
             {/* Selection Bar */}
             <AnimatePresence>
                {currentSum > 0 && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className={`mt-4 px-4 py-1.5 rounded-xl border-2 flex items-center gap-3 ${
                      currentSum === targetSum ? 'bg-emerald-500 border-emerald-400' : 
                      currentSum > targetSum ? 'bg-rose-500 border-rose-400' : 
                      'bg-slate-900 border-slate-700'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest">Current Sum:</span>
                    <span className="text-lg font-black">{currentSum}</span>
                  </motion.div>
                )}
             </AnimatePresence>
          </div>

          {/* Grid Container */}
          <div className="relative group">
            <div className="bg-slate-900/50 p-3 rounded-[3rem] border-4 border-slate-800 backdrop-blur-md shadow-2xl relative">
              <div className="grid grid-cols-6 gap-2 w-full aspect-[6/10] sm:w-[380px]">
                {grid.map((row, r) => 
                  row.map((cell, c) => (
                    <div key={`cell-${r}-${c}`} className="w-full aspect-square">
                      <AnimatePresence mode="popLayout">
                        {cell ? (
                          <motion.button
                            layoutId={cell.id}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => toggleBlock(cell.id)}
                            className={`w-full h-full rounded-2xl flex items-center justify-center text-2xl font-black text-white transition-all shadow-lg ${
                              selectedIds.includes(cell.id) 
                                ? 'ring-4 ring-white shadow-[0_0_20px_rgba(255,255,255,0.5)] z-10' 
                                : cell.color
                            } ${r === 0 ? 'animate-pulse ring-2 ring-rose-500' : ''}`}
                            id={`block-${cell.id}`}
                          >
                            {cell.value}
                          </motion.button>
                        ) : (
                          <div className="w-full h-full bg-slate-950/40 rounded-2xl border border-white/5" />
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Time Indicator */}
            {mode === 'time' && (
              <div className="absolute -bottom-10 left-6 right-6 flex flex-col items-center gap-2">
                <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border-2 border-slate-800">
                  <motion.div 
                    className={`h-full ${timeLeft < 5 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                    animate={{ width: `${(timeLeft / totalTime) * 100}%` }}
                    transition={{ duration: 1, ease: 'linear' }}
                  />
                </div>
                <div className={`text-xs font-black uppercase tracking-widest ${timeLeft < 5 ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`}>
                  {timeLeft} Seconds Remaining
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Game Over --- */}
      {status === 'gameover' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-slate-900 p-12 rounded-[4rem] text-center space-y-8 shadow-2xl relative"
          id="game-over"
        >
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-white italic">GAME OVER</h2>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Stack limit reached</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded-2xl">
              <span className="block text-[10px] font-black uppercase text-slate-600 mb-1">Score</span>
              <span className="text-2xl font-black text-white">{score}</span>
            </div>
            <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500">
              <span className="block text-[10px] font-black uppercase text-amber-600 mb-1">Best</span>
              <span className="text-2xl font-black text-amber-500">{highScore}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <button 
              onClick={() => startGame(mode)}
              className="bg-white text-bg py-5 rounded-3xl font-black flex items-center justify-center gap-3 hover:bg-amber-500 transition-all hover:scale-[1.02]"
              id="retry-btn"
            >
              <RotateCcw className="w-5 h-5" />
              TRY AGAIN
            </button>
            <button 
              onClick={() => setStatus('menu')}
              className="bg-slate-800 text-white py-5 rounded-3xl font-black flex items-center justify-center gap-3 hover:bg-slate-700 transition-colors"
              id="home-btn"
            >
              <Home className="w-5 h-5" />
              MAIN MENU
            </button>
          </div>
        </motion.div>
      )}

      {/* Ambient BG */}
      <div className="fixed inset-0 pointer-events-none opacity-20 z-[-1]">
        <div className="absolute top-1/4 left-1/4 w-[50vw] h-[50vw] bg-amber-500/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[50vw] h-[50vw] bg-blue-500/10 blur-[150px] rounded-full" />
      </div>
    </div>
  );
}
