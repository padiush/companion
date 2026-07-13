import Svg, { Rect } from 'react-native-svg';

interface IconProps {
  color: string;
  size: number;
}

/** Projects — a grid, standing for the set of projects to record in. */
export function ProjectsIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" testID="tab-icon-projects">
      <Rect x="3" y="3" width="8" height="8" rx="2" fill={color} />
      <Rect x="13" y="3" width="8" height="8" rx="2" fill={color} />
      <Rect x="3" y="13" width="8" height="8" rx="2" fill={color} />
      <Rect x="13" y="13" width="8" height="8" rx="2" fill={color} />
    </Svg>
  );
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
