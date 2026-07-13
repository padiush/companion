import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { getDatabase } from '../db/database';
import { listMediaForInstance } from '../db/mediaRepository';
import type { MediaRow } from '../db/types';
import { useTheme } from '../theme';
import { formatClock, meteringToLevel } from './audioLevels';
import { attachMedia } from './mediaService';

/** Bars kept in the rolling waveform, and how often the recorder is sampled. */
const WAVEFORM_BARS = 40;
const POLL_MS = 100;

type Phase = 'idle' | 'recording' | 'paused';

/**
 * Records interview audio into the encrypted store. Sits at the top of the
 * interview so a researcher can start recording before touching the form.
 * Supports pause/resume (to take material off the record) and shows a live
 * waveform, a running clock, and a recording indicator.
 */
export function AudioRecorder({ instanceId }: { instanceId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });

  const [phase, setPhase] = useState<Phase>('idle');
  const [durationMillis, setDurationMillis] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [recordings, setRecordings] = useState<MediaRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const db = await getDatabase();
    const rows = await listMediaForInstance(db, instanceId);
    setRecordings(rows.filter((row) => row.kind === 'audio'));
  }, [instanceId]);

  useEffect(() => {
    let active = true;
    getDatabase()
      .then((db) => listMediaForInstance(db, instanceId))
      .then((rows) => {
        if (active) setRecordings(rows.filter((row) => row.kind === 'audio'));
      });
    return () => {
      active = false;
    };
  }, [instanceId]);

  // While recording, sample the recorder to drive the clock and waveform. A
  // pause tears the interval down, freezing both — the visible "off the record"
  // cue — and resuming starts it again.
  useEffect(() => {
    if (phase !== 'recording') {
      return;
    }
    const id = setInterval(() => {
      const state = recorder.getStatus();
      setDurationMillis(state.durationMillis);
      setLevels((prev) => {
        const next = [...prev, meteringToLevel(state.metering)];
        return next.length > WAVEFORM_BARS ? next.slice(next.length - WAVEFORM_BARS) : next;
      });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [phase, recorder]);

  const start = async () => {
    setError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError(t('interview.mediaPermission'));
      return;
    }

    try {
      // Required on iOS before the session will actually capture; without it
      // `record()` throws or stays silent.
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setLevels([]);
      setDurationMillis(0);
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
    // Read the recorded length before stopping — the status resets afterward.
    // Paused time is not counted, so this is the real audio duration.
    const durationS = Math.max(1, Math.round(recorder.getStatus().durationMillis / 1000));
    setBusy(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      setPhase('idle');
      setLevels([]);
      setDurationMillis(0);
      if (!uri) {
        return;
      }

      const db = await getDatabase();
      await attachMedia(db, {
        instanceId,
        kind: 'audio',
        localUri: uri,
        contentType: 'audio/mp4',
        durationS,
      });
      await refresh();
    } catch {
      setPhase('idle');
      setError(t('interview.mediaSaveFailed'));
    } finally {
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
      <Text style={[styles.title, { color: theme.text }]}>{t('interview.audioTitle')}</Text>
      <Text style={[styles.hint, { color: theme.muted }]}>{t('interview.recordHint')}</Text>

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
                style={[styles.dot, { backgroundColor: recording ? theme.danger : theme.muted }]}
              />
            ) : (
              <MicIcon color={theme.primary} />
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
          track={theme.border}
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
                  <Text style={[styles.primaryText, { color: theme.onPrimary }]}>
                    {t('interview.stopRecording')}
                  </Text>
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
                <Text style={[styles.primaryText, { color: theme.onPrimary }]}>
                  {t('interview.recordAudio')}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

      {recordings.map((item, index) => (
        <View key={item.client_id} testID={`recording-${item.client_id}`} style={styles.item}>
          <MicIcon color={theme.muted} size={14} />
          <Text style={[styles.itemText, { color: theme.muted }]}>
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

/** A simple microphone glyph. */
function MicIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" testID="mic-icon">
      <Path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" fill={color} />
      <Path
        d="M17 12a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12h-2Z"
        fill={color}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    marginBottom: 12,
  },
  stage: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 14,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  status: {
    fontSize: 15,
    fontWeight: '600',
  },
  clock: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    gap: 2,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 3,
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    fontSize: 14,
    marginTop: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  itemText: {
    fontSize: 15,
  },
});
