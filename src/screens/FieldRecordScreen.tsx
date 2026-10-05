import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInputProps,
} from 'react-native';

import { AudioRecorder } from '../capture/AudioRecorder';
import { DateField } from '../capture/DateField';
import { MediaSection } from '../capture/MediaSection';
import { BASES, EXEMPTIONS, permitLabel, type FieldRecordDraft } from '../capture/fieldRecord';
import { useFieldRecord } from '../capture/useFieldRecord';
import type { RootStackParamList } from '../navigation/types';
import { border, radius, space, type, useTheme } from '../theme';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Chip, ChipGroup } from '../ui/Chip';
import { ChoiceGrid, ChoiceTile } from '../ui/ChoiceTile';
import { Field } from '../ui/Field';
import { Icon, type IconName } from '../ui/Icon';
import { Input } from '../ui/Input';
import { SectionLabel } from '../ui/SectionLabel';

/** What the server accepts for any one text field (`max:255`). */
const TEXT_LIMIT = 255;

type TextField = 'vernacularName' | 'collectionNumber' | 'collector' | 'locality' | 'notes';

/** What each field holds, at a glance; the name says it is kept encrypted. */
const FIELD_ICONS: Partial<Record<TextField, IconName>> = {
  vernacularName: 'encrypted',
  collectionNumber: 'number',
  collector: 'person',
  locality: 'location',
};

/** What a record is, as a picture: a pressed specimen, an eye, a plant, a cutting. */
const BASIS_ICONS: Record<string, IconName> = {
  preserved_specimen: 'specimen',
  human_observation: 'observed',
  living_specimen: 'living',
  material_sample: 'sample',
};

/**
 * Record one documented encounter: what it was, whether anything was taken,
 * when and where, and the permit it was collected under.
 *
 * The recorded stage only (ADR 0011 in the platform repository). There is
 * nowhere here to identify the plant or give it an accession number: both
 * happen later, on the web, where the catalog and the herbarium's sequence
 * are. Every edit is saved as it is made, as an interview's answers are.
 */
