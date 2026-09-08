import { StyleSheet, Platform } from 'react-native';
import { COLORS, FONTS } from '../../theme';

const styles = StyleSheet.create({
  // ── Layout Wrappers ──
  container: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: '#FAF8F5',
  },
  maxWidthWrapper: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
  },
  contentContainer: {
    gap: 16,
  },

  // ── Header Ribbon / Purpose Card ──
  purposeCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(153, 8, 8, 0.06)',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  purposeBadge: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    letterSpacing: 1.2,
  },
  subBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  subBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  purposeTitle: {
    fontFamily: FONTS.bold,
    fontSize: 19,
    color: '#2B1212',
    marginBottom: 6,
    lineHeight: 24,
  },
  purposeDesc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
    lineHeight: 18,
    marginBottom: 4,
  },
  purposeSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
    lineHeight: 18,
    marginBottom: 4,
  },

  // ── Quick KPI Stat Ribbon (3 Metric Cards) ──
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    width: '100%',
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FAF8F5',
    borderRadius: 14,
    padding: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(153, 8, 8, 0.06)',
  },
  metricCardTop: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIcon: {
    fontSize: 16,
  },
  rdiBadge: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#1976D2',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metricValue: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.primary,
    marginBottom: 2,
  },
  metricUnit: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.mutedText,
  },
  metricLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.mutedText,
  },

  // ── Unified Card / Section Wrapper ──
  insightItemExtravagant: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(153, 8, 8, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  insightHeaderExtravagant: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F5F6FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightTitleExtravagant: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#2B1212',
    flexShrink: 1,
  },
  sectionSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#7F8C8D',
    marginTop: 3,
    lineHeight: 15,
  },
  subSectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
  insightDescExtravagant: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#4A3B32',
    lineHeight: 17,
  },
  insightDesc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
    lineHeight: 17,
  },

  // ── Empty & Loading States ──
  emptyStateBox: {
    backgroundColor: '#FAF8F5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#EFEBE9',
  },
  emptyStateIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  smLoadingBox: {
    backgroundColor: '#FAF8F5',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  smLoadingText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
  },

  // ── Highlight Banners ──
  smHighlightBanner: {
    backgroundColor: 'rgba(25, 118, 210, 0.08)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  smHighlightLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#1976D2',
    marginBottom: 2,
  },
  smHighlightValue: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#2B1212',
  },

  // ── SM-01 Category Breakdown Styles ──
  smCategoryList: {
    gap: 10,
  },
  smCategoryRow: {
    gap: 4,
  },
  smCategoryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smCategoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  smCategoryName: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#2B1212',
    flexShrink: 1,
  },
  smCategoryAmount: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
  },
  smCatBarBg: {
    height: 6,
    backgroundColor: '#ECEFF1',
    borderRadius: 3,
    overflow: 'hidden',
  },
  smCatBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // ── SM-02 Item-Wise Ranked Breakdown ──
  smRankedList: {
    gap: 8,
  },
  smRankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#FAF8F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F0EAE1',
  },
  smRankBadge: {
    width: 24,
    height: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  smRankBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#fff',
  },
  smRankedName: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#2B1212',
  },
  smRankedPrice: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
  },

  // ── SM-03 Budget Utilization & Goals ──
  smEditBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  smEditBudgetBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#2E7D32',
  },
  smBudgetEditorBox: {
    backgroundColor: '#F9FBE7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DCEDC8',
  },
  smBudgetEditorLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#33691E',
    marginBottom: 4,
  },
  smBudgetInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C5E1A5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#2B1212',
  },
  smBudgetApplyBtn: {
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  smBudgetApplyBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#fff',
  },
  smBudgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
    gap: 12,
  },
  smGaugeInside: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smGaugePct: {
    fontFamily: FONTS.bold,
    fontSize: 22,
  },
  smGaugeSubLabel: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: '#7F8C8D',
    marginTop: -2,
  },
  smBudgetStats: {
    flex: 1,
    gap: 8,
  },
  smBudgetStatItem: {
    backgroundColor: '#FAF8F5',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0EAE1',
  },
  smStatLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.mutedText,
    marginBottom: 1,
  },
  smStatValue: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#2B1212',
  },
  smStatusBanner: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  smStatusBannerText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },

  // ── SM-04 Spending Trend & STL ──
  gaugeCenterText: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugePercentage: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    letterSpacing: -0.5,
  },
  gaugeLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#7F8C8D',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 4,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#636E72',
  },

  // ── SM-06 Anomaly Detection & SHAP ──
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    gap: 8,
  },
  summaryBannerIcon: {
    fontSize: 16,
  },
  summaryBannerText: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  shapExplanation: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#636E72',
    marginBottom: 8,
    lineHeight: 15,
  },
  shapRow: {
    marginBottom: 8,
    backgroundColor: '#FAF8F5',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0EAE1',
  },
  shapTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  shapCategoryName: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#2D3748',
  },
  shapPctValue: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#4A5568',
  },
  shapProgressBg: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  shapProgressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // ── SM-07 Purchase Frequency & Staples ──
  staplesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stapleCard: {
    width: '48%',
    backgroundColor: '#F0F7FF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#D0E4FF',
  },
  stapleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stapleName: {
    flex: 1,
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#0D47A1',
    marginRight: 4,
  },
  stapleBadge: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  stapleBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#fff',
  },
  stapleMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stapleRateText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#1565C0',
  },
  stapleCategoryText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#64748B',
    maxWidth: '45%',
  },
  freqTable: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  freqTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#EDF2F7',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  freqHeadText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#4A5568',
  },
  freqTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
  },
  freqColName: {
    flex: 2,
  },
  freqColCount: {
    flex: 1,
    textAlign: 'center',
  },
  freqColRate: {
    flex: 1,
    textAlign: 'right',
  },
  freqItemText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#2D3748',
  },
  freqValueText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#4A5568',
  },
  freqRateText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#1976D2',
  },
});

export default styles;
