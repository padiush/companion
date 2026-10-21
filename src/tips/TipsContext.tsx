import { useIsFocused } from '@react-navigation/native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Rect } from './placement';
import { visibleHole } from './placement';
import { isPrompting, subscribePrompting } from './systemPrompts';
import { TipOverlay, type TipStep } from './TipOverlay';
import { forgetSeenTours, readSeenTours, writeSeenTours } from './tipsSeen';
import { anchorId, TOURS, type TourId } from './tours';

/** Where a control is on screen, or null when it cannot be measured. */
export type Measure = (view: View) => Promise<Rect | null>;

/**
 * How long a screen has to settle — the push animation, a list filling in —
 * before its tour measures it. Short enough to feel like part of arriving.
 */
const SETTLE_MS = 600;
/** A measurement that never answers counts as no control. */
const MEASURE_TIMEOUT_MS = 500;
/** How long a rotated or unfolded screen has to lay itself out again. */
const RELAYOUT_MS = 300;

const measureInWindow: Measure = (view) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), MEASURE_TIMEOUT_MS);
    view.measureInWindow((x, y, width, height) => {
      clearTimeout(timer);
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });

/**
 * Whether the app is in front. A system prompt sends it to the background
 * on Android and makes it inactive on iOS; anything else — including the
 * unknown state at launch — counts as in front.
 */
const inForeground = (state: string | null | undefined) =>
  state !== 'background' && state !== 'inactive';

interface ActiveTour {
  /** The account it started for; a tour never outlives a sign-out. */
  userId: number | null;
  tour: TourId;
  steps: TipStep[];
  index: number;
}

interface Registry {
  register: (id: string, view: View) => void;
  unregister: (id: string, view: View) => void;
}

interface TipsState {
  /** Whether this tour should start now, if its screen is ready for it. */
  wants: (tour: TourId) => boolean;
  start: (tour: TourId) => Promise<void>;
  /** Hold every tour back until the returned release is called. */
  hold: () => () => void;
  /** Forget which tours have run, so each runs again on its screen. */
  replay: () => Promise<void>;
}

const RegistryContext = createContext<Registry | null>(null);
const TipsContext = createContext<TipsState | null>(null);

interface ProviderProps {
  /** The signed-in account; tours are remembered per account. */
  userId: number | null;
  /** Something above the screens is open or about to be: the release notes, the intro. */
  held: boolean;
  children: ReactNode;
  /** For tests: how a control's place on screen is found. */
  measure?: Measure;
}

/**
 * Runs the tips: knows which tours this account has seen, which controls are
 * on screen to point at, and whether anything is in the way. One tour at a
 * time, never over a sheet, the release notes, the intro or a system prompt.
 * Finishing a tour or skipping it marks it seen.
 *
 * Storage failing is not worth an error on screen: tours are then simply not
 * shown, or show again next time.
 */