export function FieldRecordScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'FieldRecord'>>();
  const {
    draft,
    permits,
    loading,
    saving,
    stored,
    clientId,
    fromAnswer,
    discardable,
    readOnly,
    syncStatus,
    syncError,
    locating,
    locationFailed,
    update,
    locate,
    ensureStored,
    discard,
  } = useFieldRecord(
    params.projectId,
    params.clientId,
    params.answerClientId
      ? { answerClientId: params.answerClientId, vernacularName: params.vernacularName }
      : undefined
  );

  if (loading || !draft) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const input = (field: TextField, props: Omit<TextInputProps, 'style'> = {}) => (
    <Input
      testID={`record-${field}`}
      icon={FIELD_ICONS[field]}
      value={draft[field]}
      onChangeText={(value) => update({ [field]: value } as Partial<FieldRecordDraft>)}
      editable={!readOnly}
      maxLength={TEXT_LIMIT}
      {...props}
    />
  );

  /**
   * A permit this device no longer has cached — revoked on the web since the
   * record was made, most likely. The record keeps the id it was captured
   * with, and the server is the one that decides; hiding it here would make
   * a permit the record still carries invisible and impossible to change.
   */
  const unlistedPermit =
    draft.permitId !== null && !permits.some((permit) => permit.id === draft.permitId);

  /**
   * Discarding is final: nothing of the record was sent, so nothing of it is
   * left anywhere once it goes. Asked, never assumed.
   */
  const confirmDiscard = () => {
    Alert.alert(t('fieldRecord.discardTitle'), t('fieldRecord.discardMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('fieldRecord.discard'),
        style: 'destructive',
        onPress: async () => {
          if (await discard()) {
            navigation.goBack();
          }
        },
      },
    ]);
  };

  /** The banner speaks only when something needs saying; a draft says nothing. */
  const refused = syncStatus === 'rejected';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      {readOnly ? (
        <View style={styles.banner}>
          <Banner testID="record-sent" tone="success" icon="synced">
            {t('fieldRecord.sentReadOnly')}
          </Banner>
        </View>
      ) : null}

      {refused ? (
        <View style={styles.banner}>
          <Banner
            testID="record-refused"
            tone="danger"
            icon="alert"
            title={t('fieldRecord.refusedTitle')}
          >
            {t(`sync.recordErrors.${syncError}`, {
              defaultValue: t('sync.recordErrors.unknown'),
            })}
          </Banner>
        </View>
      ) : null}

      <View pointerEvents={readOnly ? 'none' : 'auto'}>
        <SectionLabel>{t('fieldRecord.sections.record')}</SectionLabel>

        {fromAnswer ? (
          <Text testID="record-from-answer" style={[styles.origin, { color: theme.muted }]}>
            {t('fieldRecord.fromAnswer')}
          </Text>
        ) : null}

        <Field label={t('fieldRecord.basis')} hint={t(`fieldRecord.basisHint.${draft.basis}`)}>
          <ChoiceGrid>
            {BASES.map((basis) => (
              <ChoiceTile
                key={basis}
                testID={`record-basis-${basis}`}
                icon={BASIS_ICONS[basis] ?? 'record'}
                label={t(`fieldRecord.bases.${basis}`)}
                selected={draft.basis === basis}
                disabled={readOnly}
                onPress={() => update({ basis })}
              />
            ))}
          </ChoiceGrid>
        </Field>

        <Field label={t('fieldRecord.vernacularName')} hint={t('fieldRecord.vernacularNameHint')}>
          {input('vernacularName')}
        </Field>

        <Field
          label={t('fieldRecord.collectionNumber')}
          hint={t('fieldRecord.collectionNumberHint')}
        >
          {input('collectionNumber', { autoCapitalize: 'none' })}
        </Field>

        {/*
          Right after what the record is: for an observation the photograph is
          the evidence itself, and it is often the first thing captured. Then a
          voice note, for the name as it was said or what was told about the
          plant. Keeping either stores the record if nothing else has yet.
        */}
        <MediaSection
          fieldRecordId={clientId}
          ensureFieldRecord={ensureStored}
          readOnly={readOnly}
        />

        <AudioRecorder
          fieldRecordId={clientId}
          ensureFieldRecord={ensureStored}
          readOnly={readOnly}
        />

        <SectionLabel>{t('fieldRecord.sections.place')}</SectionLabel>

        <Field label={t('fieldRecord.collector')}>
          {input('collector', { autoCapitalize: 'words' })}
        </Field>

        <Field label={t('fieldRecord.collectedOn')}>
          <DateField
            itemId="record-collected-on"
            value={draft.collectedOn}
            placeholder={t('interview.datePlaceholder')}
            onChange={(collectedOn) => update({ collectedOn })}
          />
        </Field>

        <Field label={t('fieldRecord.locality')}>{input('locality')}</Field>

        <Field label={t('fieldRecord.coordinates')}>
          <View style={[styles.place, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View
              style={[
                styles.placeIcon,
                { backgroundColor: draft.location ? theme.successSoft : theme.neutralSoft },
              ]}
            >
              <Icon
                name="location"
                color={draft.location ? theme.success : theme.muted}
                size={22}
              />
            </View>
            <Text
              testID="record-coordinates"
              style={[
                styles.value,
                { color: draft.location ? theme.text : theme.muted },
                draft.location ? styles.coordinates : null,
              ]}
            >
              {draft.location
                ? `${draft.location.lat.toFixed(5)}, ${draft.location.lng.toFixed(5)}`
                : locating
                  ? t('fieldRecord.locating')
                  : locationFailed
                    ? t('fieldRecord.locationFailed')
                    : t('fieldRecord.noCoordinates')}
            </Text>
          </View>
          {readOnly ? null : (
            <Button
              testID="record-locate"
              variant="ghost"
              icon="location"
              label={t(draft.location ? 'fieldRecord.relocate' : 'fieldRecord.locate')}
              busy={locating}
              disabled={locating}
              onPress={locate}
            />
          )}
        </Field>

        <SectionLabel>{t('fieldRecord.sections.permit')}</SectionLabel>

        <Field
          label={t('fieldRecord.permit')}
          hint={permits.length === 0 && !unlistedPermit ? t('fieldRecord.noPermits') : undefined}
        >
          {permits.length > 0 || unlistedPermit ? (
            <ChipGroup>
              {permits.map((permit) => (
                <Chip
                  key={permit.id}
                  testID={`record-permit-${permit.id}`}
                  label={permitLabel(permit) || t('fieldRecord.permitUnnamed')}
                  selected={draft.permitId === permit.id}
                  disabled={readOnly}
                  // Choosing a permit clears the exemption: a record carries
                  // one or the other, and the server refuses the pair.
                  onPress={() =>
                    update(
                      draft.permitId === permit.id
                        ? { permitId: null }
                        : { permitId: permit.id, exemption: null }
                    )
                  }
                />
              ))}
              {unlistedPermit ? (
                <Chip
                  testID="record-permit-unlisted"
                  label={t('fieldRecord.permitUnlisted')}
                  selected
                  disabled={readOnly}
                  onPress={() => update({ permitId: null })}
                />
              ) : null}
            </ChipGroup>
          ) : null}
        </Field>

        <Field label={t('fieldRecord.exemption')} hint={t('fieldRecord.exemptionHint')}>
          <ChipGroup>
            {EXEMPTIONS.map((reason) => (
              <Chip
                key={reason}
                testID={`record-exemption-${reason}`}
                label={t(`fieldRecord.exemptions.${reason}`)}
                selected={draft.exemption === reason}
                disabled={readOnly}
                onPress={() =>
                  update(
                    draft.exemption === reason
                      ? { exemption: null }
                      : { exemption: reason, permitId: null }
                  )
                }
              />
            ))}
          </ChipGroup>
        </Field>

        <SectionLabel>{t('fieldRecord.sections.notes')}</SectionLabel>

        <Field label={t('fieldRecord.notes')}>
          {input('notes', { multiline: true, maxLength: undefined })}
        </Field>
      </View>

      {readOnly ? null : (
        <Text testID="record-save-state" style={[styles.saved, { color: theme.muted }]}>
          {saving
            ? t('fieldRecord.saving')
            : stored
              ? t('fieldRecord.savedLocally')
              : t('fieldRecord.notSavedYet')}
        </Text>
      )}

      <Button
        testID="record-done"
        label={t('fieldRecord.done')}
        onPress={() => navigation.goBack()}
        style={styles.done}
      />

      {discardable ? (
        <Button
          testID="record-discard"
          variant="destructive"
          label={t('fieldRecord.discard')}
          onPress={confirmDiscard}
          style={styles.discard}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: space.lg,
    paddingBottom: space.xxl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    marginBottom: space.xl,
  },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md + 2,
    borderWidth: border.width,
    borderRadius: radius.card,
  },
  placeIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...type.body,
    flex: 1,
  },
  coordinates: {
    fontWeight: '800',
  },
  origin: {
    ...type.caption,
    marginBottom: space.md,
  },
  saved: {
    ...type.caption,
    textAlign: 'center',
    marginTop: space.sm,
  },
  done: {
    marginTop: space.lg,
  },
  discard: {
    marginTop: space.md,
    alignSelf: 'center',
  },
});
