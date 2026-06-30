import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType, PointerEvent as ReactPointerEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { House, Megaphone, ShoppingBag, UserRound } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

type IconComponent = ComponentType<{ className?: string; strokeWidth?: number; fill?: string }>;

export type LiquidGlassNavItem = {
  id: string;
  label: string;
  Icon: IconComponent;
  to?: string;
  disabled?: boolean;
  match?: (pathname: string, search: string) => boolean;
};

type IPhoneLiquidGlassNavProps = {
  items?: LiquidGlassNavItem[];
  activeId?: string;
  defaultActiveId?: string;
  iPhoneOnly?: boolean;
  onActiveChange?: (item: LiquidGlassNavItem) => void;
};

type Edges = { left: number; right: number };

type GlowState = {
  left: number;
  width: number;
  intensity: number; // 0..1 — how stretched the pill is (drives the lens visuals)
  dir: -1 | 0 | 1; // travel direction, for the trailing light glint
  visible: boolean;
};

const defaultItems: LiquidGlassNavItem[] = [
  {
    id: 'dashboard',
    label: 'Inicio',
    to: '/',
    Icon: House,
    match: (pathname) => pathname === '/' || pathname === '/liquid-glass-test',
  },
  {
    id: 'productos',
    label: 'Catálogo',
    to: '/productos',
    Icon: ShoppingBag,
    match: (pathname) => pathname.startsWith('/productos'),
  },
  {
    id: 'alerta',
    label: 'Alerta',
    to: '/desbloquear-alerta',
    Icon: Megaphone,
    match: (pathname) => pathname.startsWith('/desbloquear-alerta'),
  },
  {
    id: 'perfil',
    label: 'Perfil',
    to: '/perfil',
    Icon: UserRound,
    match: (pathname) => pathname === '/perfil',
  },
];

const cx = (...classes: Array<string | false | null | undefined>) => (
  classes.filter(Boolean).join(' ')
);

const clamp = (value: number, min: number, max: number) => (
  Math.min(Math.max(value, min), max)
);

const TRACK_PADDING = 8;
const REFERENCE_FRAME_MS = 1000 / 60;
const DRAG_THRESHOLD = 6; // px the finger must travel before a tap becomes a drag
const DRAG_STRETCH = 16; // extra width the pill takes while being dragged

// Asymmetric exponential smoothing rates (per 60fps frame). The leading edge of
// the pill races ahead while the trailing edge lags → it stretches like liquid
// and contracts as the trailing edge catches up. Exponential easing is monotonic
// → it NEVER overshoots, so there is no bounce/rebound when switching tabs.
const TRAVEL_LEAD = 0.26;
const TRAVEL_TRAIL = 0.15;
const DRAG_RATE = 0.55;
const RESEAT_TRACK_MS = 360;

const decay = (rate: number, dt: number) => 1 - Math.pow(1 - rate, dt / REFERENCE_FRAME_MS);

const getSettledWidth = (itemWidth: number, trackWidth: number) => {
  const maxWidth = Math.max(64, trackWidth - TRACK_PADDING * 2);
  return clamp(itemWidth - 10, 64, maxWidth);
};

