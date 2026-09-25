"use client";

/*
 * HoldButton, vendored from React Bits (reactbits.dev, HoldButton-TS-TW) via
 * the shadcn MCP registry. Local changes: the upstream `hb-` class and
 * custom-property prefix is renamed `hold-` (it collided with this app's own
 * `hb-` namespace), and the defaults are the app's destructive style (danger
 * fill on a tinted base, a 1.2 s hold, no glow). Its animation frame loop
 * runs only while a press is held or releasing.
 */
import React, { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { haptic } from '@/lib/haptics';

export type HoldButtonSize = 'sm' | 'md' | 'lg';
export type HoldButtonDirection = 'right' | 'up';

export interface HoldButtonProps {
  children?: ReactNode;
  doneLabel?: ReactNode;
  icon?: ReactNode;
  doneIcon?: ReactNode;
  backgroundColor?: string;
  fillColor?: string;
  textColor?: string;
  fillTextColor?: string;
  size?: HoldButtonSize;
  radius?: number;
  fillDirection?: HoldButtonDirection;
  holdTime?: number;
  releaseTime?: number;
  pressScale?: number;
  wave?: boolean;
  waveAmplitude?: number;
  glow?: boolean;
  resetAfter?: number;
  disabled?: boolean;
  onHold?: () => void;
  onTap?: () => void;
  className?: string;
}

type Phase = 'idle' | 'holding' | 'done';
type Input = 'pointer' | 'key' | null;

interface Motion {
  raf: number;
  p: number;
  from: number;
  to: number;
  start: number;
}

interface Gesture {
  pointerId: number | null;
  start: number;
  rect: DOMRect | null;
}

interface ReleaseOptions {
  drifted?: boolean;
}

const TAP_MS = 250;
/** Clock for gesture timing. Only ever called from event handlers and frames. */
const now = () => performance.now();
const HIT_PAD = 10;
const LINEAR = (t: number) => t;
const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);

const SIZES: Record<HoldButtonSize, string> = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-[22px] text-[15px]',
  lg: 'h-[52px] px-7 text-[17px]'
};

const GLOW = 'inset_0_1px_0_rgba(255,255,255,0.06),0_10px_32px_-6px_color-mix(in_srgb,var(--hold-fill)_70%,transparent)';

const LABEL_SPAN =
  '[grid-area:1/1] inline-flex items-center gap-2 whitespace-nowrap [transition:opacity_200ms_ease,filter_200ms_ease]';

