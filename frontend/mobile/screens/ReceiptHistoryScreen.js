import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator
} from 'react-native';
import ScreenLayout from '../components/ScreenLayout';
import { COLORS, FONTS } from '../theme';
import { API_BASE_URL } from '../utils/apiConfig';
import { getUser } from '../utils/authStorage';

const CATEGORIES = ['All', 'Grocery', 'Fruits', 'Vegetables', 'Dairy', 'Snacks'];

function ReceiptCard({ receipt, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardIcon}>
        <Text style={styles.cardTag}>{receipt.tag}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardStore}>{receipt.store}</Text>
        <Text style={styles.cardDate}>{receipt.date}</Text>
        <Text style={styles.cardItems}>{receipt.items} items</Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.cardAmount}>{receipt.amount}</Text>
        <Text style={styles.cardArrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ReceiptHistoryScreen({ navigation }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReceipts = async () => {
      try {
        const user = await getUser();
        const userId = user?.id || user?.user_id;

        if (!userId) {
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/receipts/user/${userId}`);
        const data = await response.json();

        if (response.ok && data.status === 'success') {
          const formatted = data.receipts.map(r => ({
            id: r.receipt_id,
            store: r.merchant_name,
            tag: r.merchant_name ? r.merchant_name.substring(0, 2).toUpperCase() : 'RC',
            date: r.date,
            amount: `₹${parseFloat(r.total_amount).toFixed(2)}`,
            items: r.items_count,
          }));
          setReceipts(formatted);
        }
      } catch (error) {
        console.error("Error fetching receipts:", error);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = navigation.addListener('focus', () => {
      fetchReceipts();
    });

    return unsubscribe;
  }, [navigation]);

  const filtered = receipts.filter((r) =>
    r.store && r.store.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ScreenLayout title="Receipt History">
      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchIconBox}>
            <Text style={styles.searchIconText}>Q</Text>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by store or item..."
            placeholderTextColor={COLORS.placeholder}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterChip, category === cat && styles.filterChipActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.filterText, category === cat && styles.filterTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* List */}
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : filtered.length > 0 ? (
            filtered.map((r) => (
              <ReceiptCard
                key={r.id}
                receipt={r}
                onPress={() => navigation.navigate('ReceiptDetails', { receiptId: r.id })}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <Text style={styles.emptyIconText}>REC</Text>
              </View>
              <Text style={styles.emptyTitle}>No receipts found.</Text>
              <Text style={styles.emptyText}>
                Start scanning receipts to build your shopping history.
              </Text>
            </View>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(148, 182, 239, 0.35)',
  },
  searchIconBox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  searchIconText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#fff',
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#3a2020',
  },
  clearIcon: {
    fontSize: 14,
    color: COLORS.mutedText,
    padding: 4,
  },

  // Filters
  filtersRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ede8e0',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.mutedText,
    letterSpacing: 0.3,
  },
  filterTextActive: {
    color: '#fff',
  },

  // Cards
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardTag: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#fff',
    letterSpacing: 1,
  },
  cardInfo: { flex: 1 },
  cardStore: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.primary,
    marginBottom: 3,
  },
  cardDate: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.55)',
    marginBottom: 2,
  },
  cardItems: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.4)',
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  cardAmount: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.primary,
  },
  cardArrow: {
    fontSize: 22,
    color: COLORS.inputBorder,
    fontWeight: '300',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIconText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#fff',
    letterSpacing: 1.5,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.primary,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.mutedText,
    textAlign: 'center',
    lineHeight: 20,
  },
});