export function TipsProvider({ userId, held, children, measure = measureInWindow }: ProviderProps) {
  const anchors = useRef(new Map<string, View>());
  // Kept with the account they belong to, so another account's never apply.
  const [stored, setStored] = useState<{ userId: number; tours: Set<TourId> } | null>(null);
  const [holds, setHolds] = useState(0);
  const [started, setActive] = useState<ActiveTour | null>(null);
  const [prompting, setPrompting] = useState(isPrompting);
  const [foreground, setForeground] = useState(() => inForeground(AppState.currentState));
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => subscribePrompting(() => setPrompting(isPrompting())), []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setForeground(inForeground(state))
    );
    return () => subscription.remove();
  }, []);

  const seen = stored !== null && stored.userId === userId ? stored.tours : null;
  const active = started !== null && started.userId === userId ? started : null;
  const setSeen = useCallback(
    (tours: Set<TourId>) => userId !== null && setStored({ userId, tours }),
    [userId]
  );

  useEffect(() => {
    if (userId === null) {
      return;
    }
    let current = true;
    readSeenTours(userId)
      .then((tours) => current && setStored({ userId, tours }))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [userId]);

  const blocked = held || holds > 0 || prompting || !foreground;

  // What `start` checks after measuring, which takes a moment: the latest
  // state, not the one it was called with.
  const latest = useRef({ blocked, active, seen, screen, insets });
  useEffect(() => {
    latest.current = { blocked, active, seen, screen, insets };
  });

  const wants = useCallback(
    (tour: TourId) => !blocked && active === null && seen !== null && !seen.has(tour),
    [blocked, active, seen]
  );

  /** The tour's steps whose controls are on screen now, highlighted where they are. */
  const measureSteps = useCallback(
    async (tour: TourId) => {
      const steps: TipStep[] = [];
      for (const step of TOURS[tour]) {
        const view = anchors.current.get(anchorId(tour, step));
        const rect = view ? await measure(view) : null;
        const hole = visibleHole(rect, latest.current.screen, latest.current.insets);
        if (hole) {
          steps.push({ key: step, hole });
        }
      }
      return steps;
    },
    [measure]
  );

  const start = useCallback(
    async (tour: TourId) => {
      const steps = await measureSteps(tour);

      const now = latest.current;
      if (steps.length === 0 || now.blocked || now.active || !now.seen || now.seen.has(tour)) {
        return;
      }
      setActive({ userId, tour, steps, index: 0 });
    },
    [measureSteps, userId]
  );

  // Rotating the phone or unfolding it moves every control. An open tour
  // measures them again and stays on the step it was on; if that control has
  // gone off screen, it carries on from the nearest one still there.
  useEffect(() => {
    const open = latest.current.active;
    if (!open) {
      return;
    }
    let current = true;
    const timer = setTimeout(async () => {
      const steps = await measureSteps(open.tour);
      if (!current) {
        return;
      }
      if (steps.length === 0) {
        setActive(null);
        return;
      }
      const at = steps.findIndex((step) => step.key === open.steps[open.index].key);
      setActive({ ...open, steps, index: at === -1 ? Math.min(open.index, steps.length - 1) : at });
    }, RELAYOUT_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [screen.width, screen.height, measureSteps]);

  const finish = useCallback(() => {
    if (!active) {
      return;
    }
    const tours = new Set(seen ?? []);
    tours.add(active.tour);
    setSeen(tours);
    setActive(null);
    if (userId !== null) {
      writeSeenTours(userId, tours).catch(() => undefined);
    }
  }, [active, seen, userId, setSeen]);

  const next = useCallback(() => {
    if (active && active.index < active.steps.length - 1) {
      setActive({ ...active, index: active.index + 1 });
    } else {
      finish();
    }
  }, [active, finish]);

  const hold = useCallback(() => {
    setHolds((count) => count + 1);
    return () => setHolds((count) => count - 1);
  }, []);

  const replay = useCallback(async () => {
    setActive(null);
    setSeen(new Set());
    if (userId !== null) {
      await forgetSeenTours(userId).catch(() => undefined);
    }
  }, [userId, setSeen]);

  const registry = useMemo<Registry>(
    () => ({
      register: (id, view) => {
        anchors.current.set(id, view);
      },
      unregister: (id, view) => {
        if (anchors.current.get(id) === view) {
          anchors.current.delete(id);
        }
      },
    }),
    []
  );

  const state = useMemo<TipsState>(
    () => ({ wants, start, hold, replay }),
    [wants, start, hold, replay]
  );

  return (
    <RegistryContext.Provider value={registry}>
      <TipsContext.Provider value={state}>
        {children}
        {active ? (
          <TipOverlay
            tour={active.tour}
            steps={active.steps}
            index={active.index}
            onNext={next}
            onSkip={finish}
          />
        ) : null}
      </TipsContext.Provider>
    </RegistryContext.Provider>
  );
}

/**
 * Runs `tour` the first time this screen is shown and `ready` — its content
 * loaded, nothing of its own open over it. Without a `TipsProvider` (a screen
 * rendered on its own, in a test) it does nothing.
 */
export function useTour(tour: TourId, ready = true) {
  const tips = useContext(TipsContext);
  const focused = useIsFocused();
  const due = tips !== null && focused && ready && tips.wants(tour);

  useEffect(() => {
    if (!due || !tips) {
      return;
    }
    const timer = setTimeout(() => void tips.start(tour), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [due, tips, tour]);
}

/** Holds every tour back while `held` is true: a sheet or menu of this screen's own is open. */
export function useTipsHold(held: boolean) {
  const tips = useContext(TipsContext);
  const hold = tips?.hold;

  useEffect(() => (held && hold ? hold() : undefined), [held, hold]);
}

/** Runs every tour again, each on its own screen. */
export function useReplayTips(): () => Promise<void> {
  const tips = useContext(TipsContext);
  return useCallback(async () => {
    await tips?.replay();
  }, [tips]);
}

interface AnchorProps {
  /**
   * `<tour>.<step>`, as `anchorId` builds it. Null renders the children as
   * they are, for a list where only the first row is pointed at.
   */
  id: string | null;
  children: ReactNode;
  /** Passed to the wrapping view, for a control that has to keep its place in a row. */
  style?: StyleProp<ViewStyle>;
}

/** Marks the control a tip points at. It wraps it in a view that can be measured. */
export function TipAnchor({ id, children, style }: AnchorProps) {
  const registry = useContext(RegistryContext);
  const ref = useRef<View>(null);

  useEffect(() => {
    const view = ref.current;
    if (!registry || !view || id === null) {
      return;
    }
    registry.register(id, view);
    return () => registry.unregister(id, view);
  }, [registry, id]);

  if (id === null) {
    return <>{children}</>;
  }

  return (
    <View ref={ref} testID={`tip-anchor-${id}`} collapsable={false} style={style}>
      {children}
    </View>
  );
}