const isIPhoneUserAgent = () => {
  if (typeof navigator === 'undefined') return false;
  return (
    /\b(iPhone|iPad|iPod)\b/i.test(navigator.userAgent)
    || (/\bMacintosh\b/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
};

export default function IPhoneLiquidGlassNav({
  items = defaultItems,
  activeId,
  defaultActiveId,
  iPhoneOnly = true,
  onActiveChange,
}: IPhoneLiquidGlassNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLight } = useTheme();
  const navItems = useMemo(() => items.filter((item) => !item.disabled), [items]);
  const isVisibleDevice = useMemo(() => !iPhoneOnly || isIPhoneUserAgent(), [iPhoneOnly]);

  const [isFastScrolling, setIsFastScrolling] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [trackWidth, setTrackWidth] = useState(400);
  const [internalActiveId, setInternalActiveId] = useState(
    defaultActiveId ?? navItems[0]?.id ?? '',
  );

  const [glow, setGlow] = useState<GlowState>({
    left: 0,
    width: 86,
    intensity: 0,
    dir: 0,
    visible: false,
  });

  const trackRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scrollState = useRef({ y: 0, t: 0, timeout: 0 });

  // ---- Pointer (tap vs drag) ----
  const pointerRef = useRef({ id: -1, startX: 0, armed: false, dragging: false });
  const suppressClickRef = useRef(false);
  const suppressTimerRef = useRef(0);
  const isDraggingRef = useRef(false);

  // ---- Two-edge physics ----
  const edgesRef = useRef<Edges>({ left: 0, right: 86 });
  const targetRef = useRef<Edges>({ left: 0, right: 86 });
  const selectedIndexRef = useRef(0);
  const runningRef = useRef(false);
  const rafRef = useRef(0);
  const tickRef = useRef<(ts: number) => void>(() => {});
  const lastTsRef = useRef<number | null>(null);
  const reseatUntilRef = useRef(0);
  const hasPositionedRef = useRef(false);
  const previousActiveIndexRef = useRef(0);

  // ---- Active tab resolution (controlled prop > route match > internal) ----
  const controlledIndex = navItems.findIndex((item) => item.id === activeId);
  const routeIndex = navItems.findIndex((item) => (
    item.match?.(location.pathname, location.search)
    || (item.to ? location.pathname === item.to.split('?')[0] : false)
  ));
  const internalIndex = navItems.findIndex((item) => item.id === internalActiveId);
  const activeIndex = [controlledIndex, routeIndex, internalIndex].find((index) => index >= 0) ?? 0;
  const selectedIndex = previewIndex ?? activeIndex;

  const getItemEdges = useCallback((index: number): Edges | null => {
    const item = itemRefs.current[index];
    const track = trackRef.current;
    if (!item || !track) return null;

    const width = getSettledWidth(item.offsetWidth, track.clientWidth);
    const center = item.offsetLeft + item.offsetWidth / 2;
    const left = clamp(
      center - width / 2,
      TRACK_PADDING,
      Math.max(track.clientWidth - width - TRACK_PADDING, TRACK_PADDING),
    );
    return { left, right: left + width };
  }, []);

  const getIndexFromLocalX = useCallback((localX: number) => {
    let best = selectedIndexRef.current;
    let bestDist = Infinity;
    itemRefs.current.forEach((item, index) => {
      if (!item) return;
      const center = item.offsetLeft + item.offsetWidth / 2;
      const dist = Math.abs(localX - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    return best;
  }, []);

  // The single physics loop: eases each edge toward its target, then stops.
  const tick = useCallback((ts: number) => {
    const dt = clamp(ts - (lastTsRef.current ?? ts), 1, 50);
    lastTsRef.current = ts;

    // While the bar is minimizing/expanding the active item resizes — keep the
    // target glued to its live geometry for a short window so the pill follows.
    if (ts < reseatUntilRef.current && !isDraggingRef.current) {
      const live = getItemEdges(selectedIndexRef.current);
      if (live) targetRef.current = live;
    }

    const target = targetRef.current;
    const edges = edgesRef.current;
    const dragging = isDraggingRef.current;

    const centerE = (edges.left + edges.right) / 2;
    const centerT = (target.left + target.right) / 2;
    const movingRight = centerT >= centerE;

    const lead = decay(dragging ? DRAG_RATE : TRAVEL_LEAD, dt);
    const trail = decay(dragging ? DRAG_RATE : TRAVEL_TRAIL, dt);
    const nextLeft = edges.left + (target.left - edges.left) * (movingRight ? trail : lead);
    const nextRight = edges.right + (target.right - edges.right) * (movingRight ? lead : trail);
    edgesRef.current = { left: nextLeft, right: nextRight };

    const width = Math.max(nextRight - nextLeft, 1);
    const settledWidth = Math.max(target.right - target.left, 1);
    const intensity = clamp((width - settledWidth) / settledWidth / 0.32, 0, 1);
    const remaining = Math.abs(target.left - nextLeft) + Math.abs(target.right - nextRight);
    const dir: -1 | 0 | 1 = remaining > 1 ? (movingRight ? 1 : -1) : 0;

    const reseating = ts < reseatUntilRef.current;
    if (!dragging && !reseating && remaining < 0.4) {
      edgesRef.current = { left: target.left, right: target.right };
      setGlow({ left: target.left, width: settledWidth, intensity: 0, dir: 0, visible: true });
      runningRef.current = false;
      return;
    }

    setGlow({ left: nextLeft, width, intensity, dir, visible: true });
    rafRef.current = requestAnimationFrame(tickRef.current);
  }, [getItemEdges]);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const startLoop = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    lastTsRef.current = null;
    rafRef.current = requestAnimationFrame(tickRef.current);
  }, []);

  // Seat the pill on an item. animate=false snaps (mount / resize).
  const seekToIndex = useCallback((index: number, animate = true) => {
    const edges = getItemEdges(index);
    if (!edges) return;
    selectedIndexRef.current = index;
    targetRef.current = edges;
    if (!animate) {
      edgesRef.current = { ...edges };
      setGlow({ left: edges.left, width: edges.right - edges.left, intensity: 0, dir: 0, visible: true });
      return;
    }
    startLoop();
  }, [getItemEdges, startLoop]);

  const activateIndex = useCallback((index: number) => {
    const item = navItems[index];
    if (!item) return;
    if (!activeId) setInternalActiveId(item.id);
    onActiveChange?.(item);
    if (item.to && location.pathname !== item.to.split('?')[0]) navigate(item.to);
  }, [navItems, activeId, onActiveChange, navigate, location.pathname]);

  // ---- Pointer interaction: tap navigates via the button's click; a drag past
  // the threshold grabs the oval and snaps to the nearest tab on release. ----
  const updateDrag = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const localX = clamp(clientX - rect.left, TRACK_PADDING, track.clientWidth - TRACK_PADDING);
    const index = getIndexFromLocalX(localX);
    const item = itemRefs.current[index];
    const itemWidth = item?.offsetWidth ?? track.clientWidth / Math.max(navItems.length, 1);
    const settledWidth = getSettledWidth(itemWidth, track.clientWidth);
    const width = Math.min(settledWidth + DRAG_STRETCH, track.clientWidth - TRACK_PADDING * 2);
    const left = clamp(
      localX - width / 2,
      TRACK_PADDING,
      Math.max(track.clientWidth - width - TRACK_PADDING, TRACK_PADDING),
    );

    // Direct manipulation: the oval tracks the finger 1:1, painted synchronously
    // (no spring/rAF), so it always moves instantly while dragging.
    const prevLeft = edgesRef.current.left;
    const dir: -1 | 0 | 1 = left > prevLeft + 0.5 ? 1 : left < prevLeft - 0.5 ? -1 : 0;
    const intensity = clamp((width - settledWidth) / settledWidth / 0.32, 0, 1);

    selectedIndexRef.current = index;
    setPreviewIndex(index);
    edgesRef.current = { left, right: left + width };
    targetRef.current = { left, right: left + width };
    setGlow({ left, width, intensity, dir, visible: true });
  }, [getIndexFromLocalX, navItems.length]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    pointerRef.current = { id: event.pointerId, startX: event.clientX, armed: true, dragging: false };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const p = pointerRef.current;
    if (!p.armed || p.id !== event.pointerId) return;

    if (!p.dragging) {
      if (Math.abs(event.clientX - p.startX) < DRAG_THRESHOLD) return;
      p.dragging = true;
      isDraggingRef.current = true;
      setIsDragging(true);
      try { trackRef.current?.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
    }
    updateDrag(event.clientX);
  };

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
    const p = pointerRef.current;
    if (p.id !== event.pointerId) return;

    if (p.dragging) {
      try { trackRef.current?.releasePointerCapture?.(event.pointerId); } catch { /* noop */ }
      isDraggingRef.current = false;
      setIsDragging(false);
      const index = selectedIndexRef.current;
      setPreviewIndex(null);

      if (commit) {
        // Swallow the click that fires right after releasing a drag.
        suppressClickRef.current = true;
        window.clearTimeout(suppressTimerRef.current);
        suppressTimerRef.current = window.setTimeout(() => { suppressClickRef.current = false; }, 350);
        seekToIndex(index, true);
        activateIndex(index);
      } else {
        seekToIndex(activeIndex, true);
      }
    } else if (commit && p.armed) {
      // Un toque simple (sin arrastre): seleccionamos el tab bajo el dedo aquí
      // mismo. En Safari iOS el click nativo del botón tras los eventos de
      // puntero es poco fiable, por lo que el deslizador no seguía al tab.
      const track = trackRef.current;
      if (track) {
        const rect = track.getBoundingClientRect();
        const localX = clamp(event.clientX - rect.left, TRACK_PADDING, track.clientWidth - TRACK_PADDING);
        const index = getIndexFromLocalX(localX);
        // Evita el doble disparo con el onClick nativo del botón.
        suppressClickRef.current = true;
        window.clearTimeout(suppressTimerRef.current);
        suppressTimerRef.current = window.setTimeout(() => { suppressClickRef.current = false; }, 400);
        seekToIndex(index, true);
        activateIndex(index);
      }
    }
    pointerRef.current = { id: -1, startX: 0, armed: false, dragging: false };
  };

  const handleTabClick = (index: number) => {
    if (suppressClickRef.current) return;
    seekToIndex(index, true);
    activateIndex(index);
  };

  // ---- Effects ----
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    window.clearTimeout(suppressTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isVisibleDevice) return;
    document.body.classList.add('iphone-liquid-glass-active');
    document.documentElement.classList.add('iphone-liquid-glass-active');
    return () => {
      document.body.classList.remove('iphone-liquid-glass-active');
      document.documentElement.classList.remove('iphone-liquid-glass-active');
    };
  }, [isVisibleDevice]);

  // Route / active changes glide the pill (animate only after the first paint).
  useEffect(() => {
    if (!isVisibleDevice || isDragging) return;
    const frame = window.requestAnimationFrame(() => {
      const shouldAnimate = hasPositionedRef.current && previousActiveIndexRef.current !== activeIndex;
      seekToIndex(activeIndex, shouldAnimate);
      hasPositionedRef.current = true;
      previousActiveIndexRef.current = activeIndex;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, isDragging, isVisibleDevice, seekToIndex]);

  // Labels collapse on minimize → the active item resizes; track it briefly.
  useEffect(() => {
    if (!isVisibleDevice) return;
    reseatUntilRef.current = performance.now() + RESEAT_TRACK_MS;
    startLoop();
  }, [isMinimized, isVisibleDevice, startLoop]);

  useEffect(() => {
    if (!isVisibleDevice) return;
    const syncTrackSize = () => {
      setTrackWidth(trackRef.current?.offsetWidth ?? 400);
      seekToIndex(selectedIndexRef.current, false);
    };
    syncTrackSize();

    const resizeObserver = typeof ResizeObserver !== 'undefined' && trackRef.current
      ? new ResizeObserver(syncTrackSize)
      : null;
    if (trackRef.current) resizeObserver?.observe(trackRef.current);
    window.addEventListener('resize', syncTrackSize);
    return () => {
      window.removeEventListener('resize', syncTrackSize);
      resizeObserver?.disconnect();
    };
  }, [isVisibleDevice, seekToIndex]);

  useEffect(() => {
    if (!isVisibleDevice) return;
    scrollState.current = { y: window.scrollY, t: performance.now(), timeout: 0 };

    const handleScroll = () => {
      const now = performance.now();
      const currentY = window.scrollY;
      const signedDelta = currentY - scrollState.current.y;
      const velocity = Math.abs(signedDelta) / Math.max(now - scrollState.current.t, 16);

      if (velocity > 1.05) setIsFastScrolling(true);

      // iOS 26 minimize behavior: shrink on scroll-down, expand on scroll-up / top.
      if (currentY < 24) setIsMinimized(false);
      else if (signedDelta > 6) setIsMinimized(true);
      else if (signedDelta < -6) setIsMinimized(false);

      window.clearTimeout(scrollState.current.timeout);
      scrollState.current.timeout = window.setTimeout(() => setIsFastScrolling(false), 180);
      scrollState.current.y = currentY;
      scrollState.current.t = now;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.clearTimeout(scrollState.current.timeout);
    };
  }, [isVisibleDevice]);

  if (!isVisibleDevice || navItems.length === 0) return null;

  const intensity = Math.min(glow.intensity, 1);
  const isLensActive = intensity > 0.03 || isDragging;
  const scaleY = 1 - intensity * 0.05;
  const verticalInset = 8 - intensity * 3;
  const clipLeft = clamp(glow.left, 0, trackWidth);
  const clipRight = clamp(trackWidth - (glow.left + glow.width), 0, trackWidth);
  const traceTrailing = glow.dir >= 0;
  const gridTemplateColumns = `repeat(${navItems.length}, minmax(0, 1fr))`;

  // ---- Tinte del vidrio adaptado al tema (claro transmite, oscuro absorbe) ----
  const trackBg = isLight
    ? (isDragging ? 'rgba(255,255,255,0.72)' : isFastScrolling ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.62)')
    : (isDragging ? 'rgba(255,255,255,0.10)' : isFastScrolling ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.07)');
  const trackBorder = isLight ? 'rgba(90,64,38,0.16)' : 'rgba(255,255,255,0.22)';
  const trackShadow = isLight
    ? '0 12px 34px rgba(80,52,24,0.18),0 2px 8px rgba(80,52,24,0.10),inset 0 1px 1px rgba(255,255,255,0.9),inset 0 -8px 18px rgba(120,90,60,0.05)'
    : '0 10px 30px rgba(0,0,0,0.32),0 2px 8px rgba(0,0,0,0.20),inset 0 1px 1px rgba(255,255,255,0.55),inset 0 -10px 22px rgba(255,255,255,0.06),inset 0 -1px 1px rgba(0,0,0,0.22)';
  const baseIconColor = isLight ? 'rgba(33,24,16,0.55)' : 'rgba(255,255,255,0.6)';
  const activeColor = isLight ? '#1c130c' : '#ffffff';
  // Cuerpo del cristal (la "gota") — más definido y blanco sobre fondo claro.
  const pillBg = isLight
    ? (isLensActive ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.7)')
    : (isLensActive ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.15)');
  const pillBorder = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)';
  const pillShadow = isLight
    ? '0 8px 22px rgba(80,52,24,0.18),inset 0 1.5px 2px rgba(255,255,255,0.95),inset 0 -8px 16px rgba(255,255,255,0.4),inset 0 -1px 1px rgba(120,90,60,0.12)'
    : '0 8px 26px rgba(0,0,0,0.28),inset 0 1.5px 2px rgba(255,255,255,0.65),inset 0 -10px 20px rgba(255,255,255,0.12),inset 0 -1px 1px rgba(0,0,0,0.2)';

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,calc(env(safe-area-inset-bottom)+0.125rem))] z-[120] flex justify-center px-4 select-none"
      aria-label="Navegación inferior Liquid Glass"
    >
      <div
        ref={trackRef}
        className={cx(
          'pointer-events-auto relative grid w-full max-w-[430px] rounded-full border px-2 font-sans transition-[background-color,border-color,box-shadow,transform,padding] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] [backdrop-filter:blur(18px)_saturate(180%)_brightness(1.06)] [-webkit-backdrop-filter:blur(18px)_saturate(180%)_brightness(1.06)]',
          isMinimized ? 'py-1' : 'py-2',
          isDragging && 'scale-[1.025]',
          isMinimized && !isDragging && 'scale-[0.94] opacity-95',
        )}
        style={{
          gridTemplateColumns,
          touchAction: 'none',
          transformOrigin: 'center bottom',
          backgroundColor: trackBg,
          borderColor: trackBorder,
          boxShadow: trackShadow,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => endPointer(event, true)}
        onPointerCancel={(event) => endPointer(event, false)}
      >
        {/* The Liquid Crystal Pill (iOS 26 style) — purely visual, never blocks taps */}
        <div
          className="pointer-events-none absolute z-0 rounded-full transition-opacity duration-300 ease-out"
          style={{
            top: `${verticalInset}px`,
            bottom: `${verticalInset}px`,
            width: `${glow.width}px`,
            opacity: glow.visible ? 1 : 0,
            transform: `translate3d(${glow.left}px, 0, 0) scaleY(${scaleY})`,
            transformOrigin: 'center center',
            willChange: 'transform, width',
          }}
          aria-hidden="true"
        >
          {/* Main crystal body */}
          <div
            className="absolute inset-0 rounded-full border [backdrop-filter:blur(3px)_saturate(180%)_brightness(1.1)] [-webkit-backdrop-filter:blur(3px)_saturate(180%)_brightness(1.1)] transition-[background-color,border-color,box-shadow] duration-300 ease-out"
            style={{ backgroundColor: pillBg, borderColor: pillBorder, boxShadow: pillShadow }}
          />
          {/* Edge dispersion — clear center, faint cool/warm prism at the rim */}
          <div
            className="absolute inset-[-1px] rounded-full [background:linear-gradient(90deg,rgba(255,190,120,0.30)_0%,rgba(255,255,255,0)_22%,rgba(255,255,255,0)_78%,rgba(255,170,150,0.30)_100%)] blur-[1.2px] transition-opacity duration-200"
            style={{ opacity: isLensActive ? 0.35 + intensity * 0.4 : 0 }}
          />
          {/* Specular top rim */}
          <div className="absolute inset-0 rounded-full border-t border-white/60 opacity-70 blur-[0.2px]" />
          {/* Internal refraction glow */}
          <div className="absolute inset-0 rounded-full [background:radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.24)_0%,transparent_72%)]" />
          <div
            className="absolute left-[18%] right-[18%] top-1 h-1.5 rounded-full bg-white/45 blur-[1.5px] transition-opacity duration-150"
            style={{ opacity: isLensActive ? 0.3 + intensity * 0.3 : 0 }}
          />
          <div
            className="absolute bottom-1 left-[18%] right-[18%] h-1.5 rounded-full bg-black/55 blur-[1.5px] transition-opacity duration-150"
            style={{ opacity: isLensActive ? (isLight ? 0.1 : 0.2) + intensity * 0.2 : 0 }}
          />
          {/* Trailing light glint */}
          <div
            className="absolute top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-white/15 blur-xl transition-opacity duration-150"
            style={{
              left: traceTrailing ? '-5px' : 'auto',
              right: traceTrailing ? 'auto' : '-5px',
              opacity: intensity > 0.02 ? 0.12 + intensity * 0.32 : 0,
            }}
          />
        </div>

        {/* Base layer: sober icons (the real, tappable buttons) */}
        {navItems.map((item, index) => (
          <button
            key={`base-${item.id}`}
            ref={(node) => { itemRefs.current[index] = node; }}
            type="button"
            aria-current={index === selectedIndex ? 'page' : undefined}
            aria-label={item.label}
            className={cx(
              'relative z-10 flex min-w-0 flex-col items-center justify-center rounded-full px-3 py-2 text-[10px] font-bold leading-none transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95 antialiased',
              isMinimized ? 'gap-0' : 'gap-1.5',
            )}
            style={{ color: baseIconColor }}
            onClick={() => handleTabClick(index)}
          >
            <span className="flex shrink-0"><item.Icon className="size-5" strokeWidth={2.1} /></span>
            <span
              className={cx(
                'max-w-[68px] truncate font-bold tracking-tight transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                isMinimized ? 'max-h-0 scale-90 opacity-0' : 'max-h-4 opacity-90',
              )}
            >
              {item.label}
            </span>
          </button>
        ))}

        {/* Top layer: bright filled icons revealed only where the glass pill sits */}
        <div
          className="absolute inset-0 z-20 pointer-events-none select-none overflow-hidden"
          style={{ clipPath: `inset(0px ${clipRight}px 0px ${clipLeft}px)`, color: activeColor }}
        >
          <div
            className={cx('grid w-full px-2 transition-[padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]', isMinimized ? 'py-1' : 'py-2')}
            style={{ gridTemplateColumns }}
          >
            {navItems.map((item) => (
              <div
                key={`reveal-${item.id}`}
                className={cx(
                  'flex min-w-0 flex-col items-center justify-center px-3 py-2 text-[10px] font-black leading-none antialiased transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                  isMinimized ? 'gap-0' : 'gap-1.5',
                )}
              >
                <span className="flex shrink-0 scale-105"><item.Icon className="size-5" strokeWidth={2} fill="currentColor" /></span>
                <span
                  className={cx(
                    'max-w-[68px] truncate font-black tracking-tight transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                    isMinimized ? 'max-h-0 scale-90 opacity-0' : 'max-h-4 opacity-100',
                  )}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
