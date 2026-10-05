import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingStatus,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  AppState,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getDatabase } from '../db/database';
import type { MediaRow } from '../db/types';
import { impact } from '../haptics';
import { border, radius, space, touch, type, useTheme } from '../theme';
import { Icon } from '../ui/Icon';
import { SectionLabel } from '../ui/SectionLabel';
import { formatClock, meteringToLevel } from './audioLevels';
import {
  currentOwner,
  isReadOnly,
  listOwnedMedia,
  resolveOwner,
  type MediaOwner,
  type MediaOwnerProps,
} from './mediaOwner';
import { attachMedia } from './mediaService';

/** Bars kept in the rolling waveform, and how often the recorder is sampled. */
const WAVEFORM_BARS = 40;
const POLL_MS = 100;

type Phase = 'idle' | 'recording' | 'paused';

/** Android 13, the first release where posting a notification needs consent. */
const TIRAMISU = 33;

/**
 * Ask to show the recording notification the foreground service posts. It is
 * the informant's visible sign that the microphone is live, and the recorder's
 * only stop button once the phone is in a pocket — but Android 13 and later
 * hide it unless notifications are granted.
 *
 * The take records either way, so this asks and moves on. Android shows the
 * dialog once; refusing costs the notification, not the interview.
 */
async function askToShowRecordingNotification() {
  if (Platform.OS !== 'android' || Platform.Version < TIRAMISU) {
    return;
  }

  try {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // Never fatal — recording does not depend on it.
  }
}

/**
 * Records audio into the encrypted store, for an interview or a field record.
 * On an interview it sits at the top so a researcher can start recording
 * before touching the form; on a record it takes a voice note — the name as
 * it was said, or what was told about the plant. Supports pause/resume (to
 * take material off the record) and shows a live waveform, a running clock,
 * and a recording indicator.
 *
 * A new field record is stored only once a take has been kept, as with a
 * photograph: starting and abandoning a recording leaves nothing behind.
 */
