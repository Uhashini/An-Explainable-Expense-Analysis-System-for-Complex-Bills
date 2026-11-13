import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { FONTS } from '../theme';

/**
 * PriceDeviationBarChart
 * 
 * Reusable Grouped Bar Chart matching the reference UI mockup:
 * - Top legend: "Your Price" (Crimson #8B0000) vs "Market Avg" (Periwinkle Blue #9BB5F0)
 * - Horizontal gridlines at 0, 100, 200, 300, 400
 * - Paired bars for items comparing receipt price vs market benchmark
 * - X-axis item labels
 */
export default function PriceDeviationBarChart({
  items = [],
  chartHeight = 220,
}) {
  // Fallback items if receipt has empty price deviation data
  const chartItems = items.length > 0 ? items.slice(0, 3) : [
    { name: 'Milk', yourPrice: 280, marketAvg: 335 },
    { name: 'Olive Oil', yourPrice: 260, marketAvg: 370 },
    { name: 'Bread', yourPrice: 220, marketAvg: 290 },
  ];

  const maxVal = Math.max(
    400,
    ...chartItems.map((it) => Math.max(it.yourPrice || it.current_price || 0, it.marketAvg || it.historical_average || 350))
  );

  const roundedMax = Math.ceil(maxVal / 100) * 100;
  const gridTicks = [0, roundedMax * 0.25, roundedMax * 0.5, roundedMax * 0.75, roundedMax];

  const svgWidth = 320;
  const svgHeight = chartHeight;
  const chartTop = 20;
  const chartBottom = svgHeight - 35;
  const plotHeight = chartBottom - chartTop;
  const leftMargin = 38;
  const rightMargin = 16;
  const plotWidth = svgWidth - leftMargin - rightMargin;

  const groupWidth = plotWidth / chartItems.length;
  const barWidth = Math.min(22, groupWidth * 0.32);
  const barGap = 4;

  return (
    <View style={styles.container}>
      {/* ── Top Legend ── */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: '#8B0000' }]} />
          <Text style={styles.legendText}>Your Price</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: '#9BB5F0' }]} />
          <Text style={styles.legendText}>Market Avg</Text>
        </View>
      </View>

      {/* ── SVG Grouped Bar Chart ── */}
      <View style={styles.chartWrapper}>
        <Svg width="100%" height={chartHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          {/* Horizontal Gridlines & Y-Axis Labels */}
          {gridTicks.map((tick, i) => {
            const y = chartBottom - (tick / roundedMax) * plotHeight;
            return (
              <G key={`grid-${i}`}>
                <Line
                  x1={leftMargin}
                  y1={y}
                  x2={svgWidth - rightMargin}
                  y2={y}
                  stroke="#EAE6DC"
                  strokeWidth="1"
                />
                <SvgText
                  x={leftMargin - 8}
                  y={y + 4}
                  fill="#7A7265"
                  fontSize="10"
                  fontFamily="System"
                  textAnchor="end"
                >
                  {Math.round(tick)}
                </SvgText>
              </G>
            );
          })}

          {/* Grouped Bars */}
          {chartItems.map((item, idx) => {
            const yourPrice = item.yourPrice ?? item.current_price ?? item.price ?? 250;
            const marketAvg = item.marketAvg ?? item.historical_average ?? item.market_price ?? 300;
            const itemName = item.name || item.item_name || `Item ${idx + 1}`;

            const groupCenterX = leftMargin + idx * groupWidth + groupWidth / 2;
            const yourBarX = groupCenterX - barWidth - barGap / 2;
            const marketBarX = groupCenterX + barGap / 2;

            const yourBarHeight = Math.max(4, (yourPrice / roundedMax) * plotHeight);
            const marketBarHeight = Math.max(4, (marketAvg / roundedMax) * plotHeight);

            const yourBarY = chartBottom - yourBarHeight;
            const marketBarY = chartBottom - marketBarHeight;

            return (
              <G key={`bar-group-${idx}`}>
                {/* Your Price Bar (Crimson) */}
                <Rect
                  x={yourBarX}
                  y={yourBarY}
                  width={barWidth}
                  height={yourBarHeight}
                  fill="#8B0000"
                  rx="3"
                />

                {/* Market Avg Bar (Periwinkle Blue) */}
                <Rect
                  x={marketBarX}
                  y={marketBarY}
                  width={barWidth}
                  height={marketBarHeight}
                  fill="#9BB5F0"
                  rx="3"
                />

                {/* X-Axis Item Label */}
                <SvgText
                  x={groupCenterX}
                  y={chartBottom + 18}
                  fill="#1A1816"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="System"
                  textAnchor="middle"
                >
                  {itemName.length > 9 ? itemName.slice(0, 8) + '…' : itemName}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#4A443B',
  },
  chartWrapper: {
    width: '100%',
    alignItems: 'center',
  },
});

