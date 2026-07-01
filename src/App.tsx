/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, Play, RotateCcw, Crown, Star, Award, Zap, 
  Smartphone, Volume2, VolumeX, Eye, Info, Crosshair, Settings
} from 'lucide-react';

// === TYPES & INTERFACES ===

type GameState = 'START' | 'PLAYING' | 'GAMEOVER';

interface PlayerShip {
  x: number;
  y: number;
  width: number;
  height: number;
  speedLevel: number; // 0 to 5
  hasBarrier: boolean;
  backShotLevel: number; // 0 to 2
  frontMultiLevel: number; // 0 to 2
  wideShotLevel: number; // 0 to 1 (0: None, 1: Diagonal UP/DOWN forward)
  powerLevel: number; // 1+ (unlimited attack power level)
  rapidLevel: number; // 0 to 3 (limits on rate of fire cooldown)
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isPlayer: boolean;
  angle: number;
  hasCollided?: boolean;
  damage?: number;
}

interface Enemy {
  id: string;
  type: 'small' | 'medium' | 'large';
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  scoreValue: number;
  color: string;
  shootCooldown: number;
  waveOffset: number; // Variable to make undulating patterns
  waveSpeed: number;
  waveAmplitude: number;
}

type ItemType = 'speed' | 'barrier' | 'back' | 'multi' | 'wide' | 'power' | 'rapid';

interface UpgradeItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  glowColor: string;
  symbol: string;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  alpha: number;
  decay: number;
}

interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  vy: number;
  color: string;
  alpha: number;
  scale: number;
}

interface ParallaxStar {
  x: number;
  y: number;
  size: number;
  speed: number;
  color: string;
}

interface RankingRecord {
  score: number;
  date: string;
  isNew?: boolean;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [showNewHighScoreAlert, setShowNewHighScoreAlert] = useState<boolean>(false);
  const [rankings, setRankings] = useState<RankingRecord[]>([]);
  const [showVirtualControls, setShowVirtualControls] = useState<boolean>(false);
  const [isNewRecordInRankings, setIsNewRecordInRankings] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [joystickSensitivity, setJoystickSensitivity] = useState<number>(1.0);
  const [bgmVolume, setBgmVolume] = useState<number>(0.7);
  const [sfxVolume, setSfxVolume] = useState<number>(0.3);
  const [difficulty, setDifficulty] = useState<'EASY' | 'NORMAL' | 'HARD'>('NORMAL');

  const handleSensitivityChange = (val: number) => {
    setJoystickSensitivity(val);
    localStorage.setItem('space_shooter_sensitivity', String(val));
  };

  const handleDifficultyChange = (val: 'EASY' | 'NORMAL' | 'HARD') => {
    setDifficulty(val);
    localStorage.setItem('space_shooter_difficulty', val);
  };

  const handleBgmVolumeChange = (val: number) => {
    setBgmVolume(val);
    localStorage.setItem('space_shooter_bgm_volume', String(val));

    // Play preview sound
    if (soundEnabled) {
      const now = Date.now();
      if (now - lastBgmTestTime.current > 120) {
        lastBgmTestTime.current = now;
        try {
          if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          const ctx = audioCtxRef.current;
          if (ctx.state === 'suspended') {
            ctx.resume();
          }
          // Simple BGM-style chord sound for previewing BGM volume
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          const gain2 = ctx.createGain();

          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);

          osc1.type = 'triangle';
          osc1.frequency.setValueAtTime(110.0, ctx.currentTime); // A2 Bass
          gain1.gain.setValueAtTime(0.08 * val, ctx.currentTime);
          gain1.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.001 * val), ctx.currentTime + 0.25);

          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(440.0, ctx.currentTime); // A4 Melody
          gain2.gain.setValueAtTime(0.035 * val, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.001 * val), ctx.currentTime + 0.25);