const STYLE = `
.hold-root{--hold-w:0px;--hold-h:0px;--hold-cycles:2;--hold-p:0}
.hold-fill{clip-path:inset(0 calc((1 - var(--hold-p)) * (100% + 0.75 * var(--hold-wave)) - var(--hold-p) * 0.25 * var(--hold-wave)) 0 0)}
.hold-root[data-direction=up] .hold-fill{clip-path:inset(calc((1 - var(--hold-p)) * (100% + 0.75 * var(--hold-wave)) - var(--hold-p) * 0.25 * var(--hold-wave)) 0 0 0)}
.hold-crest{-webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='200' viewBox='0 0 20 200' preserveAspectRatio='none'%3E%3Cpath d='M0 0H10C18 8 18 25.3 10 33.3S2 58.7 10 66.7S18 92 10 100S2 125.3 10 133.3S18 158.7 10 166.7S2 192 10 200H0Z'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='200' viewBox='0 0 20 200' preserveAspectRatio='none'%3E%3Cpath d='M0 0H10C18 8 18 25.3 10 33.3S2 58.7 10 66.7S18 92 10 100S2 125.3 10 133.3S18 158.7 10 166.7S2 192 10 200H0Z'/%3E%3C/svg%3E");-webkit-mask-repeat:repeat-y;mask-repeat:repeat-y;-webkit-mask-size:var(--hold-wave) calc(var(--hold-h) * 2);mask-size:var(--hold-wave) calc(var(--hold-h) * 2);-webkit-mask-position-x:calc(-1 * var(--hold-wave) + var(--hold-p) * (var(--hold-w) + var(--hold-wave)));mask-position-x:calc(-1 * var(--hold-wave) + var(--hold-p) * (var(--hold-w) + var(--hold-wave)));-webkit-mask-position-y:calc(-1 * var(--hold-p) * var(--hold-cycles) * var(--hold-h));mask-position-y:calc(-1 * var(--hold-p) * var(--hold-cycles) * var(--hold-h))}
.hold-root[data-direction=up] .hold-crest{-webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='20' viewBox='0 0 200 20' preserveAspectRatio='none'%3E%3Cpath d='M0 20V10C12 2 38 2 50 10S88 18 100 10S138 2 150 10S188 18 200 10V20Z'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='20' viewBox='0 0 200 20' preserveAspectRatio='none'%3E%3Cpath d='M0 20V10C12 2 38 2 50 10S88 18 100 10S138 2 150 10S188 18 200 10V20Z'/%3E%3C/svg%3E");-webkit-mask-repeat:repeat-x;mask-repeat:repeat-x;-webkit-mask-size:calc(var(--hold-w) * 2) var(--hold-wave);mask-size:calc(var(--hold-w) * 2) var(--hold-wave);-webkit-mask-position-x:calc(-1 * var(--hold-p) * var(--hold-cycles) * var(--hold-w));mask-position-x:calc(-1 * var(--hold-p) * var(--hold-cycles) * var(--hold-w));-webkit-mask-position-y:calc(var(--hold-h) - var(--hold-p) * (var(--hold-h) + var(--hold-wave)));mask-position-y:calc(var(--hold-h) - var(--hold-p) * (var(--hold-h) + var(--hold-wave)))}
@keyframes hold-pulse{from{opacity:1;box-shadow:0 0 0 0 color-mix(in srgb,var(--hold-fill) 55%,transparent)}to{opacity:0;box-shadow:0 0 0 14px color-mix(in srgb,var(--hold-fill) 0%,transparent)}}
@media (prefers-reduced-motion:reduce){
.hold-root{transform:none!important;transition:background-color 160ms ease,box-shadow var(--hold-release) ease!important}
.hold-fill{clip-path:inset(0)!important;opacity:0;transition:opacity var(--hold-release) ease!important}
.hold-crest{display:none}
.hold-root[data-phase=holding] .hold-fill,.hold-root[data-phase=done] .hold-fill{opacity:1;transition:opacity var(--hold-hold) linear!important}
.hold-pulse{animation:none!important}
.hold-label>span{filter:none!important;transition:opacity 200ms ease!important}
}`;