export function AudioRecorder(props: MediaOwnerProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const { instanceId, fieldRecordId } = currentOwner(props);
  const readOnly = isReadOnly(props);
  const forRecord = !('instanceId' in props);

  // Who a finished take belongs to is settled when it is kept, which can be
  // long after the take began — a record may have been stored in between. The
  // ingest path reads the owner through a ref, so it always sees the current
  // one without being rebuilt, and resubscribed, on every render.
  const ownerPropsRef = useRef(props);
  useEffect(() => {
    ownerPropsRef.current = props;
  });

  // Native emits a finish event whenever a take ends, including when it is
  // ended from the notification. The listener has to be handed over at
  // hook-call time, before the state it needs exists, so it delegates through
  // a ref that an effect below keeps pointed at the current handler. That also
  // keeps its identity stable, rather than resubscribing on every render.
  const onRecordingFinishedRef = useRef<() => void>(() => {});
  const handleRecordingStatus = useCallback((status: RecordingStatus) => {
    if (status.isFinished) {
      onRecordingFinishedRef.current();
    }
  }, []);

  const recorder = useAudioRecorder(
    { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true },
    handleRecordingStatus
  );

  const [phase, setPhase] = useState<Phase>('idle');
  const [durationMillis, setDurationMillis] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [recordings, setRecordings] = useState<MediaRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The last length the poll saw. Held in a ref as well as in state so the
  // interruption path can read it without re-subscribing to AppState ten times
  // a second, and because a recorder the system has already stopped reports a
  // duration of zero — this is the only record of how long the take ran.
  const lastDurationRef = useRef(0);

  /**
   * True while a take is being closed out. Stopping the recorder itself emits
   * the finish event, so without this the deliberate stop would immediately
   * trigger the salvage path and attach the same audio twice.
   */
  const settlingRef = useRef(false);

  const refresh = useCallback(async (owner: MediaOwner) => {
    setRecordings(await listOwnedMedia(owner, 'audio'));
  }, []);

  /**
   * Move a finished take into the encrypted store and re-list it — storing a
   * new field record first, now that there is something to keep.
   */
  const ingest = useCallback(
    async (uri: string, durationS: number) => {
      const owner = await resolveOwner(ownerPropsRef.current);
      if (!owner) {
        throw new Error('nothing to attach the recording to');
      }

      const db = await getDatabase();
      await attachMedia(db, {
        ...owner,
        kind: 'audio',
        localUri: uri,
        contentType: 'audio/mp4',
        durationS,
      });
      await refresh(owner);
    },
    [refresh]
  );

  useEffect(() => {
    let active = true;
    listOwnedMedia({ instanceId, fieldRecordId }, 'audio').then((rows) => {
      if (active) setRecordings(rows);
    });
    return () => {
      active = false;
    };
  }, [instanceId, fieldRecordId]);

  // While recording, sample the recorder to drive the clock and waveform. A
  // pause tears the interval down, freezing both — the visible "off the record"
  // cue — and resuming starts it again.
  useEffect(() => {
    if (phase !== 'recording') {
      return;
    }
    const id = setInterval(() => {
      const state = recorder.getStatus();
      lastDurationRef.current = state.durationMillis;
      setDurationMillis(state.durationMillis);
      setLevels((prev) => {
        const next = [...prev, meteringToLevel(state.metering)];
        return next.length > WAVEFORM_BARS ? next.slice(next.length - WAVEFORM_BARS) : next;
      });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [phase, recorder]);

  /**
   * Close out a take the system ended for us, keeping whatever reached disk.
   * The file is already final — stopping again is belt and braces, and throws
   * harmlessly if the recorder is gone.
   */
  const salvage = useCallback(async () => {
    if (settlingRef.current) {
      return;
    }
    settlingRef.current = true;

    const durationS = Math.max(1, Math.round(lastDurationRef.current / 1000));
    setPhase('idle');
    setBusy(true);
    try {
      try {
        await recorder.stop();
      } catch {
        // Already stopped by the system; the take is whatever it managed.
      }

      const uri = recorder.uri;
      setLevels([]);
      setDurationMillis(0);
      lastDurationRef.current = 0;

      if (!uri) {
        setError(t('interview.recordingLost'));
        return;
      }

      await ingest(uri, durationS);
      setError(t('interview.recordingInterrupted'));
    } catch {
      setError(t('interview.recordingLost'));
    } finally {
      settlingRef.current = false;
      setBusy(false);
    }
  }, [ingest, recorder, t]);

  /**
   * Recording survives the app being backgrounded — a phone goes in a pocket
   * mid-interview and that has to keep working — but a take can still be ended
   * without us: the notification's stop button, an incoming call taking audio
   * focus, Android reclaiming the service. Native emits the finish event in
   * all of those cases, so that event is the signal to trust.
   *
   * This originally hung on an AppState transition to `active` instead, and a
   * device test showed why that was wrong: stopping from the notification left
   * the screen still showing a live recording with a frozen waveform and a
   * stop button that no longer had anything to stop. A locked phone can be
   * woken without ever producing a background-to-active edge, so the check
   * simply never ran. The event has no such gap.
   *
   * Only a running take is reconciled. A pause reads as "not recording" too,
   * but it is deliberate and short, and the phone is in someone's hand.
   */
  useEffect(() => {
    onRecordingFinishedRef.current = () => {
      if (phase === 'recording') {
        void salvage();
      }
    };
  }, [phase, salvage]);

  /**
   * Backstop for the event never arriving — a process suspended long enough to
   * miss it, say. Cheap, and the alternative is the stale-recording screen
   * that this whole path exists to prevent.
   */
  useEffect(() => {
    if (phase !== 'recording') {
      return;
    }

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && !recorder.getStatus().isRecording) {
        void salvage();
      }
    });

    return () => subscription.remove();
  }, [phase, recorder, salvage]);

  const start = async () => {
    setError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError(t('interview.mediaPermission'));
      return;
    }

    await askToShowRecordingNotification();

    try {
      // `allowsRecording` is required on iOS before the session will actually
      // capture; without it `record()` throws or stays silent.
      // `allowsBackgroundRecording` is what keeps the take alive once the
      // screen goes off, and pairs with the recording foreground service the
      // expo-audio config plugin installs.
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        allowsBackgroundRecording: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      impact();
      setLevels([]);
      setDurationMillis(0);
      lastDurationRef.current = 0;
      setPhase('recording');
    } catch {
      setPhase('idle');
      setError(t('interview.recordStartFailed'));
    }
  };

  const pause = () => {
    try {
      recorder.pause();
      setPhase('paused');
    } catch {
      setError(t('interview.recordStartFailed'));
    }
  };

  const resume = () => {
    try {
      recorder.record();
      setPhase('recording');
    } catch {
      setError(t('interview.recordStartFailed'));
    }
  };

  const stop = async () => {
    if (settlingRef.current) {
      return;
    }
    // Claimed before stopping, because stopping emits the finish event and the
    // salvage path must not treat a deliberate stop as an interruption.
    settlingRef.current = true;

    // Read the recorded length before stopping — the status resets afterward.
    // Paused time is not counted, so this is the real audio duration.
    const durationS = Math.max(1, Math.round(recorder.getStatus().durationMillis / 1000));
    impact();
    setBusy(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      setPhase('idle');
      setLevels([]);
      setDurationMillis(0);
      lastDurationRef.current = 0;
      if (!uri) {
        return;
      }

      await ingest(uri, durationS);
    } catch {
      setPhase('idle');
      setError(t('interview.mediaSaveFailed'));
    } finally {
      settlingRef.current = false;
      setBusy(false);
    }
  };

  const recording = phase === 'recording';
  const paused = phase === 'paused';
  const active = recording || paused;

  const statusLabel = recording
    ? t('interview.recordingInProgress')
    : paused
      ? t('interview.recordingPaused')
      : t('interview.recordAudio');

  return (
    <View style={styles.container}>
      <SectionLabel>{t('interview.audioTitle')}</SectionLabel>

      {/* A sent record keeps the recordings it has and takes no more. */}
      {readOnly ? null : (
        <>
          <Text style={[styles.hint, { color: theme.muted }]}>
            {t(forRecord ? 'fieldRecord.audioHint' : 'interview.recordHint')}
          </Text>

          <View
            style={[
              styles.stage,
              { backgroundColor: theme.card, borderColor: active ? theme.danger : theme.border },
            ]}
          >
            <View style={styles.stageHeader}>
              <View style={styles.statusRow}>
                {active ? (
                  <View
                    testID="recording-dot"
                    style={[
                      styles.dot,
                      { backgroundColor: recording ? theme.danger : theme.muted },
                    ]}
                  />
                ) : (
                  <Icon name="interview" color={theme.primaryText} size={20} />
                )}
                <Text
                  style={[styles.status, { color: active ? theme.danger : theme.muted }]}
                  testID="recording-status"
                >
                  {statusLabel}
                </Text>
              </View>
              <Text style={[styles.clock, { color: theme.text }]} testID="recording-clock">
                {formatClock(active ? durationMillis : 0)}
              </Text>
            </View>

            <Waveform
              levels={levels}
              color={recording ? theme.danger : theme.muted}
              track={theme.track}
            />

            <View style={styles.controls}>
              {active ? (
                <>
                  <TouchableOpacity
                    testID={recording ? 'pause-recording' : 'resume-recording'}
                    onPress={recording ? pause : resume}
                    disabled={busy}
                    accessibilityRole="button"
                    style={[styles.secondaryButton, { borderColor: theme.border }]}
                  >
                    <Icon name={recording ? 'pause' : 'play'} color={theme.text} size={16} />
                    <Text style={[styles.secondaryText, { color: theme.text }]}>
                      {recording ? t('interview.pauseRecording') : t('interview.resumeRecording')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="stop-recording"
                    onPress={stop}
                    disabled={busy}
                    accessibilityRole="button"
                    style={[styles.primaryButton, { backgroundColor: theme.danger }]}
                  >
                    {busy ? (
                      <ActivityIndicator color={theme.onPrimary} />
                    ) : (
                      <>
                        <Icon name="stop" color={theme.onPrimary} size={18} />
                        <Text style={[styles.primaryText, { color: theme.onPrimary }]}>
                          {t('interview.stopRecording')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  testID="record-audio"
                  onPress={start}
                  disabled={busy}
                  accessibilityRole="button"
                  style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                >
                  {busy ? (
                    <ActivityIndicator color={theme.onPrimary} />
                  ) : (
                    <>
                      <Icon name="interview" color={theme.onPrimary} size={20} />
                      <Text style={[styles.primaryText, { color: theme.onPrimary }]}>
                        {t('interview.recordAudio')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </>
      )}

      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

      {recordings.map((item, index) => (
        <View
          key={item.client_id}
          testID={`recording-${item.client_id}`}
          style={[styles.item, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <View style={[styles.itemIcon, { backgroundColor: theme.primarySoft }]}>
            <Icon name="interview" color={theme.primaryText} size={18} />
          </View>
          <Text style={[styles.itemText, { color: theme.text }]}>
            {t('interview.recordingLabel', { number: index + 1 })}
            {item.duration_s ? ` · ${formatClock(item.duration_s * 1000)}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A rolling bar-graph of recent input levels; empties fill from the right. */
function Waveform({ levels, color, track }: { levels: number[]; color: string; track: string }) {
  const pad = Math.max(0, WAVEFORM_BARS - levels.length);
  const bars = [...Array(pad).fill(-1), ...levels];

  return (
    <View style={styles.waveform} testID="waveform">
      {bars.map((level, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            {
              height: `${8 + Math.max(0, level) * 92}%`,
              backgroundColor: level < 0 ? track : color,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: space.xl,
  },
  hint: {
    ...type.caption,
    marginBottom: space.md,
  },
  stage: {
    borderWidth: border.width,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.lg,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  dot: {
    // A circle, so the radius is half the size rather than the control radius.
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  status: {
    ...type.body,
    fontWeight: '600',
  },
  clock: {
    ...type.heading,
    // Digits keep their column as the timer runs, so it does not jitter.
    fontVariant: ['tabular-nums'],
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    gap: 2,
  },
  bar: {
    // A waveform bar a few points wide; the control radius would round it away.
    flex: 1,
    borderRadius: 2,
    minHeight: 3,
  },
  controls: {
    flexDirection: 'row',
    gap: space.md,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    gap: space.sm,
    borderRadius: radius.control,
    paddingVertical: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touch.min + 12,
  },
  primaryText: {
    ...type.body,
    fontWeight: '800',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    gap: space.sm,
    borderWidth: border.width,
    borderRadius: radius.control,
    paddingVertical: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touch.min + 12,
  },
  secondaryText: {
    ...type.body,
    fontWeight: '700',
  },
  error: {
    ...type.label,
    marginTop: space.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm + 2,
    marginTop: space.sm,
    borderWidth: border.width,
    borderRadius: radius.control,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    ...type.body,
    fontWeight: '600',
  },
});