          osc1.start();
          osc1.stop(ctx.currentTime + 0.25);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.25);
        } catch (e) {
          console.warn("BGM test sound error:", e);
        }
      }
    }
  };

  const handleSfxVolumeChange = (val: number) => {
    setSfxVolume(val);
    localStorage.setItem('space_shooter_sfx_volume', String(val));

    // Play preview sound
    if (soundEnabled) {
      const now = Date.now();
      if (now - lastSfxTestTime.current > 120) {
        lastSfxTestTime.current = now;
        try {
          if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          const ctx = audioCtxRef.current;
          if (ctx.state === 'suspended') {
            ctx.resume();
          }
          // Simple laser sound for previewing SFX volume
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(600, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.12);

          gain.gain.setValueAtTime(0.12 * val, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.01 * val), ctx.currentTime + 0.12);

          osc.start();
          osc.stop(ctx.currentTime + 0.12);
        } catch (e) {
          console.warn("SFX test sound error:", e);
        }
      }
    }
  };

  // References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Input states
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  
  // Touch/Joystick controller references
  const joystickActive = useRef<boolean>(false);
  const joystickStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickCurrent = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickVector = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchShotActive = useRef<boolean>(false);

  // Sound effects helper (Web Audio API synthesis for zero extra dependencies and offline compliance)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bgmStepRef = useRef<number>(0);
  const lastBgmTestTime = useRef<number>(0);
  const lastSfxTestTime = useRef<number>(0);

  const playSynthesizedSound = useCallback((type: 'laser' | 'hit' | 'explosion' | 'player_explosion' | 'powerup' | 'gameover' | 'highscore') => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      if (type === 'laser') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.12 * sfxVolume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.01 * sfxVolume), ctx.currentTime + 0.15);

        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'hit') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, ctx.currentTime);
        osc.frequency.setValueAtTime(100, ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.1 * sfxVolume, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(Math.max(0.001, 0.01 * sfxVolume), ctx.currentTime + 0.08);

        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'explosion') {
        // Synthesizing noise-like explosion using quick frequency swings
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.4);

        const filter = ctx.createBiquadFilter();
        osc.disconnect(gain);
        osc.connect(filter);
        filter.connect(gain);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, ctx.currentTime);

        gain.gain.setValueAtTime(0.25 * sfxVolume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.01 * sfxVolume), ctx.currentTime + 0.4);

        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'player_explosion') {
        // Massive, ultra-deep ground-shaking rumble combined with high-quality synthesized noise sweep
        const duration = 2.8;

        // 1. White Noise Buffer for dynamic gas expansion hiss & cinematic smoke puff sound
        try {
          const bufferSize = ctx.sampleRate * duration;
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          const noiseSource = ctx.createBufferSource();
          noiseSource.buffer = buffer;

          const noiseFilter = ctx.createBiquadFilter();
          noiseFilter.type = 'lowpass';
          noiseFilter.frequency.setValueAtTime(500, ctx.currentTime);
          noiseFilter.frequency.exponentialRampToValueAtTime(12, ctx.currentTime + duration);
          noiseFilter.Q.setValueAtTime(6, ctx.currentTime);

          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.65 * sfxVolume, ctx.currentTime);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

          noiseSource.connect(noiseFilter);
          noiseFilter.connect(noiseGain);
          noiseGain.connect(ctx.destination);
          
          noiseSource.start();
        } catch (err) {
          console.warn("AudioBuffer synthesis error: ", err);
        }

        // 2. Deep Sub-Bass sawtooth sweep for heavy rumbly vibration
        const subOsc = ctx.createOscillator();
        const subFilter = ctx.createBiquadFilter();
        const subGain = ctx.createGain();

        subOsc.type = 'sawtooth';
        subOsc.frequency.setValueAtTime(90, ctx.currentTime);
        subOsc.frequency.linearRampToValueAtTime(10, ctx.currentTime + duration);

        subFilter.type = 'lowpass';
        subFilter.frequency.setValueAtTime(120, ctx.currentTime);

        subOsc.connect(subFilter);
        subFilter.connect(subGain);
        subGain.connect(ctx.destination);

        subGain.gain.setValueAtTime(0.70 * sfxVolume, ctx.currentTime);
        subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        subOsc.start();
        subOsc.stop(ctx.currentTime + duration);

        // 3. Medium punch transient shockwave pulse at start
        const pulseOsc = ctx.createOscillator();
        const pulseGain = ctx.createGain();
        pulseOsc.type = 'triangle';
        pulseOsc.frequency.setValueAtTime(180, ctx.currentTime);
        pulseOsc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5);

        pulseOsc.connect(pulseGain);
        pulseGain.connect(ctx.destination);

        pulseGain.gain.setValueAtTime(0.40 * sfxVolume, ctx.currentTime);
        pulseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

        pulseOsc.start();
        pulseOsc.stop(ctx.currentTime + 0.5);
      } else if (type === 'powerup') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(0.15 * sfxVolume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.01 * sfxVolume), ctx.currentTime + 0.3);

        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'highscore') {
        // Shiny high score chime
        const note = (freq: number, start: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
          gain.gain.setValueAtTime(0.15 * sfxVolume, ctx.currentTime + start);
          gain.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.01 * sfxVolume), ctx.currentTime + start + duration);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + duration);
        };
        note(523.25, 0, 0.15); // C5
        note(659.25, 0.1, 0.15); // E5
        note(783.99, 0.2, 0.15); // G5
        note(1046.5, 0.3, 0.4); // C6
      } else if (type === 'gameover') {
        // Melancholic game over tune - delayed start so it does not clash with the initial heavy crash/explosion
        const note = (freq: number, start: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
          
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(600, ctx.currentTime + start);
          osc.disconnect(gain);
          osc.connect(filter);
          filter.connect(gain);

          gain.gain.setValueAtTime(0.12 * sfxVolume, ctx.currentTime + start);
          gain.gain.linearRampToValueAtTime(Math.max(0.001, 0.01 * sfxVolume), ctx.currentTime + start + duration);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + duration);
        };
        // Delayed to start after the heavy explosion peak (starts at 1.2s delay)
        note(293.66, 1.2, 0.35); // D4
        note(277.18, 1.55, 0.35); // C#4
        note(261.63, 1.9, 0.7); // C4
      }
    } catch (e) {
      console.warn("Audio Context error: ", e);
    }
  }, [soundEnabled, sfxVolume]);

  // Game Engine Entities (Ref-based for maximum tick performance, fully in sync with specs)
  const playerRef = useRef<PlayerShip>({
    x: 100,
    y: 270,
    width: 32,
    height: 24,
    speedLevel: 0,
    hasBarrier: false,
    backShotLevel: 0,
    frontMultiLevel: 0,
    wideShotLevel: 0,
    powerLevel: 1,
    rapidLevel: 0
  });

  const starsRef = useRef<ParallaxStar[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const itemsRef = useRef<UpgradeItem[]>([]);
  const particlesRef = useRef<SparkParticle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  
  // Game loops trackers
  const spawnTimerRef = useRef<number>(0);
  const shootCooldownRef = useRef<number>(0);
  const isHighScoreTriggeredRef = useRef<boolean>(false);
  const localScoreRef = useRef<number>(0);
  const totalEnemiesDefeatedRef = useRef<number>(0);
  const pityCounterRef = useRef<number>(0);
  const isPlayerDeadRef = useRef<boolean>(false);
  const playerDeathTimerRef = useRef<number>(0);

  // Initialize and load historical high score / rankings
  useEffect(() => {
    try {
      const storedHighScore = localStorage.getItem('space_shooter_highscore');
      if (storedHighScore) {
        setHighScore(parseInt(storedHighScore, 10));
      }

      const storedRankingsStr = localStorage.getItem('space_shooter_rankings_v1');
      if (storedRankingsStr) {
        setRankings(JSON.parse(storedRankingsStr));
      } else {
        // Fallback placeholder ranking
        const initRankings = [
          { score: 5000, date: '2026-06-15' },
          { score: 3000, date: '2026-06-15' },
          { score: 1000, date: '2026-06-15' }
        ];
        localStorage.setItem('space_shooter_rankings_v1', JSON.stringify(initRankings));
        setRankings(initRankings);
      }

      const storedSensitivity = localStorage.getItem('space_shooter_sensitivity');
      if (storedSensitivity) {
        setJoystickSensitivity(parseFloat(storedSensitivity));
      }

      const storedBgmVol = localStorage.getItem('space_shooter_bgm_volume');
      if (storedBgmVol !== null) {
        setBgmVolume(parseFloat(storedBgmVol));
      }

      const storedSfxVol = localStorage.getItem('space_shooter_sfx_volume');
      if (storedSfxVol !== null) {
        setSfxVolume(parseFloat(storedSfxVol));
      }

      const storedDifficulty = localStorage.getItem('space_shooter_difficulty');
      if (storedDifficulty === 'EASY' || storedDifficulty === 'NORMAL' || storedDifficulty === 'HARD') {
        setDifficulty(storedDifficulty);
      }
    } catch (error) {
      console.error("Local storage ranking structure read error:", error);
    }

    // Set initial custom stars for parallax sky
    const initStars: ParallaxStar[] = [];
    for (let i = 0; i < 80; i++) {
      initStars.push({
        x: Math.random() * 960,
        y: Math.random() * 540,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 2.5 + 0.5,
        color: `hsla(${Math.random() * 40 + 200}, 90%, 80%, ${Math.random() * 0.4 + 0.4})`
      });
    }
    starsRef.current = initStars;

    // Detect touch device to show controller layout by default
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      setShowVirtualControls(true);
    }
  }, []);

  // Keyboard events listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser default actions like Spacebar/Arrows scrolling
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) || e.code === 'Space') {
        e.preventDefault();
      }
      keysPressed.current[e.key.toLowerCase()] = true;
      keysPressed.current[e.code.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
      keysPressed.current[e.code.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Set up ranking database updates
  const saveFinishedGameScore = useCallback((finalScore: number) => {
    try {
      // Compute rankings
      const rawStoredRankings = localStorage.getItem('space_shooter_rankings_v1');
      let currentRecords: RankingRecord[] = [];
      if (rawStoredRankings) {
        currentRecords = JSON.parse(rawStoredRankings);
      }

      // Format date beautifully
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const newRecord: RankingRecord = {
        score: finalScore,
        date: dateStr,
        isNew: false
      };

      // Merge and sort in descending order
      const combined = [...currentRecords.map(r => ({ ...r, isNew: false })), newRecord];
      combined.sort((a, b) => b.score - a.score);

      // Keep top 3 only
      const top3 = combined.slice(0, 3);
      
      // Determine if our new run is actually stored inside the top 3
      const isStoredInsideTop3 = top3.some(record => record.score === finalScore && record.date === dateStr);
      if (isStoredInsideTop3) {
        // Tag this new record as a new highlight
        top3.forEach(record => {
          if (record.score === finalScore && record.date === dateStr) {
            record.isNew = true;
          }
        });
        setIsNewRecordInRankings(true);
      } else {
        setIsNewRecordInRankings(false);
      }

      setRankings(top3);
      localStorage.setItem('space_shooter_rankings_v1', JSON.stringify(top3));

      // Handle the high score overall
      if (finalScore > highScore) {
        localStorage.setItem('space_shooter_highscore', String(finalScore));
        setHighScore(finalScore);
      }
    } catch (e) {
      console.error(e);
    }
  }, [highScore]);

  // Spawn dynamic floating scores
  const spawnFloatingText = (text: string, x: number, y: number, color: string = '#E0F2FE', scale: number = 1) => {
    floatingTextsRef.current.push({
      id: Math.random().toString(),
      text,
      x,
      y,
      vy: -1.2,
      color,
      alpha: 1,
      scale
    });
  };

  // Spark explosions particles engine
  const createExplosion = (x: number, y: number, color: string, qty: number = 15) => {
    for (let i = 0; i < qty; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        radius: Math.random() * 2.5 + 1.2,
        alpha: 1,
        decay: Math.random() * 0.03 + 0.015
      });
    }
  };

  // Trigger weapon firing sequence
  const firePlayerWeapons = useCallback(() => {
    const player = playerRef.current;
    const bulletSpeed = 10;
    
    // Front Shot Levels configuration
    // Level 0: 1 normal bullet forward
    // Level 1: 2 parallel offset forward bullets
    // Level 2: 3 forward bullets (1 straight, 2 angled forward slightly)
    if (player.frontMultiLevel === 0) {
      bulletsRef.current.push({
        x: player.x + player.width / 2,
        y: player.y,
        vx: bulletSpeed,
        vy: 0,
        radius: 4.5,
        color: '#22d3ee', // brilliant cyan neon
        isPlayer: true,
        angle: 0
      });
    } else if (player.frontMultiLevel === 1) {
      // 2 parallel offset
      bulletsRef.current.push({
        x: player.x + player.width / 2,
        y: player.y - 7,
        vx: bulletSpeed,
        vy: 0,
        radius: 4.2,
        color: '#22d3ee',
        isPlayer: true,
        angle: 0
      });
      bulletsRef.current.push({
        x: player.x + player.width / 2,
        y: player.y + 7,
        vx: bulletSpeed,
        vy: 0,
        radius: 4.2,
        color: '#22d3ee',
        isPlayer: true,
        angle: 0
      });
    } else if (player.frontMultiLevel >= 2) {
      // 3 bullets: 1 straight forward, 2 styled at angles
      bulletsRef.current.push({
        x: player.x + player.width / 2,
        y: player.y,
        vx: bulletSpeed,
        vy: 0,
        radius: 4.5,
        color: '#22d3ee',
        isPlayer: true,
        angle: 0
      });
      // Angled Up Forward (10 degrees = ~0.174 rad)
      bulletsRef.current.push({
        x: player.x + player.width / 2,
        y: player.y - 5,
        vx: bulletSpeed * Math.cos(0.174),
        vy: -bulletSpeed * Math.sin(0.174),
        radius: 4.2,
        color: '#22d3ee',
        isPlayer: true,
        angle: -0.174
      });
      // Angled Down Forward
      bulletsRef.current.push({
        x: player.x + player.width / 2,
        y: player.y + 5,
        vx: bulletSpeed * Math.cos(0.174),
        vy: bulletSpeed * Math.sin(0.174),
        radius: 4.2,
        color: '#22d3ee',
        isPlayer: true,
        angle: 0.174
      });
    }

    // Back Shot Levels configuration
    // Level 1: 1 straight backward
    // Level 2: 2 bullets backward angled beautifully (e.g. 15 degrees)
    if (player.backShotLevel === 1) {
      bulletsRef.current.push({
        x: player.x - player.width / 2,
        y: player.y,
        vx: -bulletSpeed,
        vy: 0,
        radius: 4,
        color: '#fb7185', // brilliant rose/red
        isPlayer: true,
        angle: Math.PI
      });
    } else if (player.backShotLevel >= 2) {
      // 2 diagonal-like backwards
      bulletsRef.current.push({
        x: player.x - player.width / 2,
        y: player.y - 4,
        vx: -bulletSpeed * Math.cos(0.13),
        vy: -bulletSpeed * Math.sin(0.13),
        radius: 4,
        color: '#fb7185',
        isPlayer: true,
        angle: Math.PI - 0.13
      });
      bulletsRef.current.push({
        x: player.x - player.width / 2,
        y: player.y + 4,
        vx: -bulletSpeed * Math.cos(0.13),
        vy: bulletSpeed * Math.sin(0.13),
        radius: 4,
        color: '#fb7185',
        isPlayer: true,
        angle: Math.PI + 0.13
      });
    }

    // Wide Shot configuration (30 degrees up-right and down-right)
    if (player.wideShotLevel >= 1) {
      // Diagonal UP (30° = 0.52 rad)
      bulletsRef.current.push({
        x: player.x + player.width / 4,
        y: player.y - 6,
        vx: bulletSpeed * Math.cos(0.52),
        vy: -bulletSpeed * Math.sin(0.52),
        radius: 4,
        color: '#c084fc', // sleek purple
        isPlayer: true,
        angle: -0.52
      });
      // Diagonal DOWN
      bulletsRef.current.push({
        x: player.x + player.width / 4,
        y: player.y + 6,
        vx: bulletSpeed * Math.cos(0.52),
        vy: bulletSpeed * Math.sin(0.52),
        radius: 4,
        color: '#c084fc',
        isPlayer: true,
        angle: 0.52
      });
    }

    bulletsRef.current.forEach(b => {
      if (b.isPlayer && b.damage === undefined) {
        b.damage = player.powerLevel || 1;
      }
    });

    playSynthesizedSound('laser');
  }, [playSynthesizedSound]);

  // Main tick and update logic inside requestedAnimationFrame
  const updateGameTick = useCallback(() => {
    if (gameState !== 'PLAYING') return;

    // Death timer countdown (3 seconds pause/buffer before gameover overlay)
    if (isPlayerDeadRef.current) {
      playerDeathTimerRef.current--;
      if (playerDeathTimerRef.current <= 0) {
        setGameState('GAMEOVER');
        saveFinishedGameScore(localScoreRef.current);
        return;
      }
    }

    // Reset loop
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const player = playerRef.current;

    // Clear canvas
    ctx.fillStyle = '#05050c'; // highly polished space dark background
    ctx.fillRect(0, 0, 960, 540);

    // 1. UPDATE PARALLAX STARS BACKGROUND
    starsRef.current.forEach(star => {
      if (!isPlayerDeadRef.current) {
        star.x -= star.speed;
        if (star.x < 0) {
          star.x = 960;
          star.y = Math.random() * 540;
        }
      }
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. UPDATE PLAYER POSITION & MOVEMENT
    if (!isPlayerDeadRef.current) {
      const player = playerRef.current;
      let dx = 0;
      let dy = 0;

      // Keyboard inputs
      if (keysPressed.current['arrowup'] || keysPressed.current['w']) dy -= 1;
      if (keysPressed.current['arrowdown'] || keysPressed.current['s']) dy += 1;
      if (keysPressed.current['arrowleft'] || keysPressed.current['a']) dx -= 1;
      if (keysPressed.current['arrowright'] || keysPressed.current['d']) dx += 1;

      // Apply joystick vector (from touch inputs) if active
      if (joystickActive.current) {
        dx = joystickVector.current.x;
        dy = joystickVector.current.y;
      }

      // Calculate movement speeds based on current upgrade Speed Level (0 to 5)
      // Speed: Default is 4.5, each speed level gives +1 speed
      const baseSpeed = 4.5 + player.speedLevel * 1.0;
      
      // Normalize diagonal speeds
      if (dx !== 0 && dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx = (dx / length) * baseSpeed;
        dy = (dy / length) * baseSpeed;
      } else {
        dx *= baseSpeed;
        dy *= baseSpeed;
      }

      player.x += dx;
      player.y += dy;

      // Stage boundary checks (horizontal constraint space with margin)
      const marginX = player.width;
      const marginY = player.height;
      if (player.x < marginX) player.x = marginX;
      if (player.x > 960 - marginX) player.x = 960 - marginX;
      if (player.y < marginY) player.y = marginY;
      if (player.y > 540 - marginY) player.y = 540 - marginY;

      // Cooldown and Shooting mechanics
      if (shootCooldownRef.current > 0) {
        shootCooldownRef.current--;
      }

      // Auto-fire checks: keyboard Spacebar, 'z', or touch button
      const isHoldFireRequested = keysPressed.current[' '] || keysPressed.current['space'] || keysPressed.current['z'] || touchShotActive.current;
      if (isHoldFireRequested && shootCooldownRef.current === 0) {
        firePlayerWeapons();
        const currentRapidLevel = player.rapidLevel || 0;
        const baseCooldown = 14;
        shootCooldownRef.current = Math.max(5, baseCooldown - currentRapidLevel * 3); // fired once every 14, 11, 8, or 5 frames
      }

      // 3. RENDER PLAYER SPACECRAFT
      ctx.save();
      ctx.translate(player.x, player.y);

      // Glowing shield overlay (Front barrier - blocks 1 bullet, doesn't stack)
      if (player.hasBarrier) {
        ctx.beginPath();
        // Circle shape centered at player
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8'; // glowing sky-blue
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 12;
        ctx.stroke();

        // Inner faint grid shield
        ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.fill();
        ctx.shadowBlur = 0; // reset shadow
      }

      // Sleek vector neon player spaceship
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#22d3ee'; // bright cyan

      ctx.beginPath();
      // Triangular core spacecraft shape facing right
      ctx.moveTo(18, 0);
      ctx.lineTo(-14, -12);
      ctx.lineTo(-8, -4);
      ctx.lineTo(-8, 4);
      ctx.lineTo(-14, 12);
      ctx.closePath();
      ctx.fill();

      // Thrust flame animation (glowing orange/yellow)
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 10;
      ctx.fillStyle = Math.random() > 0.5 ? '#f59e0b' : '#ef4444';
      ctx.beginPath();
      ctx.moveTo(-9, -3);
      ctx.lineTo(-18 - Math.random() * 8, 0);
      ctx.lineTo(-9, 3);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
      ctx.shadowBlur = 0; // Reset canvas glow settings
    }
    // 4. GENERATE & UPDATE ENEMIES
    if (!isPlayerDeadRef.current) {
      spawnTimerRef.current++;
      // Adjust spawn rate: starts high, slowly ramps up as score increases
      // Hard mode starts with shorter spawn period, Easy starts with longer spawn period
      const baseSpawnRate = difficulty === 'HARD' ? 80 : difficulty === 'EASY' ? 120 : 100;
      const minSpawnPeriod = difficulty === 'HARD' ? 30 : difficulty === 'EASY' ? 50 : 40;
      const spawnPeriod = Math.max(minSpawnPeriod, baseSpawnRate - Math.floor(score / 1200) * 12);
      if (spawnTimerRef.current >= spawnPeriod) {
        spawnTimerRef.current = 0;

        // Select random enemy type based on score weight and difficulty
        const rand = Math.random();
        let type: 'small' | 'medium' | 'large' = 'small';
        
        if (difficulty === 'EASY') {
          if (score >= 4000) {
            type = rand < 0.6 ? 'small' : rand < 0.9 ? 'medium' : 'large';
          } else if (score >= 1200) {
            type = rand < 0.8 ? 'small' : 'medium';
          } else {
            type = 'small';
          }
        } else if (difficulty === 'HARD') {
          if (score >= 4000) {
            type = rand < 0.2 ? 'small' : rand < 0.6 ? 'medium' : 'large';
          } else if (score >= 1200) {
            type = rand < 0.4 ? 'small' : rand < 0.85 ? 'medium' : 'large';
          } else {
            type = rand < 0.8 ? 'small' : 'medium';
          }
        } else {
          // NORMAL
          if (score >= 4000) {
            type = rand < 0.4 ? 'small' : rand < 0.75 ? 'medium' : 'large';
          } else if (score >= 1200) {
            type = rand < 0.6 ? 'small' : 'medium';
          } else {
            type = 'small';
          }
        }

        let ey = 40 + Math.random() * 460;
        let evx = -1.8;
        let evy = 0;
        let hp = 1;
        let sizeW = 26;
        let sizeH = 22;
        let sValue = 100;
        let color = '#8cb8ff'; // Small: bright ice blue

        if (type === 'small') {
          if (difficulty === 'EASY') {
            evx = -1.2;
            hp = 1;
          } else if (difficulty === 'HARD') {
            evx = -2.33;
            hp = 2;
          } else {
            evx = -1.8;
            hp = 1;
          }
        } else if (type === 'medium') {
          sizeW = 34;
          sizeH = 26;
          sValue = 300;
          color = '#f97316'; // Medium: orange
          if (difficulty === 'EASY') {
            hp = 2;
            evx = -2.0;
          } else if (difficulty === 'HARD') {
            hp = 4;
            evx = -3.6;
          } else {
            hp = 3;
            evx = -2.8;
          }
        } else if (type === 'large') {
          sizeW = 46;
          sizeH = 38;
          sValue = 500;
          color = '#a855f7'; // Large: heavy purple
          if (difficulty === 'EASY') {
            hp = 4;
            evx = -0.7;
          } else if (difficulty === 'HARD') {
            hp = 7;
            evx = -1.5;
          } else {
            hp = 5;
            evx = -1.0;
          }
        }

        enemiesRef.current.push({
          id: Math.random().toString(),
          type,
          x: 1000, // starts offright
          y: ey,
          vx: evx,
          vy: evy,
          width: sizeW,
          height: sizeH,
          hp,
          maxHp: hp,
          scoreValue: sValue,
          color,
          shootCooldown: 30 + Math.random() * 50,
          waveOffset: Math.random() * 100,
          waveSpeed: 0.04 + Math.random() * 0.03,
          waveAmplitude: 2 + Math.random() * 2
        });
      }
    }

    // Update Enemies Actions & Collisions
    const nextEnemies: Enemy[] = [];
    enemiesRef.current.forEach(enemy => {
      if (!isPlayerDeadRef.current) {
        // 1) Movement update
        if (enemy.type === 'small') {
          // Small: moves straight fast
          enemy.x += enemy.vx * 1.5;
        } else if (enemy.type === 'medium') {
          // Medium: wavy pattern movement (sinusoidal offset in y)
          enemy.x += enemy.vx;
          enemy.waveOffset += enemy.waveSpeed;
          enemy.y += Math.sin(enemy.waveOffset) * enemy.waveAmplitude;
        } else if (enemy.type === 'large') {
          // Large: Slow moving
          enemy.x += enemy.vx;
        }

        // Keep inside vertical screens
        if (enemy.y < 30) { enemy.y = 30; enemy.waveAmplitude *= -1; }
        if (enemy.y > 510) { enemy.y = 510; enemy.waveAmplitude *= -1; }

        // 2) Shoot cooldown / triggers
        enemy.shootCooldown--;
        if (enemy.shootCooldown <= 0) {
          if (enemy.type === 'medium') {
            if (difficulty === 'EASY') {
              enemy.shootCooldown = 180 + Math.random() * 70;
            } else if (difficulty === 'HARD') {
              enemy.shootCooldown = 90 + Math.random() * 60;
            } else {
              enemy.shootCooldown = 130 + Math.random() * 100;
            }
          } else if (enemy.type === 'large') {
            if (difficulty === 'EASY') {
              enemy.shootCooldown = 150 + Math.random() * 80;
            } else if (difficulty === 'HARD') {
              enemy.shootCooldown = 70 + Math.random() * 50;
            } else {
              enemy.shootCooldown = 100 + Math.random() * 80;
            }
          } else {
            enemy.shootCooldown = 99999; // small doesn't shoot
          }

          // Bullets types based on enemy size!
          if (enemy.type === 'medium') {
            // Purple homing bullet towards players current direction
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const angle = Math.atan2(dy, dx);
            
            let eBulletSpeed = 4.2;
            if (difficulty === 'EASY') eBulletSpeed = 3.0;
            else if (difficulty === 'HARD') eBulletSpeed = 5.5;

            bulletsRef.current.push({
              x: enemy.x - enemy.width / 2,
              y: enemy.y,
              vx: Math.cos(angle) * eBulletSpeed,
              vy: Math.sin(angle) * eBulletSpeed,
              radius: 5,
              color: '#ff007f', // glowing high-intensity magenta
              isPlayer: false,
              angle
            });
          } else if (enemy.type === 'large') {
            // Multi-direction bullet fan (3 bullets)
            const angleCenter = Math.PI; // straight left
            
            let eBulletSpeed = 3.5;
            if (difficulty === 'EASY') eBulletSpeed = 2.5;
            else if (difficulty === 'HARD') eBulletSpeed = 4.5;

            const angles = [angleCenter, angleCenter - 0.25, angleCenter + 0.25];
            angles.forEach(ang => {
              bulletsRef.current.push({
                x: enemy.x - enemy.width / 2,
                y: enemy.y,
                vx: Math.cos(ang) * eBulletSpeed,
                vy: Math.sin(ang) * eBulletSpeed,
                radius: 4.5,
                color: '#ef4444', // heavy red
                isPlayer: false,
                angle: ang
              });
            });
          }
        }
      }

      // === DRAW ENEMY SHIP ===
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.shadowColor = enemy.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = enemy.color;

      if (enemy.type === 'small') {
        // Small (偵察機): a sleek diamond/star fighter shape pointing left
        ctx.beginPath();
        ctx.moveTo(-enemy.width / 2, 0); // Nose pointing left
        ctx.lineTo(enemy.width / 2, -enemy.height / 2); // Top right wing
        ctx.lineTo(enemy.width / 4, 0); // Wing joint
        ctx.lineTo(enemy.width / 2, enemy.height / 2); // Bottom right wing
        ctx.closePath();
        ctx.fill();

        // Small thruster plasma light trail
        ctx.shadowColor = '#38bdf8';
        ctx.fillStyle = Math.random() > 0.5 ? '#38bdf8' : '#e0f2fe';
        ctx.beginPath();
        ctx.moveTo(enemy.width / 2, -3);
        ctx.lineTo(enemy.width / 2 + 5 + Math.random() * 4, 0);
        ctx.lineTo(enemy.width / 2, 3);
        ctx.closePath();
        ctx.fill();
        
      } else if (enemy.type === 'medium') {
        // Medium (突撃機): double-wing or orange arrow shape pointing left
        ctx.beginPath();
        ctx.moveTo(-enemy.width / 2, 0); // Nose
        ctx.lineTo(enemy.width / 4, -enemy.height / 2); // Upper outer wing tips
        ctx.lineTo(enemy.width / 2, -enemy.height / 4); // Back wing indent
        ctx.lineTo(0, 0); // Center back indent
        ctx.lineTo(enemy.width / 2, enemy.height / 4); // Back wing indent
        ctx.lineTo(enemy.width / 4, enemy.height / 2); // Lower wing tip
        ctx.closePath();
        ctx.fill();

        // HP bar for medium enemies
        ctx.restore();
        ctx.save();
        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
        ctx.fillRect(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2 - 8, enemy.width, 3);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2 - 8, enemy.width * (enemy.hp / enemy.maxHp), 3);

        // Orange flame thruster
        ctx.translate(enemy.x, enemy.y);
        ctx.shadowColor = '#f97316';
        ctx.fillStyle = Math.random() > 0.5 ? '#f97316' : '#ef4444';
        ctx.beginPath();
        ctx.moveTo(enemy.width / 4, -4);
        ctx.lineTo(enemy.width / 2 + 8, 0);
        ctx.lineTo(enemy.width / 4, 4);
        ctx.closePath();
        ctx.fill();
        
      } else if (enemy.type === 'large') {
        // Large (要塞機): Heavy hexagonal purple space fortress carrier shape
        ctx.beginPath();
        ctx.moveTo(-enemy.width / 2, 0); // Nose/front
        ctx.lineTo(-enemy.width / 4, -enemy.height / 2); // upper front corner
        ctx.lineTo(enemy.width / 2, -enemy.height / 2); // upper back corner
        ctx.lineTo(enemy.width / 3, 0); // rear thruster indent
        ctx.lineTo(enemy.width / 2, enemy.height / 2); // lower back corner
        ctx.lineTo(-enemy.width / 4, enemy.height / 2); // lower front corner
        ctx.closePath();
        ctx.fill();

        // Glowing core detail
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ff55a3';
        ctx.fillStyle = '#ff55a3';
        ctx.beginPath();
        ctx.arc(-enemy.width / 10, 0, 6, 0, Math.PI * 2);
        ctx.fill();

        // HP bar for large flagship enemies
        ctx.restore();
        ctx.save();
        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
        ctx.fillRect(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2 - 10, enemy.width, 4);
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2 - 10, enemy.width * (enemy.hp / enemy.maxHp), 4);

        // Huge double purple plasma jet flames
        ctx.translate(enemy.x, enemy.y);
        ctx.shadowColor = '#a855f7';
        ctx.fillStyle = Math.random() > 0.5 ? '#a855f7' : '#ff007f';
        ctx.beginPath();
        // Upper engine nozzle
        ctx.moveTo(enemy.width / 3, -10);
        ctx.lineTo(enemy.width / 2 + 10, -7);
        ctx.lineTo(enemy.width / 3, -4);
        // Lower engine nozzle
        ctx.moveTo(enemy.width / 3, 4);
        ctx.lineTo(enemy.width / 2 + 10, 7);
        ctx.lineTo(enemy.width / 3, 10);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      // Check collision between plane body and player directly
      if (!isPlayerDeadRef.current) {
        const distToPlayer = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        const collisionThreshold = (enemy.width + player.width) / 2.3;

        if (distToPlayer < collisionThreshold) {
          // Collided! Player hits enemy ship directly
          if (player.hasBarrier) {
            // Shield shields player once!
            player.hasBarrier = false;
            // Explode the enemy too to be fair
            createExplosion(enemy.x, enemy.y, enemy.color, 12);
            playSynthesizedSound('hit');
            spawnFloatingText("SHIELD BREAK", player.x, player.y - 12, '#38bdf8', 1.2);
          } else {
            // Boom! Game Over. Player explodes.
            handlePlayerExploded();
            return;
          }
        }
      }

      // Keep active if on screen
      if (isPlayerDeadRef.current || enemy.x > -50) {
        nextEnemies.push(enemy);
      }
    });
    enemiesRef.current = nextEnemies;

    // 5. UPDATE LASER BULLETS (自機 & 敵弾)
    const nextBullets: Bullet[] = [];
    bulletsRef.current.forEach(bullet => {
      if (!isPlayerDeadRef.current) {
        // Advance positions
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
      }

      // Filter out-of-bounds bullets immediately
      if (bullet.x < -20 || bullet.x > 980 || bullet.y < -20 || bullet.y > 560) {
        return;
      }

      if (bullet.isPlayer) {
        // COLLISION CHECK: Player bullet hitting any Enemy
        let hitEnemyIndex = -1;
        for (let i = 0; i < enemiesRef.current.length; i++) {
          const enemy = enemiesRef.current[i];
          const bDist = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
          if (bDist < (enemy.width / 2 + bullet.radius)) {
            hitEnemyIndex = i;
            break;
          }
        }

        if (hitEnemyIndex !== -1) {
          const targetEnemy = enemiesRef.current[hitEnemyIndex];
          const damageValue = bullet.damage || 1;
          targetEnemy.hp -= damageValue;
          createExplosion(bullet.x, bullet.y, targetEnemy.color, 4);
          playSynthesizedSound('hit');

          if (targetEnemy.hp <= 0) {
            // Kill enemy!
            createExplosion(targetEnemy.x, targetEnemy.y, targetEnemy.color, 20);
            playSynthesizedSound('explosion');
            
            // Increment scores & display floating text
            const addedScore = targetEnemy.scoreValue;
            setScore(prev => {
              const currentNew = prev + addedScore;
              localScoreRef.current = currentNew;
              return currentNew;
            });
            scoreTextFloat(addedScore, targetEnemy.x, targetEnemy.y);

            // Item Drop computation (5% or pity rule)
            const dropRate = difficulty === 'HARD' ? 0.10 : 0.05;
            let willDrop = Math.random() < dropRate;
            const updatedDefeats = totalEnemiesDefeatedRef.current + 1;
            totalEnemiesDefeatedRef.current = updatedDefeats;

            // Trigger pity item if kills have passed without item drops (20 for normal, 10 for hard)
            const pityThreshold = difficulty === 'HARD' ? 10 : 20;
            pityCounterRef.current += 1;
            if (pityCounterRef.current >= pityThreshold) {
              willDrop = true;
            }

            if (willDrop) {
              spawnPowerUpUpgrade(targetEnemy.x, targetEnemy.y);
              pityCounterRef.current = 0; // reset
            }

            // Slice out dead enemy
            enemiesRef.current.splice(hitEnemyIndex, 1);
          }
          // Bullets of player NEVER pierce. They delete itself upon contact.
          return;
        }
      } else if (!bullet.hasCollided && !isPlayerDeadRef.current) {
        // COLLISION CHECK: Enemy bullet hitting Player ship
        const distToPlayerBullet = Math.hypot(player.x - bullet.x, player.y - bullet.y);
        // Soft box bounds contact
        if (distToPlayerBullet < (bullet.radius + 12)) {
          // Bullet contacts Player ship!
          bullet.hasCollided = true; // Mark to prevent multiple hit frame instant gameovers
          if (player.hasBarrier) {
            // Blocks 1 bullet, shield goes down, BUT the bullet itself passes right through!
            // This complies with both "front defense" and "敵のたまに当たる時は通り抜ける" (pierces through, stays alive)
            player.hasBarrier = false;
            playSynthesizedSound('hit');
            spawnFloatingText("BARRIER BROKEN", player.x, player.y - 12, '#38bdf8', 1.25);
          } else {
            // Dies on hit! The enemy bullet stays in movement since it pierces through as spec requested.
            // Start the explosion & transition to Gameover
            handlePlayerExploded();
            // We still keep the bullet on-screen, drifting forwards
          }
        }
      }

      nextBullets.push(bullet);
    });
    bulletsRef.current = nextBullets;

    // Helper floating scores
    function scoreTextFloat(added: number, x: number, y: number) {
      spawnFloatingText(`+${added}`, x, y - 8, '#fcd34d', 1.15);
    }

    // High Score notification during play
    if (highScore > 0 && localScoreRef.current > highScore && !isHighScoreTriggeredRef.current) {
      isHighScoreTriggeredRef.current = true;
      setShowNewHighScoreAlert(true);
      playSynthesizedSound('highscore');
      // Dissolve after 3 seconds
      setTimeout(() => {
        setShowNewHighScoreAlert(false);
      }, 3500);
    }

    // 6. UPDATE UPGRADE ITEMS DROPPED
    const nextItems: UpgradeItem[] = [];
    itemsRef.current.forEach(item => {
      if (!isPlayerDeadRef.current) {
        // Items move slowly leftwards
        item.x += item.vx;
        
        // Gentle floating sine motion
        item.y += Math.sin(item.x * 0.05) * 0.4;
      }

      // Draw item indicator capsule with glowing ring
      ctx.save();
      ctx.shadowColor = item.glowColor;
      ctx.shadowBlur = 10;
      ctx.fillStyle = item.glowColor;

      // Draw outer circle
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw shiny inner core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radius - 3, 0, Math.PI * 2);
      ctx.fill();

      // Draw text identifier symbol
      ctx.fillStyle = '#05050c';
      ctx.font = 'bold 11px font-mono';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.symbol, item.x, item.y + 0.5);

      ctx.restore();

      // Check pickup interaction with players ship
      if (!isPlayerDeadRef.current) {
        const pDist = Math.hypot(player.x - item.x, player.y - item.y);
        if (pDist < (player.width / 1.7 + item.radius)) {
          // Gained Upgrade!
          applyItemUpgrade(item.type);
          playSynthesizedSound('powerup');
          return; // picked up, skip adding to list
        }
      }

      // Safe bounds check
      if (isPlayerDeadRef.current || item.x > -40) {
        nextItems.push(item);
      }
    });
    itemsRef.current = nextItems;

    // 7. DRAW LASERS BULLETS ON SCREEN
    bulletsRef.current.forEach(b => {
      ctx.save();
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 6;
      
      ctx.beginPath();
      // Render capsule-like glowing line instead of plain circle
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillRect(-b.radius * 1.5, -b.radius / 1.7, b.radius * 3, b.radius * 1.1);
      ctx.restore();
    });

    // 8. UPDATE SPARK PARTICLES
    const nextParticles: SparkParticle[] = [];
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.alpha > 0) {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        nextParticles.push(p);
      }
    });
    particlesRef.current = nextParticles;

    // 9. DRAW DYNAMIC FLOATING INTERACTIVE TEXTS
    const nextFloatingTexts: FloatingText[] = [];
    floatingTextsRef.current.forEach(ft => {
      ft.y += ft.vy;
      ft.alpha -= 0.015;

      if (ft.alpha > 0) {
        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.fillStyle = ft.color;
        ctx.font = `bold ${Math.floor(13 * ft.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
        nextFloatingTexts.push(ft);
      }
    });
    floatingTextsRef.current = nextFloatingTexts;

    // 10. DRAW GAME HUD (Top Bar overlay on canvas directly)
    ctx.fillStyle = 'rgba(10, 10, 20, 0.55)';
    ctx.fillRect(0, 0, 960, 42);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(0, 42);
    ctx.lineTo(960, 42);
    ctx.stroke();

    // High score, current score indicators
    // Retro font styling
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 12px font-mono';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE', 20, 25);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px font-sans';
    ctx.fillText(`${score}`, 70, 26);

    ctx.fillStyle = '#fbbf24'; // beautiful gold
    ctx.font = '500 12px font-mono';
    ctx.fillText('HI-SCORE', 240, 25);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px font-sans';
    ctx.fillText(`${Math.max(highScore, score)}`, 310, 26);

    // Render active parameters bar
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = '11px font-mono';
    ctx.fillText('SHIELDS:', 680, 25);

    // Cyan shields check
    ctx.fillStyle = player.hasBarrier ? '#22d3ee' : '#ef4444';
    ctx.fillText(player.hasBarrier ? '● ACTIVE' : '○ NONE', 735, 25);

    // Upgrades lists representation in text
    ctx.fillStyle = '#64748b';
    ctx.fillText('ARMAMENT SYSTEM:', 875, 25);
    
    // Armaments levels simple preview
    const totalWeapSum = player.frontMultiLevel + player.backShotLevel + player.wideShotLevel + player.speedLevel;
    ctx.fillStyle = totalWeapSum > 0 ? '#10b981' : '#64748b';
    ctx.fillText(`LVL ${totalWeapSum}`, 940, 25);

    // Launch next tick frame
    requestRef.current = requestAnimationFrame(updateGameTick);
  }, [gameState, score, highScore, firePlayerWeapons, playSynthesizedSound]);

  // Spawn Upgrade Item logic
  function spawnPowerUpUpgrade(ex: number, ey: number) {
    // Extremely rare: 3% probability of dropping Attack Power Up (P)
    const isPowerUp = Math.random() < 0.03;
    let randomType: ItemType;
    
    if (isPowerUp) {
      randomType = 'power';
    } else {
      const list: ItemType[] = ['speed', 'barrier', 'back', 'multi', 'wide', 'rapid'];
      randomType = list[Math.floor(Math.random() * list.length)];
    }

    let color = '#fbbf24';
    let label = 'S';

    if (randomType === 'speed') {
      color = '#facc15'; // yellow S
      label = 'S';
    } else if (randomType === 'barrier') {
      color = '#38bdf8'; // cyan B
      label = 'B';
    } else if (randomType === 'back') {
      color = '#fb7185'; // reddish-pink R (Rear)
      label = 'R';
    } else if (randomType === 'multi') {
      color = '#4ade80'; // green F (Front multi)
      label = 'F';
    } else if (randomType === 'wide') {
      color = '#c084fc'; // sleek purple W
      label = 'W';
    } else if (randomType === 'power') {
      color = '#ef4444'; // intense crimson P
      label = 'P';
    } else if (randomType === 'rapid') {
      color = '#f97316'; // orange T (Turbo / Rapid fire rate)
      label = 'T';
    }

    itemsRef.current.push({
      id: Math.random().toString(),
      type: randomType,
      x: ex,
      y: ey,
      vx: -1.4, // float slowly straight left
      vy: 0,
      radius: 12,
      glowColor: color,
      symbol: label
    });
  }

  // Handle upgrade effects instantly
  function applyItemUpgrade(type: ItemType) {
    const player = playerRef.current;
    if (type === 'speed') {
      // Maximum 5 speed level
      if (player.speedLevel < 5) {
        player.speedLevel += 1;
        spawnFloatingText(`SPEED UP LV${player.speedLevel}`, player.x, player.y - 18, '#facc15', 1.3);
      } else {
        spawnFloatingText("SPEED MAX", player.x, player.y - 18, '#facc15', 1.1);
      }
    } else if (type === 'barrier') {
      // Non-stackable shield
      player.hasBarrier = true;
      spawnFloatingText(`SHIELD CHARGED`, player.x, player.y - 18, '#38bdf8', 1.3);
    } else if (type === 'back') {
      // Max 2 backshot level
      if (player.backShotLevel < 2) {
        player.backShotLevel += 1;
        spawnFloatingText(`REAR SHOT LV${player.backShotLevel}`, player.x, player.y - 18, '#fb7185', 1.3);
      } else {
        spawnFloatingText("REAR SHOT MAX", player.x, player.y - 18, '#fb7185', 1.1);
      }
    } else if (type === 'multi') {
      // Max 2 multi level
      if (player.frontMultiLevel < 2) {
        player.frontMultiLevel += 1;
        spawnFloatingText(`FRONT SHOT LV${player.frontMultiLevel + 1}`, player.x, player.y - 18, '#4ade80', 1.3);
      } else {
        spawnFloatingText("FRONT SHOT MAX", player.x, player.y - 18, '#4ade80', 1.1);
      }
    } else if (type === 'wide') {
      if (player.wideShotLevel < 1) {
        player.wideShotLevel = 1;
        spawnFloatingText(`WIDE SHOT ENABLED`, player.x, player.y - 18, '#c084fc', 1.3);
      } else {
        spawnFloatingText(`WIDE SHOT MAX`, player.x, player.y - 18, '#c084fc', 1.1);
      }
    } else if (type === 'power') {
      player.powerLevel = (player.powerLevel || 1) + 1;
      spawnFloatingText(`ATTACK POWER UP LV${player.powerLevel}`, player.x, player.y - 18, '#ef4444', 1.4);
    } else if (type === 'rapid') {
      if (player.rapidLevel === undefined) {
        player.rapidLevel = 0;
      }
      if (player.rapidLevel < 3) {
        player.rapidLevel += 1;
        spawnFloatingText(`FIRE RATE LV${player.rapidLevel}`, player.x, player.y - 18, '#f97316', 1.3);
      } else {
        spawnFloatingText("FIRE RATE MAX", player.x, player.y - 18, '#f97316', 1.1);
      }
    }
  }

  // Handle crash/defeat
  function handlePlayerExploded() {
    if (isPlayerDeadRef.current) return;
    isPlayerDeadRef.current = true;
    playerDeathTimerRef.current = 180; // 3 seconds at 60 FPS

    // Generate highly durable particles with very slow decay so it lasts the whole 3 seconds
    const colors = ['#e11d48', '#f59e0b', '#ffffff', '#fb7185', '#facc15', '#ec4899', '#3b82f6'];
    for (let i = 0; i < 180; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4.5 + 0.2; // diverse expansion velocities
      const color = colors[Math.floor(Math.random() * colors.length)];
      particlesRef.current.push({
        x: playerRef.current.x,
        y: playerRef.current.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        radius: Math.random() * 5.0 + 1.5, // much larger dramatic particles
        alpha: 1,
        decay: Math.random() * 0.0035 + 0.0025 // very slow fade out over 3 seconds (~180 frames)
      });
    }

    // Add extra layered expanding shockwave rings
    for (let r = 0; r < 4; r++) {
      const ringColor = r === 0 ? '#ffffff' : r === 1 ? '#38bdf8' : r === 2 ? '#f59e0b' : '#e11d48';
      const qty = 40 + r * 12;
      for (let i = 0; i < qty; i++) {
        const angle = (i / qty) * Math.PI * 2;
        const speed = 1.0 + r * 0.9;
        particlesRef.current.push({
          x: playerRef.current.x,
          y: playerRef.current.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: ringColor,
          radius: 2.2,
          alpha: 1.0,
          decay: 0.004 // stays long-lasting
        });
      }
    }

    playSynthesizedSound('player_explosion');
    playSynthesizedSound('gameover');
  }

  // Manage loops hooks life cycles
  useEffect(() => {
    if (gameState === 'PLAYING') {
      // Start loop
      requestRef.current = requestAnimationFrame(updateGameTick);
    } else {
      // Cancel previous loop
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [gameState, updateGameTick]);

  // Background Music (BGM) Procedural Loop Synthesizer
  useEffect(() => {
    let intervalId: any = null;

    if (gameState === 'PLAYING' && soundEnabled) {
      bgmStepRef.current = 0; // Start at the beginning of the sequence

      const playBgmStep = () => {
        try {
          if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          const ctx = audioCtxRef.current;
          if (ctx.state === 'suspended') {
            ctx.resume();
          }

          const step = bgmStepRef.current;
          bgmStepRef.current = (step + 1) % 16; // 16-step looping sequence

          // Bassline Chord Progression: Am (0-3), F (4-7), C (8-11), G (12-15)
          let bassFreq = 110.0; // Am (A2)
          if (step >= 4 && step < 8) bassFreq = 87.31; // F (F2)
          else if (step >= 8 && step < 12) bassFreq = 130.81; // C (C3)
          else if (step >= 12) bassFreq = 98.00; // G (G2)

          // Soft sub-bass synthesizer beat on even steps
          if (step % 2 === 0) {
            const bassOsc = ctx.createOscillator();
            const bassGain = ctx.createGain();
            bassOsc.connect(bassGain);
            bassGain.connect(ctx.destination);
            bassOsc.type = 'triangle';
            bassOsc.frequency.setValueAtTime(bassFreq, ctx.currentTime);
            bassGain.gain.setValueAtTime(0.08 * bgmVolume, ctx.currentTime);
            bassGain.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.001 * bgmVolume), ctx.currentTime + 0.22);
            bassOsc.start();
            bassOsc.stop(ctx.currentTime + 0.22);
          }

          // Melodic retro arpeggiation sequences on odd steps
          const melodyAm = [220.0, 261.63, 293.66, 329.63]; // A3, C4, D4, E4
          const melodyF = [174.61, 220.0, 261.63, 349.23];  // F3, A3, C4, F4
          const melodyC = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
          const melodyG = [196.00, 246.94, 293.66, 392.00]; // G3, B3, D4, G4

          let freq = 0;
          if (step % 2 === 1) {
            const chordIdx = Math.floor(step / 4);
            const noteIdx = step % 4;
            if (chordIdx === 0) freq = melodyAm[noteIdx];
            else if (chordIdx === 1) freq = melodyF[noteIdx];
            else if (chordIdx === 2) freq = melodyC[noteIdx];
            else freq = melodyG[noteIdx];
          }

          if (freq > 0) {
            const melOsc = ctx.createOscillator();
            const melGain = ctx.createGain();
            melOsc.connect(melGain);
            melGain.connect(ctx.destination);
            melOsc.type = 'sine';
            melOsc.frequency.setValueAtTime(freq, ctx.currentTime);
            melGain.gain.setValueAtTime(0.035 * bgmVolume, ctx.currentTime); // Soft background lead level
            melGain.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.001 * bgmVolume), ctx.currentTime + 0.16);
            melOsc.start();
            melOsc.stop(ctx.currentTime + 0.16);
          }

          // Simple cute white noise hi-hat style click on main beats
          if (step % 4 === 0) {
            const clickOsc = ctx.createOscillator();
            const clickGain = ctx.createGain();
            clickOsc.connect(clickGain);
            clickGain.connect(ctx.destination);
            clickOsc.type = 'triangle';
            clickOsc.frequency.setValueAtTime(95, ctx.currentTime);
            clickOsc.frequency.exponentialRampToValueAtTime(8, ctx.currentTime + 0.05);
            clickGain.gain.setValueAtTime(0.045 * bgmVolume, ctx.currentTime);
            clickGain.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.001 * bgmVolume), ctx.currentTime + 0.05);
            clickOsc.start();
            clickOsc.stop(ctx.currentTime + 0.05);
          }
        } catch (e) {
          console.warn("BGM Synthesis warning: ", e);
        }
      };

      // Play immediately on load, then schedule intervals
      playBgmStep();
      intervalId = setInterval(playBgmStep, 180);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [gameState, soundEnabled, bgmVolume]);

  // Command handlers to start / reset gaming state
  const resetAndStartGame = () => {
    // Audio synthesis warmup
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      audioCtxRef.current.resume();
    } catch(e){}

    // Clear game stats
    setScore(0);
    localScoreRef.current = 0;
    totalEnemiesDefeatedRef.current = 0;
    pityCounterRef.current = 0;
    isPlayerDeadRef.current = false;
    playerDeathTimerRef.current = 0;
    isHighScoreTriggeredRef.current = false;
    setIsNewRecordInRankings(false);

    // Initial reset variables for player (resets all upgrade items as per combat specifications)
    playerRef.current = {
      x: 120,
      y: 270,
      width: 32,
      height: 24,
      speedLevel: 0,
      hasBarrier: false,
      backShotLevel: 0,
      frontMultiLevel: 0,
      wideShotLevel: 0,
      powerLevel: 1,
      rapidLevel: 0
    };

    // Clean active states arrays
    bulletsRef.current = [];
    enemiesRef.current = [];
    itemsRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    
    spawnTimerRef.current = 0;
    shootCooldownRef.current = 0;

    setGameState('PLAYING');
  };

  // Touch Virtual Joystick interactions Handlers
  const handleJoystickTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    joystickActive.current = true;
    joystickStart.current = { x: touch.clientX, y: touch.clientY };
    joystickCurrent.current = { x: touch.clientX, y: touch.clientY };
    joystickVector.current = { x: 0, y: 0 };
  };

  const handleJoystickTouchMove = (e: React.TouchEvent) => {
    if (!joystickActive.current) return;
    const touch = e.touches[0];
    joystickCurrent.current = { x: touch.clientX, y: touch.clientY };

    // Calculate delta polar offset
    const dx = joystickCurrent.current.x - joystickStart.current.x;
    const dy = joystickCurrent.current.y - joystickStart.current.y;
    const distance = Math.hypot(dx, dy);
    
    // Max visual thumb radius
    const maxRadius = 45;
    if (distance === 0) {
      joystickVector.current = { x: 0, y: 0 };
    } else {
      const scale = Math.min(distance * joystickSensitivity, maxRadius) / maxRadius;
      joystickVector.current = {
        x: (dx / distance) * scale,
        y: (dy / distance) * scale
      };
    }
  };

  const handleJoystickTouchEnd = () => {
    joystickActive.current = false;
    joystickVector.current = { x: 0, y: 0 };
  };

  // Mouse emulation for Joystick (supports desktop debug and drag)
  const handleJoystickMouseDown = (e: React.MouseEvent) => {
    joystickActive.current = true;
    joystickStart.current = { x: e.clientX, y: e.clientY };
    joystickCurrent.current = { x: e.clientX, y: e.clientY };
    joystickVector.current = { x: 0, y: 0 };
  };

  const handleJoystickMouseMove = (e: React.MouseEvent) => {
    if (!joystickActive.current) return;
    joystickCurrent.current = { x: e.clientX, y: e.clientY };

    const dx = joystickCurrent.current.x - joystickStart.current.x;
    const dy = joystickCurrent.current.y - joystickStart.current.y;
    const distance = Math.hypot(dx, dy);
    
    const maxRadius = 45;
    if (distance === 0) {
      joystickVector.current = { x: 0, y: 0 };
    } else {
      const scale = Math.min(distance * joystickSensitivity, maxRadius) / maxRadius;
      joystickVector.current = {
        x: (dx / distance) * scale,
        y: (dy / distance) * scale
      };
    }
  };

  const handleJoystickMouseUp = () => {
    joystickActive.current = false;
    joystickVector.current = { x: 0, y: 0 };
  };

  // Render the Virtual Joystick visual knob
  const getJoystickKnobStyle = () => {
    if (!joystickActive.current) return { transform: 'translate(0px, 0px)' };
    const dx = joystickCurrent.current.x - joystickStart.current.x;
    const dy = joystickCurrent.current.y - joystickStart.current.y;
    const distance = Math.hypot(dx, dy);
    const maxRadius = 40;
    const ratio = distance > maxRadius ? maxRadius / distance : 1;
    return {
      transform: `translate(${dx * ratio}px, ${dy * ratio}px)`
    };
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white font-sans px-4 select-none">
      
      {/* Outer Dashboard Header Title */}
      <header className="mb-4 text-center">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent flex items-center justify-center gap-2">
          <Crosshair className="w-6 h-6 text-cyan-400 animate-spin-slow" />
          <span>SPACE SHOOTER</span>
        </h1>
        <p className="text-zinc-500 text-xs mt-1 font-mono uppercase tracking-widest">
          Arcade Specification Engine
        </p>
      </header>

      {/* Main Responsive Game View Box container */}
      <div 
        ref={containerRef}
        id="game-container" 
        className="relative overflow-hidden aspect-video bg-black rounded-2xl border-4 border-zinc-900 shadow-2xl w-full max-w-4xl"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          className="block w-full h-full object-contain"
        />

        {/* --- HIGH SCORE ACTION ALERT OVERLAY (In Game Highlight) --- */}
        <AnimatePresence>
          {showNewHighScoreAlert && (
            <motion.div 
              initial={{ scale: 0.6, opacity: 0, y: -40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 1.4, opacity: 0, y: -80 }}
              className="absolute left-0 right-0 top-16 mx-auto w-fit bg-amber-500/15 border border-amber-400 text-amber-300 font-extrabold px-6 py-2.5 rounded-full shadow-lg shadow-amber-950/25 flex items-center gap-2"
            >
              <Crown className="w-5 h-5 text-amber-400 animate-bounce" />
              <span className="font-sans text-sm tracking-widest uppercase">HIGH SCORE REACHED!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- 1. START MENU OVERLAY STYLE --- */}
        <AnimatePresence>
          {gameState === 'START' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/95 flex flex-col justify-between p-4 md:p-6 text-left overflow-y-auto"
            >
              {/* Menu Header info */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-cyan-400 text-[10px] md:text-xs font-mono uppercase tracking-widest">SPECS COMPLIANT GAME CREATION</span>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mt-0.5">
                    宇宙シューティング
                  </h2>
                </div>
                
                {/* Visual score display right side */}
                <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-right">
                  <div className="text-zinc-500 text-[9px] font-mono">CURRENT TERM HIGHSCORE</div>
                  <div className="text-amber-400 font-extrabold text-base flex items-center justify-end gap-1.5 mt-0.5">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span>{highScore} pts</span>
                  </div>
                </div>
              </div>

              {/* Game Manual Instructions block */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-1">
                <div className="bg-slate-900/45 border border-slate-800/60 p-3.5 rounded-xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-cyan-400 font-bold text-xs md:text-sm uppercase tracking-widest flex items-center gap-1.5 mb-2">
                      <Smartphone className="w-4 h-4" />
                      <span>操作マニュアル (Controls)</span>
                    </h3>
                    <ul className="space-y-1.5 text-zinc-300 text-[11px] leading-relaxed">
                      <li className="flex items-center gap-1.5">
                        <span className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono text-[9px]">W A S D</span>
                        <span>or</span>
                        <span className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono text-[9px]">↑ ↓ ← →</span>
                        <span className="text-zinc-400">： 機体移動</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded font-mono text-[9px]">Space</span>
                        <span>or</span>
                        <span className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono text-[9px]">Z</span>
                        <span className="text-zinc-400">： レーザー弾発射 (長押し連射)</span>
                      </li>
                      <li className="text-zinc-400 pt-1 border-t border-slate-800/80">
                        📱 スマートフォンでは画面左の<strong>仮想十字パッド</strong>と右の<strong>発射ボタン</strong>で快適に操作可能。
                      </li>
                    </ul>
                  </div>

                  {/* Toggle Mobile Preview simulation bar & Pad Sensitivity / Volume adjustments */}
                  <div className="mt-2.5 flex flex-col gap-2 border-t border-slate-800/50 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <button 
                        onClick={() => setShowVirtualControls(!showVirtualControls)} 
                        className={`px-2.5 py-1 text-[11px] rounded-lg transition-all flex items-center gap-1.5 font-mono ${
                          showVirtualControls 
                            ? 'bg-indigo-500/20 border border-indigo-400/50 text-indigo-300' 
                            : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Smartphone className="w-3 h-3" />
                        <span>バーチャルパッド：{showVirtualControls ? 'ON (常時表示)' : 'OFF (自動検知)'}</span>
                      </button>

                      <div className="flex-1 max-w-[150px] w-full">
                        <div className="flex justify-between text-[10px] text-zinc-400 mb-0.5 font-mono">
                          <span>パッド感度:</span>
                          <span className="text-cyan-400 font-bold">{Math.round(joystickSensitivity * 100)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.5" 
                          max="2.5" 
                          step="0.1" 
                          value={joystickSensitivity}
                          onChange={(e) => handleSensitivityChange(parseFloat(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-800/30 pt-1.5">
                      <div className="text-[10px] text-zinc-400 mb-1 font-mono flex justify-between">
                        <span>ゲーム難易度 (Difficulty):</span>
                        <span className={`font-bold uppercase ${
                          difficulty === 'EASY' ? 'text-emerald-400' : difficulty === 'HARD' ? 'text-rose-400' : 'text-indigo-400'
                        }`}>
                          {difficulty === 'EASY' ? 'イージー' : difficulty === 'HARD' ? 'ハード' : 'ノーマル'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['EASY', 'NORMAL', 'HARD'] as const).map((diff) => (
                          <button
                            key={diff}
                            onClick={() => handleDifficultyChange(diff)}
                            className={`py-1 text-[10px] rounded-lg transition-all font-bold font-mono border ${
                              difficulty === diff
                                ? diff === 'EASY'
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.12)]'
                                  : diff === 'HARD'
                                  ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.12)]'
                                  : 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-[0_0_8px_rgba(99,102,241,0.12)]'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                            }`}
                          >
                            {diff === 'EASY' ? 'EASY' : diff === 'HARD' ? 'HARD' : 'NORMAL'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-0.5 border-t border-slate-800/30 pt-1.5">
                      <div>
                        <div className="flex justify-between text-[10px] text-zinc-400 mb-0.5 font-mono">
                          <span>BGM音量:</span>
                          <span className="text-indigo-400 font-bold">{Math.round(bgmVolume * 100)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.0" 
                          max="1.0" 
                          step="0.05" 
                          value={bgmVolume}
                          onChange={(e) => handleBgmVolumeChange(parseFloat(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-zinc-400 mb-0.5 font-mono">
                          <span>効果音 (SE):</span>
                          <span className="text-emerald-400 font-bold">{Math.round(sfxVolume * 100)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.0" 
                          max="1.0" 
                          step="0.05" 
                          value={sfxVolume}
                          onChange={(e) => handleSfxVolumeChange(parseFloat(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upgrades explanations block */}
                <div className="bg-slate-900/45 border border-slate-800/60 p-3.5 rounded-xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-emerald-400 font-bold text-xs md:text-sm uppercase tracking-widest flex items-center gap-1.5 mb-2">
                      <Zap className="w-4 h-4" />
                      <span>強化アイテム (Items)</span>
                    </h3>
                    <div className="grid grid-cols-7 gap-1 text-center text-[8px] md:text-[8.5px]">
                      <div className="bg-zinc-950/70 p-1 rounded border border-yellow-500/20">
                        <span className="inline-block bg-yellow-400 text-black font-extrabold w-4 h-4 rounded-full leading-4 text-center text-[10px] mb-1">S</span>
                        <p className="font-bold text-zinc-300">スピード</p>
                        <p className="text-zinc-500 text-[7px] mt-0.5">最大5</p>
                      </div>
                      <div className="bg-zinc-950/70 p-1 rounded border border-sky-500/20">
                        <span className="inline-block bg-sky-400 text-black font-extrabold w-4 h-4 rounded-full leading-4 text-center text-[10px] mb-1">B</span>
                        <p className="font-bold text-zinc-300">バリア</p>
                        <p className="text-zinc-500 text-[7px] mt-0.5">防弾1回</p>
                      </div>
                      <div className="bg-zinc-950/70 p-1 rounded border border-rose-500/20">
                        <span className="inline-block bg-rose-400 text-black font-extrabold w-4 h-4 rounded-full leading-4 text-center text-[10px] mb-1">R</span>
                        <p className="font-bold text-zinc-300">後方</p>
                        <p className="text-zinc-500 text-[7px] mt-0.5">最大2段階</p>
                      </div>
                      <div className="bg-zinc-950/70 p-1 rounded border border-emerald-500/20">
                        <span className="inline-block bg-emerald-400 text-black font-extrabold w-4 h-4 rounded-full leading-4 text-center text-[10px] mb-1">F</span>
                        <p className="font-bold text-zinc-300">前方弾</p>
                        <p className="text-zinc-500 text-[7px] mt-0.5">最大3連</p>
                      </div>
                      <div className="bg-zinc-950/70 p-1 rounded border border-purple-500/20">
                        <span className="inline-block bg-purple-400 text-black font-extrabold w-4 h-4 rounded-full leading-4 text-center text-[10px] mb-1">W</span>
                        <p className="font-bold text-zinc-300">ワイド</p>
                        <p className="text-zinc-500 text-[7px] mt-0.5">斜め弾</p>
                      </div>
                      <div className="bg-zinc-950/70 p-1 rounded border border-orange-500/20">
                        <span className="inline-block bg-orange-500 text-white font-extrabold w-4 h-4 rounded-full leading-4 text-center text-[10px] mb-1">T</span>
                        <p className="font-bold text-orange-400">連射</p>
                        <p className="text-zinc-500 text-[7px] mt-0.5">最大3段階</p>
                      </div>
                      <div className="bg-zinc-950/70 p-1 rounded border border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.1)]">
                        <span className="inline-block bg-red-500 text-white font-extrabold w-4 h-4 rounded-full leading-4 text-center text-[10px] mb-1">P</span>
                        <p className="font-bold text-red-400">攻撃力</p>
                        <p className="text-red-500/80 text-[7px] mt-0.5 font-bold">超激レア</p>
                      </div>
                    </div>
                    <div className="text-[9px] text-zinc-400 mt-2 bg-slate-900/80 px-2 py-1 rounded italic leading-relaxed">
                      ※ 敵撃破でアイテムが出現！更に約3%の超低確率で超強力な攻撃力アップ(P)をドロップします。
                    </div>
                  </div>
                  
                  <div className="text-[9.5px] text-zinc-500 mt-2 bg-slate-950/40 p-2 border border-slate-900 rounded leading-relaxed">
                    <p className="font-bold text-zinc-400">🔥 ゲームのコツ:</p>
                    バリア(B)や連射(T)を維持・強化しながら、後方射撃(R)やワイド(W)で画面全体の敵をカバーし、弾数(F)を増やして火力を上げるのがハイスコアへの近道です。
                  </div>
                </div>
              </div>

              {/* Start game footer trigger button */}
              <div className="flex items-center justify-between gap-4 border-t border-slate-900 pt-3 mt-1">
                <div className="text-zinc-500 text-[10px] font-mono flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-zinc-500" />
                  <span>敵は耐久度の異なる3種類。強敵ほど高配点です。</span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Sound controls toggles */}
                  <button 
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all"
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={resetAndStartGame}
                    className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-950/60 hover:shadow-cyan-500/30 transition-all flex items-center gap-2 transform active:scale-95 cursor-pointer text-xs md:text-sm tracking-widest"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>ゲーム開始</span>
                  </button>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* --- 2. GAME OVER LAYOUT OVERLAY --- */}
        <AnimatePresence>
          {gameState === 'GAMEOVER' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/95 flex flex-col justify-between p-6 md:p-8"
            >
              
              {/* Header result values */}
              <div className="text-center pt-2">
                <span className="text-red-500 text-xs md:text-sm font-mono uppercase tracking-widest block font-bold">
                  SYSTEM SHUTDOWN - DESTROYED
                </span>
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-normal text-slate-100">
                  ゲームオーバー
                </h2>
              </div>

              {/* Layout for score results & rankings */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 my-auto max-w-2xl w-full mx-auto">
                
                {/* Score results card */}
                <div className="md:col-span-5 bg-zinc-900/80 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-center items-center text-center relative overflow-hidden">
                  
                  {isNewRecordInRankings && (
                    <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-yellow-600 px-3 py-1 text-[9px] font-bold text-slate-950 rounded-bl-xl tracking-widest font-mono">
                      NEW HIGHLIGHT
                    </div>
                  )}

                  <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">YOUR SCORE</span>
                  <span className="text-4xl md:text-5xl font-black text-white mt-1 select-all font-sans leading-none">
                    {score}
                  </span>
                  
                  <div className="mt-4 border-t border-zinc-800 pt-3 w-full text-center">
                    <span className="text-zinc-500 text-[10px] font-mono">TOTAL ENEMIES DEFEATED: </span>
                    <span className="text-emerald-400 font-bold text-sm block mt-0.5 font-mono">{totalEnemiesDefeatedRef.current} 機撃破</span>
                  </div>
                </div>

                {/* Leaders rankings board */}
                <div className="md:col-span-7 bg-slate-900/50 border border-slate-800/80 p-4 rounded-2xl">
                  <h3 className="text-zinc-400 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5 mb-3">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>同じ端末の最高ランキング (TOP 3)</span>
                  </h3>
                  
                  <div className="space-y-2">
                    {rankings.map((rec, idx) => {
                      // Styling for medals
                      let rowStyle = "bg-zinc-950/60 border-zinc-900";
                      let medalStyle = "text-zinc-400 border-zinc-800";
                      let rankLabel = `${idx + 1}`;

                      if (idx === 0) {
                        rowStyle = "bg-amber-500/5 border-amber-500/20";
                        medalStyle = "bg-amber-400 text-slate-950 hover:scale-105 border-amber-300";
                        rankLabel = "👑";
                      } else if (idx === 1) {
                        rowStyle = "bg-slate-300/5 border-slate-400/20";
                        medalStyle = "bg-slate-400 text-slate-950 border-slate-300";
                      } else if (idx === 2) {
                        rowStyle = "bg-orange-600/5 border-orange-500/20";
                        medalStyle = "bg-amber-700 text-white border-amber-600";
                      }

                      if (rec.isNew) {
                        rowStyle += " ring-2 ring-cyan-500/50 ring-offset-2 ring-offset-slate-950";
                      }

                      return (
                        <div 
                          key={idx} 
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${rowStyle}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded-lg text-xs font-bold border flex items-center justify-center ${medalStyle}`}>
                              {rankLabel}
                            </span>
                            <div>
                              <p className="text-white font-bold font-sans text-sm">{rec.score} <span className="text-xs font-normal text-zinc-400">pts</span></p>
                              <p className="text-[10px] text-zinc-500 font-mono">{rec.date}</p>
                            </div>
                          </div>

                          {rec.isNew && (
                            <span className="bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[8.5px] px-2 py-0.5 rounded font-mono font-bold animate-pulse">
                              NEW REC
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Game Over Actions triggers */}
              <div className="flex justify-between items-center border-t border-slate-900 pt-4">
                <button
                  onClick={() => setGameState('START')}
                  className="px-5 py-3 bg-zinc-910 border border-zinc-800 font-bold hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Award className="w-4 h-4" />
                  <span>タイトルに戻る</span>
                </button>

                <button
                  onClick={resetAndStartGame}
                  className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-extrabold rounded-xl shadow-lg shadow-emerald-950/20 hover:shadow-emerald-400/25 transition-all flex items-center gap-2 transform active:scale-95 cursor-pointer text-sm"
                >
                  <RotateCcw className="w-5 h-5 text-slate-950" />
                  <span>再プレイする (リトライ)</span>
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* --- 3. VIRTUAL CONTROLLER OVERLAY FOR MOBILE / TOUCH PREVIEW --- */}
        {gameState === 'PLAYING' && showVirtualControls && (
          <div className="absolute inset-0 pointer-events-none select-none">
            
            {/* Joystick touchpad on the bottom left corner */}
            <div 
              className="absolute left-6 bottom-6 w-32 h-32 rounded-full border border-cyan-400/25 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center pointer-events-auto cursor-grab"
              onTouchStart={handleJoystickTouchStart}
              onTouchMove={handleJoystickTouchMove}
              onTouchEnd={handleJoystickTouchEnd}
              onMouseDown={handleJoystickMouseDown}
              onMouseMove={handleJoystickMouseMove}
              onMouseUp={handleJoystickMouseUp}
              onMouseLeave={handleJoystickMouseUp}
              style={{ touchAction: 'none' }}
            >
              <div className="w-16 h-16 rounded-full border border-cyan-500/50 bg-cyan-950/40 relative flex items-center justify-center">
                {/* Thumb Stick visual knob */}
                <div 
                  className="w-10 h-10 rounded-full bg-cyan-400/90 shadow-lg shadow-cyan-500/50 transition-transform duration-0"
                  style={getJoystickKnobStyle()}
                />
              </div>
            </div>

            {/* Shoot Action trigger button on the bottom right corner */}
            <div className="absolute right-8 bottom-8 pointer-events-auto">
              <button
                onTouchStart={() => { touchShotActive.current = true; }}
                onTouchEnd={() => { touchShotActive.current = false; }}
                onMouseDown={() => { touchShotActive.current = true; }}
                onMouseUp={() => { touchShotActive.current = false; }}
                onMouseLeave={() => { touchShotActive.current = false; }}
                className="w-20 h-20 rounded-full bg-gradient-to-tr from-rose-600 to-orange-500 active:from-rose-500 active:to-orange-400 text-white font-extrabold text-sm border-2 border-rose-400/50 shadow-xl shadow-rose-950/60 flex items-center justify-center scale-100 hover:scale-105 active:scale-90 transition-all font-mono tracking-widest select-none cursor-pointer"
                style={{ touchAction: 'none' }}
              >
                FIRE
              </button>
            </div>

            {/* Quick Virtual controller toggle view */}
            <button 
              onClick={() => setShowVirtualControls(false)} 
              className="absolute right-4 top-14 pointer-events-auto bg-slate-950/80 border border-slate-800 text-[10px] text-zinc-400 px-2 py-1 rounded hover:text-white"
            >
              コントローラー非表示
            </button>
          </div>
        )}

        {/* Quick action: Show touch pad overlay manual trigger if hidden during game */}
        {gameState === 'PLAYING' && !showVirtualControls && (
          <div className="absolute right-4 top-14 pointer-events-auto select-none">
            <button 
              onClick={() => setShowVirtualControls(true)} 
              className="bg-slate-950/50 hover:bg-slate-950 border border-slate-800 text-[10px] text-zinc-400 px-2.5 py-1.5 rounded-lg hover:text-white flex items-center gap-1 leading-none font-mono"
            >
              <Smartphone className="w-3 h-3" />
              <span>バーチャルパッドを表示</span>
            </button>
          </div>
        )}

      </div>

      {/* Decorative Arcade Machine base labels */}
      <footer className="mt-4 text-center max-w-sm">
        <p className="text-[10px] text-zinc-600 font-mono">
          2D SPACE SHOOTER ENGINE v1.1.0 // NO EXTERNAL ASSETS REQUIRED // WEB AUDIO SINE CHIPS // LOCALSTORAGE COMPACT DB
        </p>
      </footer>

    </div>
  );
}
