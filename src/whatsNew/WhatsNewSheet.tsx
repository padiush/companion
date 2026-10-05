import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { ReleaseNotes } from './ReleaseNotes';
import { currentVersion, releasesSince } from './releases';

interface Props {
  /** The last release seen; the notes after it are shown. */
  since: string;
  onDismiss: () => void;
}

/**
 * "What's new?", once, after an update: the notes of every release since the
 * last one seen on this device. Closing it — the button, a tap outside it or
 * the system back gesture — counts as seen. A release that shipped without
 * notes is marked seen without showing anything.
 */
export function WhatsNewSheet({ since, onDismiss }: Props) {
  const { t } = useTranslation();

  const releases = releasesSince(
    t('whatsNew.releases', { returnObjects: true }),
    since,
    currentVersion()
  );

  const empty = releases.length === 0;

  useEffect(() => {
    if (empty) {
      onDismiss();
    }
  }, [empty, onDismiss]);

  if (empty) {
    return null;
  }

  return (
    <Sheet
      testID="whats-new"
      visible
      title={t('whatsNew.title')}
      intro={t('whatsNew.intro')}
      onClose={onDismiss}
      footer={<Button testID="whats-new-dismiss" label={t('whatsNew.gotIt')} onPress={onDismiss} />}
    >
      <ReleaseNotes releases={releases} />
    </Sheet>
  );
}
