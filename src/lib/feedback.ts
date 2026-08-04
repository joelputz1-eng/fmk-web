'use client';

import type { Verdict } from '@/lib/db/schema';

/**
 * Feedback (1.7). Web kann nur navigator.vibrate() (faktisch Android Chrome) —
 * feature-detected, best effort. Sound ueber WebAudio-Toene, damit keine
 * Audio-Assets noetig sind.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) audioContext = new Ctor();
  // Browser starten den Context suspendiert, bis eine Nutzergeste kam.
  if (audioContext.state === 'suspended') void audioContext.resume();
  return audioContext;
}

function tone(frequency: number, durationMs: number, type: OscillatorType = 'sine'): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;

  const now = ctx.currentTime;
  const duration = durationMs / 1000;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(pattern);
}

export interface FeedbackOptions {
  sound: boolean;
  haptics: boolean;
}

const VERDICT_TONES: Record<Verdict, { frequency: number; type: OscillatorType; pattern: number[] }> = {
  fuck: { frequency: 660, type: 'triangle', pattern: [18] },
  marry: { frequency: 880, type: 'sine', pattern: [12, 40, 12] },
  kill: { frequency: 180, type: 'sawtooth', pattern: [40] },
};

export function feedbackForVerdict(verdict: Verdict, options: FeedbackOptions): void {
  const config = VERDICT_TONES[verdict];
  if (options.sound) tone(config.frequency, 140, config.type);
  if (options.haptics) vibrate(config.pattern);
}

export function feedbackRoundComplete(options: FeedbackOptions): void {
  if (options.sound) {
    tone(523, 120);
    setTimeout(() => tone(784, 220), 110);
  }
  if (options.haptics) vibrate([20, 50, 30]);
}

export function feedbackUndo(options: FeedbackOptions): void {
  if (options.sound) tone(320, 90, 'square');
  if (options.haptics) vibrate(10);
}
