import {
  Book,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock,
  CloudCheck,
  Eye,
  FileCheck,
  FileText,
  Folder,
  Hash,
  Image,
  Info,
  Leaf,
  Lock,
  LogOut,
  MapPin,
  Mic,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Scissors,
  Sprout,
  Square,
  Trash,
  Upload,
  User,
  WifiOff,
  type LucideIcon,
} from 'lucide-react-native';

/**
 * The app's icons, by what they mean here rather than what they depict, so a
 * screen asks for `record` and not for a leaf. One stroke style throughout,
 * the same family the web's design uses.
 */
const ICONS = {
  interview: Mic,
  record: Leaf,
  send: Upload,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  sync: RefreshCw,
  location: MapPin,
  camera: Camera,
  check: Check,
  waiting: Clock,
  form: FileText,
  add: Plus,
  play: Play,
  pause: Pause,
  stop: Square,
  info: Info,
  alert: CircleAlert,
  offline: WifiOff,
  synced: CloudCheck,
  observed: Eye,
  living: Sprout,
  specimen: Book,
  sample: Scissors,
  encrypted: Lock,
  number: Hash,
  photo: Image,
  person: User,
  signOut: LogOut,
  project: Folder,
  permit: FileCheck,
  date: Calendar,
  discard: Trash,
} satisfies Record<string, LucideIcon>;

/** Drawn solid rather than outlined: playback controls read better filled. */
const FILLED = new Set<IconName>(['play', 'pause', 'stop']);

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  color: string;
  size?: number;
  strokeWidth?: number;
  testID?: string;
}

export function Icon({ name, color, size = 20, strokeWidth = 2, testID }: Props) {
  const Glyph = ICONS[name];

  return (
    <Glyph
      testID={testID}
      color={color}
      size={size}
      strokeWidth={strokeWidth}
      fill={FILLED.has(name) ? color : 'none'}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