const HoldButton: React.FC<HoldButtonProps> = ({
  children = 'Hold to delete',
  doneLabel = 'Deleted',
  icon = null,
  doneIcon = null,
  backgroundColor = 'rgb(239 83 80 / 0.12)',
  fillColor = '#ef5350',
  textColor = '#ef5350',
  fillTextColor = '#000000',
  size = 'md',
  radius = 14,
  fillDirection = 'right',
  holdTime = 1200,
  releaseTime = 200,
  pressScale = 0.97,
  wave = true,
  waveAmplitude = 4,
  glow = false,
  resetAfter = 1200,
  disabled = false,
  onHold,
  onTap,
  className = ''
}) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [input, setInput] = useState<Input>(null);
  const phaseRef = useRef<Phase>('idle');
  const inputRef = useRef<Input>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const gesture = useRef<Gesture>({ pointerId: null, start: 0, rect: null });
  const timers = useRef({ complete: 0, reset: 0 });
  const hintId = useId();

  const go = (next: Phase, kind: Input = null) => {
    phaseRef.current = next;
    inputRef.current = kind;
    setPhase(next);
    setInput(kind);
  };

  const clearTimers = () => {
    clearTimeout(timers.current.complete);
    clearTimeout(timers.current.reset);
  };

  const motion = useRef<Motion>({ raf: 0, p: 0, from: 0, to: 0, start: 0 });
  const drive = (to: number, duration: number, ease: (t: number) => number) => {
    const m = motion.current;
    cancelAnimationFrame(m.raf);
    m.from = m.p;
    m.to = to;
    m.start = now();
    const step = (now: number) => {
      const t = duration > 0 ? Math.min(1, (now - m.start) / duration) : 1;
      m.p = m.from + (m.to - m.from) * ease(t);
      buttonRef.current?.style.setProperty('--hold-p', m.p.toFixed(4));
      if (t < 1) {
        m.raf = requestAnimationFrame(step);
        return;
      }
      m.raf = 0;
      if (m.to === 1) complete();
    };
    m.raf = requestAnimationFrame(step);
  };

  const complete = () => {
    if (phaseRef.current !== 'holding') return;
    if (now() - gesture.current.start < holdTime - 50) return;
    clearTimers();
    go('done', inputRef.current);
    // Destructive by default in this app: the system's warning knock (iOS app).
    haptic('warning');
    onHold?.();
    if (resetAfter > 0) {
      timers.current.reset = window.setTimeout(() => {
        go('idle');
        drive(0, releaseTime, EASE_OUT);
      }, resetAfter);
    }
  };

  const begin = (kind: Input) => {
    if (disabled || phaseRef.current !== 'idle') return false;
    const button = buttonRef.current;
    if (!button) return false;
    gesture.current.start = now();
    gesture.current.rect = button.getBoundingClientRect();
    go('holding', kind);
    drive(1, holdTime, LINEAR);
    timers.current.complete = window.setTimeout(complete, holdTime + 100);
    return true;
  };

  const release = ({ drifted = false }: ReleaseOptions = {}) => {
    if (phaseRef.current !== 'holding') return;
    clearTimers();
    const held = now() - gesture.current.start;
    go('idle');
    drive(0, releaseTime, EASE_OUT);
    if (!drifted && held < TAP_MS) onTap?.();
  };
  const releaseRef = useRef(release);
  useEffect(() => {
    releaseRef.current = release;
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !e.isPrimary || gesture.current.pointerId !== null) return;
    if (!begin('pointer')) return;
    gesture.current.pointerId = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const endPointer = (e: React.PointerEvent<HTMLButtonElement>, options?: ReleaseOptions) => {
    if (e.pointerId !== gesture.current.pointerId) return;
    gesture.current.pointerId = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    release(options);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerId !== gesture.current.pointerId) return;
    const r = gesture.current.rect;
    if (!r) return;
    const out =
      e.clientX < r.left - HIT_PAD ||
      e.clientX > r.right + HIT_PAD ||
      e.clientY < r.top - HIT_PAD ||
      e.clientY > r.bottom + HIT_PAD;
    if (out) endPointer(e, { drifted: true });
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'touch') endPointer(e, { drifted: true });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape') {
      if (inputRef.current === 'key') release({ drifted: true });
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) begin('key');
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (inputRef.current === 'key') release();
    }
  };

  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button) return undefined;
    const measure = () => {
      button.style.setProperty('--hold-w', `${button.offsetWidth}px`);
      button.style.setProperty('--hold-h', `${button.offsetHeight}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(button);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (phase !== 'holding') return undefined;
    const cancel = () => releaseRef.current({ drifted: true });
    const onVisibility = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [phase]);

  useEffect(() => {
    const t = timers.current;
    const m = motion.current;
    return () => {
      clearTimeout(t.complete);
      clearTimeout(t.reset);
      cancelAnimationFrame(m.raf);
    };
  }, []);

  const direction: HoldButtonDirection = fillDirection === 'up' ? 'up' : 'right';
  const labels = (
    <>
      <span
        className={`${LABEL_SPAN} group-data-[phase=done]:opacity-0 group-data-[phase=done]:blur-[2px]`}
        aria-hidden={phase === 'done'}
      >
        {icon ? <span className="inline-flex flex-none [&>svg]:block">{icon}</span> : null}
        {children}
      </span>
      <span
        className={`${LABEL_SPAN} opacity-0 blur-[2px] group-data-[phase=done]:opacity-100 group-data-[phase=done]:blur-0`}
        aria-hidden={phase !== 'done'}
      >
        {doneIcon ? <span className="inline-flex flex-none [&>svg]:block">{doneIcon}</span> : null}
        {doneLabel}
      </span>
    </>
  );

  const cssVars = {
    '--hold-radius': `${radius}px`,
    '--hold-bg': backgroundColor,
    '--hold-fill': fillColor,
    '--hold-text': textColor,
    '--hold-fill-text': fillTextColor,
    '--hold-hold': `${holdTime}ms`,
    '--hold-cycles': holdTime / 1100,
    '--hold-release': `${releaseTime}ms`,
    '--hold-press': pressScale,
    '--hold-wave': `${wave ? waveAmplitude : 0}px`,
    '--hold-ease-out': 'cubic-bezier(0.23, 1, 0.32, 1)'
  } as CSSProperties;

  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      className={`hold-root group relative isolate m-0 inline-grid cursor-pointer touch-manipulation select-none place-items-center border-0 font-medium leading-none tracking-[0.01em] outline-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [background:var(--hold-bg)] [border-radius:var(--hold-radius)] [color:var(--hold-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] [transition:transform_160ms_var(--hold-ease-out),background-color_160ms_ease,box-shadow_var(--hold-release)_var(--hold-ease-out)] [@media(hover:hover)_and_(pointer:fine)]:enabled:hover:[background:color-mix(in_srgb,var(--hold-bg)_92%,#fff)] data-[phase=holding]:data-[input=pointer]:[transform:scale(var(--hold-press))] data-[glow=true]:data-[phase=holding]:shadow-[${GLOW}] data-[glow=true]:data-[phase=done]:shadow-[${GLOW}] data-[glow=true]:data-[phase=holding]:[transition:transform_160ms_var(--hold-ease-out),background-color_160ms_ease,box-shadow_var(--hold-hold)_linear] focus-visible:[outline:2px_solid_var(--hold-fill)] focus-visible:outline-offset-[3px] disabled:pointer-events-none disabled:cursor-default disabled:opacity-50 contrast-more:[outline:1px_solid_var(--hold-text)] ${SIZES[size] || SIZES.md}${className ? ` ${className}` : ''}`}
      data-phase={phase}
      data-input={input ?? undefined}
      data-direction={direction}
      data-glow={glow ? 'true' : undefined}
      aria-describedby={hintId}
      style={cssVars}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={e => endPointer(e)}
      onPointerCancel={e => endPointer(e, { drifted: true })}
      onLostPointerCapture={e => endPointer(e, { drifted: true })}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onContextMenu={e => e.preventDefault()}
    >
      <style>{STYLE}</style>
      <span
        className="hold-pulse pointer-events-none absolute inset-0 z-0 opacity-0 [border-radius:var(--hold-radius)] group-data-[glow=true]:group-data-[phase=done]:[animation:hold-pulse_600ms_var(--hold-ease-out)_forwards]"
        aria-hidden="true"
      />
      <span className="hold-label relative z-[2] grid place-items-center">{labels}</span>
      <span
        className="pointer-events-none absolute inset-0 z-[3] [clip-path:inset(0_round_var(--hold-radius))]"
        aria-hidden="true"
      >
        <span className="hold-fill absolute inset-0 grid place-items-center [background:var(--hold-fill)] [color:var(--hold-fill-text)]">
          <span className="hold-label grid place-items-center">{labels}</span>
        </span>
        <span className="hold-crest absolute inset-0 grid place-items-center [background:var(--hold-fill)] [color:var(--hold-fill-text)]">
          <span className="hold-label grid place-items-center">{labels}</span>
        </span>
      </span>
      <span id={hintId} className="absolute h-px w-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]">
        Press and hold for {Math.round(holdTime / 100) / 10} seconds to confirm
      </span>
    </button>
  );
};

export default HoldButton;
