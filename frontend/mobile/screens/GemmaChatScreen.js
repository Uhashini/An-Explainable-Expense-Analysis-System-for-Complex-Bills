import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Modal,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../theme';
import { API_BASE_URL } from '../utils/apiConfig';
import { getUser } from '../utils/authStorage';

export default function GemmaChatScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width > 520;
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "👋 Hi! I am **Pantrix AI**, powered by **Gemma 3 12B**.\n\nI have loaded your personal profile, health goals, and receipt history. Ask me anything about your grocery spending, protein & nutritional targets, or smart shopping recommendations!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([
    'What is creatine and should I take it?',
    'How much protein do I need daily?',
    'How can I save ₹500 on groceries?',
    'Break down my spend on latest receipt',
  ]);
  const [userContext, setUserContext] = useState(null);
  const [userId, setUserId] = useState(1);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [statusInfo, setStatusInfo] = useState({ provider: 'Local Data-Grounded Mode', has_api_key: false });
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [savingKeys, setSavingKeys] = useState(false);

  const flatListRef = useRef(null);

  useEffect(() => {
    loadUserDataAndSuggestions();
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/chatbot/status`);
      if (res.ok) {
        const data = await res.json();
        setStatusInfo(data);
      }
    } catch (err) {
      console.log('Error fetching chatbot status:', err);
    }
  };

  const loadUserDataAndSuggestions = async () => {
    try {
      const user = await getUser();
      const uid = user?.id || user?.user_id || 1;
      setUserId(uid);

      // Fetch dynamic suggestions based on real user data
      const res = await fetch(`${API_BASE_URL}/chatbot/suggestions/${uid}`);
      if (res.ok) {
        const data = await res.json();
        if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
        }
        if (data.context_summary) {
          setUserContext(data.context_summary);
        }
      }
    } catch (err) {
      console.log('Error fetching chat suggestions:', err);
    }
  };

  const saveApiKeys = async () => {
    setSavingKeys(true);
    try {
      const res = await fetch(`${API_BASE_URL}/chatbot/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gemini_api_key: geminiKeyInput.trim() || undefined,
          groq_api_key: groqKeyInput.trim() || undefined,
        }),
      });

      if (res.ok) {
        Alert.alert('Success', 'AI Configuration updated successfully!');
        setSettingsVisible(false);
        fetchStatus();
      } else {
        Alert.alert('Error', 'Failed to update keys. Please try again.');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not reach server to update configuration.');
    } finally {
      setSavingKeys(false);
    }
  };

  const handleSend = async (textToSend = null) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    // Prepare history payload for multi-turn chat
    const historyPayload = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    try {
      const response = await fetch(`${API_BASE_URL}/chatbot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          message: text,
          history: historyPayload,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const botMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || "I couldn't process that query. Please try again.",
        model: data.model || 'Gemma 3 12B',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
      if (data.context_summary) {
        setUserContext(data.context_summary);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          "⚠️ Sorry, I encountered an issue connecting to the AI service. Please make sure the backend server is running and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          "Conversation reset. How can I help you analyze your receipts, spending, or diet today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const renderFormattedText = (content, isUser = false) => {
    const lines = content.split('\n');
    return lines.map((line, lineIdx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <Text
          key={`line-${lineIdx}`}
          style={[styles.messageText, isUser && styles.userMessageText]}
        >
          {parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <Text
                  key={`part-${partIdx}`}
                  style={[styles.boldText, isUser && styles.userBoldText]}
                >
                  {part.slice(2, -2)}
                </Text>
              );
            }
            return part;
          })}
        </Text>
      );
    });
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.assistantRow]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>✦</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          {!isUser && (
            <View style={styles.botBadgeRow}>
              <Text style={styles.botBadge} numberOfLines={1}>{item.model || 'GEMMA AI'}</Text>
              <Text style={styles.timeText}>{item.timestamp}</Text>
            </View>
          )}
          {renderFormattedText(item.content, isUser)}
          {isUser && <Text style={styles.userTimeText}>{item.timestamp}</Text>}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeContainer, isDesktop && styles.desktopContainer]}
      edges={['top']}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Centered Mobile Phone Frame */}
      <View style={[styles.phoneFrame, isDesktop && styles.desktopPhoneFrame]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.titleRow}>
            <Text style={styles.headerTitle}>Pantrix AI</Text>
            <View style={styles.modelTag}>
              <Text style={styles.modelTagText}>Gemma AI</Text>
            </View>
          </View>
          <View style={styles.statusIndicatorRow}>
            <View style={[styles.statusDot, { backgroundColor: statusInfo.has_api_key ? '#22c55e' : '#3b82f6' }]} />
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {statusInfo.provider || 'Local Data-Grounded Mode'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRightActions}>
          <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Context Snapshot Banner */}
      {userContext && (
        <View style={styles.contextBanner}>
          <Text style={styles.contextLabel}>CONNECTED CONTEXT:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.contextPillsScroll}
          >
            <View style={styles.contextPill}>
              <Text style={styles.contextPillText}>🧾 {userContext.total_receipts || 0} Receipts</Text>
            </View>
            <View style={styles.contextPill}>
              <Text style={styles.contextPillText}>💰 ₹{userContext.total_spent || 0} Spent</Text>
            </View>
            <View style={styles.contextPill}>
              <Text style={styles.contextPillText}>💪 {userContext.total_protein_g || 0}g Protein</Text>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Chat Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            isLoading ? (
              <View style={styles.loadingRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>✦</Text>
                </View>
                <View style={styles.loadingBubble}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.loadingText}>Analyzing your profile & receipts...</Text>
                </View>
              </View>
            ) : null
          }
        />

        {/* Suggestion Chips */}
        {suggestions.length > 0 && messages.length <= 3 && !isLoading && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>💡 Suggested Questions:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
            >
              {suggestions.map((chip, idx) => (
                <TouchableOpacity
                  key={`chip-${idx}`}
                  style={styles.chip}
                  onPress={() => handleSend(chip)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipText}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input Bar */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            style={styles.input}
            placeholder="Ask Gemma about creatine, macros, recipes, bills..."
            placeholderTextColor="rgba(153, 8, 8, 0.4)"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || isLoading}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      </View>

      {/* AI Provider & API Settings Modal */}
      <Modal
        visible={settingsVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🤖 AI Engine Configuration</Text>
              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>
                Pantrix AI runs with Google's Gemma 3 12B reasoning engine. By default, it operates in offline data-grounded mode. You can optionally link Google AI Studio or Groq for live cloud generation.
              </Text>

              <View style={styles.currentProviderCard}>
                <Text style={styles.currentProviderLabel}>Current Active Mode:</Text>
                <Text style={styles.currentProviderValue}>{statusInfo.provider}</Text>
              </View>

              <Text style={styles.inputLabel}>Google Gemini API Key (Optional)</Text>
              <TextInput
                style={styles.keyInput}
                placeholder="AIzaSy..."
                placeholderTextColor="#999"
                value={geminiKeyInput}
                onChangeText={setGeminiKeyInput}
                secureTextEntry
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Groq API Key (Optional)</Text>
              <TextInput
                style={styles.keyInput}
                placeholder="gsk_..."
                placeholderTextColor="#999"
                value={groqKeyInput}
                onChangeText={setGroqKeyInput}
                secureTextEntry
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={styles.saveKeyBtn}
                onPress={saveApiKeys}
                disabled={savingKeys}
              >
                {savingKeys ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveKeyBtnText}>Save Configuration</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  desktopContainer: {
    backgroundColor: '#EAE6DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneFrame: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FAF9F6',
  },
  desktopPhoneFrame: {
    maxWidth: 480,
    height: '100%',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#DFD9CD',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ede8e0',
  },
  backButton: {
    padding: 6,
    marginRight: 8,
  },
  backIcon: {
    fontSize: 22,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  headerCenter: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: '#1a1a1a',
  },
  modelTag: {
    backgroundColor: 'rgba(153, 8, 8, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modelTagText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '700',
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#3b82f6',
  },
  headerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#666',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
  },
  iconBtnText: {
    fontSize: 18,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F3EFEA',
  },
  clearBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#666',
  },
  contextBanner: {
    backgroundColor: '#FFF8F6',
    borderBottomWidth: 1,
    borderBottomColor: '#F5E6E3',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  contextLabel: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: COLORS.primary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  contextPillsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  contextPill: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E8D4D0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  contextPillText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#444',
  },
  keyboardAvoid: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginVertical: 2,
  },
  userRow: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
    maxWidth: '82%',
  },
  assistantRow: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
    maxWidth: '86%',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexShrink: 1,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
  },
  assistantBubble: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EDE9E3',
    borderTopLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  botBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0ece6',
    gap: 10,
  },
  botBadge: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: COLORS.primary,
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  timeText: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: '#999',
  },
  userTimeText: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: '#222',
  },
  userMessageText: {
    color: '#fff',
  },
  boldText: {
    fontFamily: FONTS.bold,
    fontWeight: '700',
    color: '#111',
  },
  userBoldText: {
    color: '#fff',
  },
  loadingRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#ede8e0',
    flexShrink: 1,
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#777',
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FAF9F6',
  },
  suggestionsTitle: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    marginBottom: 6,
  },
  chipsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E8D4D0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  chipText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.primary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ede8e0',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F4F2EF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#111',
    borderWidth: 1,
    borderColor: '#ede8e0',
    marginBottom: 2,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendIcon: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#111',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#888',
    fontWeight: 'bold',
    padding: 4,
  },
  modalSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
    marginBottom: 14,
  },
  currentProviderCard: {
    backgroundColor: '#F7F5F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E4DA',
  },
  currentProviderLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#777',
    marginBottom: 4,
  },
  currentProviderValue: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
  inputLabel: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#333',
    marginBottom: 6,
  },
  keyInput: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#D8D4CC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#111',
    marginBottom: 14,
  },
  saveKeyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveKeyBtnText: {
    fontFamily: FONTS.bold,
    color: '#fff',
    fontSize: 14,
  },
});
