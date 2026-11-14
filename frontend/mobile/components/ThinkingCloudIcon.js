import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';

/**
 * ThinkingCloudIcon
 *
 * Custom SVG vector icon of a thinking cloud with trailing thought bubbles
 * and a subtle question mark in Pantrix brand styling (#990808 crimson accent).
 */
export default function ThinkingCloudIcon({
  width = 28,
  height = 28,
  primaryColor = '#990808',
  cloudBg = '#FBF9F6',
  accentColor = '#E6E279',
  bubbleColor = '#94B6EF',
  style,
}) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 128 128"
      style={style}
    >
      <G>
        {/* Background Soft Glow */}
        <Path
          fill={bubbleColor}
          opacity={0.35}
          d="M38 24c-12 0-22 9-22 21 0 5 2 10 5 14-3 3-5 8-5 13 0 11 9 20 21 20h50c14 0 26-11 26-24 0-9-5-17-13-21 1-2 1-5 1-7 0-14-12-25-26-25-4 0-8 1-12 3-5-6-13-10-21-10-1 0-3 0-4 1z"
        />

        {/* Main Thought Cloud Body */}
        <Path
          fill={cloudBg}
          stroke={primaryColor}
          strokeWidth="4.5"
          strokeLinejoin="round"
          d="M42 28c-11 0-20 8-20 19 0 4 2 8 4 12-3 3-5 7-5 12 0 10 9 18 20 18h46c13 0 24-10 24-22 0-8-5-16-12-20 1-2 1-5 1-7 0-13-11-23-24-23-4 0-8 1-11 3-5-6-12-9-19-9-2 0-3 0-5 1z"
        />

        {/* Question Mark in Thought Cloud */}
        <Path
          fill={primaryColor}
          d="M60 44c0-5.5 4.5-10 10-10s10 4.5 10 10c0 4.2-3 6.8-5.5 8.8-2.2 1.8-4.5 3.7-4.5 6.7v1.5h-7v-2c0-4.8 2.8-7.2 5.5-9.2 2-1.5 4.5-3.5 4.5-5.8 0-2.2-1.8-4-4-4s-4 1.8-4 4H60zm3 24.5h8v8h-8z"
        />

        {/* Trailing Thought Bubbles */}
        <Circle
          fill={accentColor}
          stroke={primaryColor}
          strokeWidth="3"
          cx="32"
          cy="100"
          r="10"
        />
        <Circle
          fill={bubbleColor}
          stroke={primaryColor}
          strokeWidth="2.5"
          cx="19"
          cy="113"
          r="6"
        />
      </G>
    </Svg>
  );
}

