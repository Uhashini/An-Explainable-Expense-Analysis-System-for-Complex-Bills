import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme';
import { API_BASE_URL } from '../utils/apiConfig';
import { getUser } from '../utils/authStorage';
import { showNotification } from '../utils/alertHelper';

const QUICK_STORES = ['DMart', 'Reliance Fresh', "Nature's Basket", 'More', 'Blinkit', 'Local Vendor'];

function getTodayFormatted() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayFormatted() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ManualReceiptModal({ visible, onClose, onReceiptAdded }) {
  const [storeName, setStoreName] = useState('');
  const [receiptDate, setReceiptDate] = useState(getTodayFormatted());
  const [items, setItems] = useState([
    { id: '1', name: '', quantity: '1', price: '' },
  ]);
  const [customTotal, setCustomTotal] = useState('');
  const [isManualTotal, setIsManualTotal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setStoreName('');
      setReceiptDate(getTodayFormatted());
      setItems([{ id: '1', name: '', quantity: '1', price: '' }]);
      setCustomTotal('');
      setIsManualTotal(false);
      setIsSaving(false);
      setShowPreview(true);
    }
  }, [visible]);

  // Compute calculated subtotal from items
  const calculatedTotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const p = parseFloat(it.price);
      return sum + (isNaN(p) || p < 0 ? 0 : p);
    }, 0);
  }, [items]);

  const effectiveTotal = isManualTotal && customTotal.trim() !== ''
    ? (parseFloat(customTotal) || 0)
    : calculatedTotal;

  // Add a new empty item row
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: String(Date.now() + Math.random()), name: '', quantity: '1', price: '' },
    ]);
  };

  // Remove an item row
  const handleRemoveItem = (id) => {
    if (items.length <= 1) {
      // Keep at least one row, just clear its fields
      setItems([{ id: '1', name: '', quantity: '1', price: '' }]);
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Update item field
  const handleUpdateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          return { ...it, [field]: value };
        }
        return it;
      })
    );
  };

  // Save the manual receipt
  const handleSave = async () => {
    const cleanStore = storeName.trim();
    if (!cleanStore) {
      showNotification('Missing Store Name', 'Please enter a store or merchant name.');
      return;
    }

    const validItems = items.filter((it) => it.name.trim().length > 0);
    if (validItems.length === 0) {
      showNotification('Missing Items', 'Please add at least one item with a name.');
      return;
    }

    if (effectiveTotal <= 0) {
      showNotification('Invalid Total', 'Please enter prices for the items or specify a total amount.');
      return;
    }

    setIsSaving(true);

    try {
      const user = await getUser();
      const userId = user?.id || user?.user_id || 1;

      const payload = {
        user_id: userId,
        merchant_name: cleanStore,
        date: receiptDate.trim() || getTodayFormatted(),
        total_amount: parseFloat(effectiveTotal.toFixed(2)),
        items: validItems.map((it) => {
          const itemPrice = parseFloat(it.price) || 0;
          return {
            name: it.name.trim(),
            quantity: it.quantity.trim() || '1',
            rate: String(itemPrice.toFixed(2)),
            price: String(itemPrice.toFixed(2)),
          };
        }),
      };

      const response = await fetch(`${API_BASE_URL}/receipts/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (response.ok && resData.status === 'success') {
        const newReceipt = {
          id: resData.receipt_id,
          store: cleanStore,
          tag: cleanStore.substring(0, 2).toUpperCase(),
          date: payload.date,
          amount: `₹${payload.total_amount.toFixed(2)}`,
          items: validItems.length,
        };

        if (onReceiptAdded) {
          onReceiptAdded(newReceipt);
        }

        showNotification('Receipt Added', `Manual receipt for ${cleanStore} (₹${payload.total_amount.toFixed(2)}) has been added.`);
        onClose();
      } else {
        showNotification('Save Failed', resData.detail || 'Could not save the receipt. Please try again.');
      }
    } catch (err) {
      console.error('Error saving manual receipt:', err);
      showNotification('Connection Error', 'Could not reach server to save receipt. Please ensure your backend is running.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.headerIcon}>
                <Feather name="file-plus" size={18} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.modalTitle}>Add Receipt Manually</Text>
                <Text style={styles.modalSubtitle}>Type details & preview formatted receipt</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Store Name Section */}
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>STORE / MERCHANT NAME *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. DMart, Reliance Fresh, Local Grocer"
                placeholderTextColor={COLORS.placeholder}
                value={storeName}
                onChangeText={setStoreName}
              />
              {/* Quick store suggestion pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickPillsRow}>
                {QUICK_STORES.map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[styles.quickPill, storeName === st && styles.quickPillActive]}
                    onPress={() => setStoreName(st)}
                  >
                    <Text style={[styles.quickPillText, storeName === st && styles.quickPillTextActive]}>
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Date Section */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>RECEIPT DATE</Text>
                <View style={styles.dateChipsRow}>
                  <TouchableOpacity
                    style={[styles.dateChip, receiptDate === getTodayFormatted() && styles.dateChipActive]}
                    onPress={() => setReceiptDate(getTodayFormatted())}
                  >
                    <Text style={[styles.dateChipText, receiptDate === getTodayFormatted() && styles.dateChipTextActive]}>
                      Today
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateChip, receiptDate === getYesterdayFormatted() && styles.dateChipActive]}
                    onPress={() => setReceiptDate(getYesterdayFormatted())}
                  >
                    <Text style={[styles.dateChipText, receiptDate === getYesterdayFormatted() && styles.dateChipTextActive]}>
                      Yesterday
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.placeholder}
                value={receiptDate}
                onChangeText={setReceiptDate}
              />
            </View>

            {/* Line Items Section */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>ITEMS & PRICES ({items.length}) *</Text>
                <TouchableOpacity onPress={handleAddItem} style={styles.addItemHeaderBtn}>
                  <Feather name="plus-circle" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.addItemHeaderText}>Add Item</Text>
                </TouchableOpacity>
              </View>

              {items.map((it, idx) => (
                <View key={it.id} style={styles.itemRowCard}>
                  <View style={styles.itemIndexBox}>
                    <Text style={styles.itemIndexText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.itemInputsCol}>
                    <TextInput
                      style={styles.itemNameInput}
                      placeholder="Item name (e.g. Milk 1L, Bananas)"
                      placeholderTextColor={COLORS.placeholder}
                      value={it.name}
                      onChangeText={(val) => handleUpdateItem(it.id, 'name', val)}
                    />
                    <View style={styles.itemQtyPriceRow}>
                      <TextInput
                        style={styles.itemQtyInput}
                        placeholder="Qty (e.g. 1)"
                        placeholderTextColor={COLORS.placeholder}
                        value={it.quantity}
                        onChangeText={(val) => handleUpdateItem(it.id, 'quantity', val)}
                      />
                      <View style={styles.priceInputWrapper}>
                        <Text style={styles.rupeeSymbol}>₹</Text>
                        <TextInput
                          style={styles.itemPriceInput}
                          placeholder="0.00"
                          placeholderTextColor={COLORS.placeholder}
                          keyboardType="decimal-pad"
                          value={it.price}
                          onChangeText={(val) => handleUpdateItem(it.id, 'price', val)}
                        />
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.itemDeleteBtn}
                    onPress={() => handleRemoveItem(it.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="trash-2" size={16} color="#C62828" />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.addMoreBtn} onPress={handleAddItem} activeOpacity={0.7}>
                <Feather name="plus" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={styles.addMoreBtnText}>Add Another Item</Text>
              </TouchableOpacity>
            </View>

            {/* Total Section */}
            <View style={styles.totalSectionCard}>
              <View style={styles.totalRowHeader}>
                <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
                <TouchableOpacity
                  onPress={() => {
                    setIsManualTotal(!isManualTotal);
                    if (!isManualTotal) {
                      setCustomTotal(calculatedTotal > 0 ? calculatedTotal.toFixed(2) : '');
                    }
                  }}
                >
                  <Text style={styles.overrideLink}>
                    {isManualTotal ? 'Auto-sum items' : 'Edit total manually'}
                  </Text>
                </TouchableOpacity>
              </View>

              {isManualTotal ? (
                <View style={styles.manualTotalInputWrap}>
                  <Text style={styles.manualTotalRupee}>₹</Text>
                  <TextInput
                    style={styles.manualTotalInput}
                    keyboardType="decimal-pad"
                    value={customTotal}
                    onChangeText={setCustomTotal}
                    placeholder={calculatedTotal.toFixed(2)}
                  />
                </View>
              ) : (
                <Text style={styles.totalValueDisplay}>₹{calculatedTotal.toFixed(2)}</Text>
              )}
            </View>

            {/* Toggle Preview Button */}
            <TouchableOpacity
              style={styles.previewToggleRow}
              onPress={() => setShowPreview(!showPreview)}
              activeOpacity={0.7}
            >
              <Feather name={showPreview ? 'eye-off' : 'eye'} size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.previewToggleText}>
                {showPreview ? 'Hide Formatted Receipt Preview' : 'Show Formatted Receipt Preview'}
              </Text>
            </TouchableOpacity>

            {/* Authentic Formatted Paper Receipt Preview */}
            {showPreview && (
              <View style={styles.paperReceipt}>
                <View style={styles.receiptJaggedTop} />
                <View style={styles.receiptInner}>
                  {/* Store Header */}
                  <Text style={styles.receiptStoreName}>
                    {storeName.trim() ? storeName.trim().toUpperCase() : 'STORE NAME'}
                  </Text>
                  <Text style={styles.receiptSubHeader}>TAX INVOICE / GROCERY RECEIPT</Text>
                  <Text style={styles.receiptDateLine}>Date: {receiptDate}  •  Manual Entry</Text>

                  {/* Dashed line */}
                  <View style={styles.dashedLine} />

                  {/* Items header */}
                  <View style={styles.receiptItemHeaderRow}>
                    <Text style={[styles.receiptHeaderCol, { flex: 2 }]}>ITEM</Text>
                    <Text style={[styles.receiptHeaderCol, { width: 50, textAlign: 'center' }]}>QTY</Text>
                    <Text style={[styles.receiptHeaderCol, { width: 70, textAlign: 'right' }]}>PRICE</Text>
                  </View>

                  <View style={styles.dashedLine} />

                  {/* Items list */}
                  {items.filter((it) => it.name.trim()).length > 0 ? (
                    items
                      .filter((it) => it.name.trim())
                      .map((it, i) => {
                        const p = parseFloat(it.price) || 0;
                        return (
                          <View key={it.id || i} style={styles.receiptLineRow}>
                            <Text style={[styles.receiptItemName, { flex: 2 }]} numberOfLines={1}>
                              {it.name.trim()}
                            </Text>
                            <Text style={[styles.receiptItemQty, { width: 50, textAlign: 'center' }]}>
                              {it.quantity || '1'}
                            </Text>
                            <Text style={[styles.receiptItemPrice, { width: 70, textAlign: 'right' }]}>
                              ₹{p.toFixed(2)}
                            </Text>
                          </View>
                        );
                      })
                  ) : (
                    <Text style={styles.emptyReceiptNote}>Items typed above will format here live...</Text>
                  )}

                  {/* Dashed line */}
                  <View style={styles.dashedLine} />

                  {/* Total row */}
                  <View style={styles.receiptTotalRow}>
                    <Text style={styles.receiptTotalLabel}>TOTAL</Text>
                    <Text style={styles.receiptTotalValue}>₹{effectiveTotal.toFixed(2)}</Text>
                  </View>

                  <Text style={styles.receiptFooterText}>THANK YOU FOR SHOPPING</Text>
                  <Text style={styles.receiptFooterSub}>Tracked with Pantrix Nutrition & Expense Engine</Text>
                </View>
                <View style={styles.receiptJaggedBottom} />
              </View>
            )}

            <View style={{ height: 30 }} />
          </ScrollView>

          {/* Bottom Actions */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSaving}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="check" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.saveBtnText}>Save Receipt</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FAF7F2',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#ede8e0',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(153, 8, 8, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.primary,
  },
  modalSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0EBE3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2DBD2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#222',
  },
  quickPillsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  quickPill: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2DBD2',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 6,
  },
  quickPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  quickPillText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#444',
  },
  quickPillTextActive: {
    color: '#fff',
    fontFamily: FONTS.bold,
  },
  dateChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dateChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2DBD2',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  dateChipActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  dateChipText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#555',
  },
  dateChipTextActive: {
    color: '#fff',
    fontFamily: FONTS.bold,
  },
  addItemHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addItemHeaderText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
  },
  itemRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2DBD2',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  itemIndexBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(153, 8, 8, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  itemIndexText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
  },
  itemInputsCol: {
    flex: 1,
    gap: 6,
  },
  itemNameInput: {
    backgroundColor: '#FAF7F2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#222',
    borderWidth: 1,
    borderColor: '#EDE5DC',
  },
  itemQtyPriceRow: {
    flexDirection: 'row',
    gap: 6,
  },
  itemQtyInput: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#222',
    borderWidth: 1,
    borderColor: '#EDE5DC',
  },
  priceInputWrapper: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    borderRadius: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#EDE5DC',
  },
  rupeeSymbol: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
    marginRight: 3,
  },
  itemPriceInput: {
    flex: 1,
    paddingVertical: 6,
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#222',
  },
  itemDeleteBtn: {
    padding: 8,
    marginLeft: 4,
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  addMoreBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
  totalSectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2DBD2',
  },
  totalRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  totalLabel: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.mutedText,
    letterSpacing: 1.2,
  },
  overrideLink: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  totalValueDisplay: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    color: COLORS.primary,
  },
  manualTotalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  manualTotalRupee: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.primary,
    marginRight: 4,
  },
  manualTotalInput: {
    flex: 1,
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    paddingVertical: 2,
  },
  previewToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 10,
  },
  previewToggleText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
  },
  // Authentic paper receipt preview styling
  paperReceipt: {
    backgroundColor: '#FFFDF9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0D8CE',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  receiptJaggedTop: {
    height: 4,
    backgroundColor: '#EAE2D8',
    borderRadius: 2,
    marginBottom: 12,
  },
  receiptInner: {
    alignItems: 'center',
  },
  receiptStoreName: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: '#222',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 2,
  },
  receiptSubHeader: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: '#888',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  receiptDateLine: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#666',
    marginBottom: 8,
  },
  dashedLine: {
    width: '100%',
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#CCC',
    borderStyle: 'dashed',
    marginVertical: 8,
  },
  receiptItemHeaderRow: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 2,
  },
  receiptHeaderCol: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#777',
    letterSpacing: 0.8,
  },
  receiptLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 4,
  },
  receiptItemName: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#333',
  },
  receiptItemQty: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#666',
  },
  receiptItemPrice: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#222',
  },
  emptyReceiptNote: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 4,
  },
  receiptTotalLabel: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#111',
    letterSpacing: 1,
  },
  receiptTotalValue: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.primary,
  },
  receiptFooterText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#666',
    letterSpacing: 1.5,
    marginTop: 12,
    marginBottom: 2,
  },
  receiptFooterSub: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: '#999',
  },
  receiptJaggedBottom: {
    height: 4,
    backgroundColor: '#EAE2D8',
    borderRadius: 2,
    marginTop: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ede8e0',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D4C9BC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#666',
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  saveBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#fff',
  },
});

