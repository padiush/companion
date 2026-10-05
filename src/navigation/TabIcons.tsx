import Svg, { Path, Rect } from 'react-native-svg';

interface IconProps {
  color: string;
  size: number;
}

/** Interviews — a document with lines, standing for recorded interviews. */
export function InterviewsIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" testID="tab-icon-interviews">
      <Rect x="4" y="3" width="16" height="18" rx="2.5" fill={color} opacity={0.25} />
      <Rect x="7.5" y="7" width="9" height="2" rx="1" fill={color} />
      <Rect x="7.5" y="11" width="9" height="2" rx="1" fill={color} />
      <Rect x="7.5" y="15" width="5.5" height="2" rx="1" fill={color} />
    </Svg>
  );
}

/** Field records — a leaf, standing for what was documented in the field. */
export function RecordsIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" testID="tab-icon-records">
      <Path
        d="M20 4C11 4 5 8.5 5 15c0 1.6.4 3 1.1 4.2L4.3 21l1.4 1.4 1.9-1.9C8.8 21.5 10.3 22 12 22c6.6 0 8-9 8-18z"
        fill={color}
        opacity={0.25}
      />
      <Path
        d="M16 8c-3.5 2-6.5 5.5-8.5 11"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Outbox — a tray with an arrow leaving it, standing for what is to send. */
export function OutboxIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" testID="tab-icon-outbox">
      <Path
        d="M3 13h5l1.5 3h5L16 13h5v5.5A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5z"
        fill={color}
        opacity={0.25}
      />
      <Path
        d="M12 3v9M8 7l4-4 4 4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
