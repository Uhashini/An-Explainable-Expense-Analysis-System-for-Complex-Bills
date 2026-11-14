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
import { Feather } from '@expo/vector-icons';
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
        "👋 Hi, I'm **Pantrix Assistant**.\n\nI have your receipts, nutrition targets, and grocery history synced. Ask me anything about your spending, protein intake, or what to buy next!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([
    'How much protein do I need daily?',
    'Did I buy milk recently?',
    'How can I save ₹500 on groceries?',
    'Explain my daily nutrition plan in detail',
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

  const parseInlineMarkdown = (text, isUser = false) => {
    const tokens = [];
    const regex = /(\*\*.*?\*\*|\*[^*]+?\*)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      }
      const raw = match[0];
      if (raw.startsWith('**') && raw.endsWith('**')) {
        tokens.push({ type: 'bold', content: raw.slice(2, -2) });
      } else if (raw.startsWith('*') && raw.endsWith('*')) {
        tokens.push({ type: 'italic', content: raw.slice(1, -1) });
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      tokens.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return tokens.map((t, idx) => {
      if (t.type === 'bold') {
        return (
          <Text key={idx} style={[styles.boldText, isUser && styles.userBoldText]}>
            {t.content}
          </Text>
        );
      }
      if (t.type === 'italic') {
        return (
          <Text key={idx} style={[styles.italicText, isUser && styles.userItalicText]}>
            {t.content}
          </Text>
        );
      }
      return <Text key={idx}>{t.content}</Text>;
    });
  };

  const renderFormattedText = (content, isUser = false) => {
    const lines = content.split('\n');
    return lines.map((rawLine, lineIdx) => {
      const line = rawLine.trim();

      if (!line) {
        return <View key={`empty-${lineIdx}`} style={{ height: 6 }} />;
      }

      // Action pill like [ View Full Receipt ↗ ]
      const pillMatch = line.match(/^\[(.*?)\]$/);
      if (pillMatch) {
        return (
          <View key={`pill-${lineIdx}`} style={styles.actionPillRow}>
            <TouchableOpacity
              style={styles.actionPill}
              activeOpacity={0.8}
              onPress={() => navigation?.navigate && navigation.navigate('Receipts')}
            >
              <Text style={styles.actionPillText}>{pillMatch[1]}</Text>
            </TouchableOpacity>
          </View>
        );
      }

      // Bullet points (starts with • or - or *)
      const isBullet = line.startsWith('• ') || line.startsWith('- ') || (line.startsWith('* ') && !line.startsWith('** '));
      if (isBullet) {
        const bulletContent = line.replace(/^[•\-*]\s+/, '');
        return (
          <View key={`bullet-${lineIdx}`} style={styles.bulletRow}>
            <Text style={[styles.bulletDot, isUser && styles.userBulletDot]}>•</Text>
            <Text style={[styles.messageText, styles.bulletText, isUser && styles.userMessageText]}>
              {parseInlineMarkdown(bulletContent, isUser)}
            </Text>
          </View>
        );
      }

      // Numbered list e.g. "1. " or "2. "
      const numberMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (numberMatch) {
        return (
          <View key={`num-${lineIdx}`} style={styles.bulletRow}>
            <Text style={[styles.numIndex, isUser && styles.userBulletDot]}>{numberMatch[1]}.</Text>
            <Text style={[styles.messageText, styles.bulletText, isUser && styles.userMessageText]}>
              {parseInlineMarkdown(numberMatch[2], isUser)}
            </Text>
          </View>
        );
      }

      // Standard paragraph line
      return (
        <Text key={`line-${lineIdx}`} style={[styles.messageText, isUser && styles.userMessageText]}>
          {parseInlineMarkdown(line, isUser)}
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
            <Text style={styles.avatarText}>P</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          {renderFormattedText(item.content, isUser)}
          <Text style={[styles.timeText, isUser && styles.userTimeText]}>
            {item.timestamp}
          </Text>
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
          {navigation?.canGoBack && navigation.canGoBack() ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Feather name="chevron-left" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 12 }} />
          )}
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Pantrix Assistant</Text>
            <View style={styles.statusIndicatorRow}>
              <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {userContext?.total_receipts != null
                  ? `${userContext.total_receipts} receipts synced`
                  : 'Receipts & profile synced'}
              </Text>
            </View>
          </View>
          <View style={styles.headerRightActions}>
            <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
              <Feather name="rotate-ccw" size={11} color="#7A7265" style={{ marginRight: 4 }} />
              <Text style={styles.clearBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Connected Context Bar */}
        {userContext && (
          <View style={styles.contextBanner}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.contextPillsScroll}
            >
              <View style={styles.contextPill}>
                <Feather name="file-text" size={11} color="#7A7265" style={styles.contextPillIcon} />
                <Text style={styles.contextPillText}>{userContext.total_receipts || 0} Receipts</Text>
              </View>
              <View style={styles.contextPill}>
                <Feather name="credit-card" size={11} color="#7A7265" style={styles.contextPillIcon} />
                <Text style={styles.contextPillText}>₹{userContext.total_spent || 0} Spent</Text>
              </View>
              <View style={styles.contextPill}>
                <Feather name="activity" size={11} color="#7A7265" style={styles.contextPillIcon} />
                <Text style={styles.contextPillText}>{userContext.total_protein_g || 0}g Protein</Text>
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
                    <Text style={styles.avatarText}>P</Text>
                  </View>
                  <View style={styles.loadingBubble}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Analyzing your profile & receipts...</Text>
                  </View>
                </View>
              ) : null
            }
          />

          {/* Quick-Reply Suggestion Chips */}
          {!isLoading && (
            <View style={styles.suggestionsContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
              >
                {(suggestions.length > 0 ? suggestions : [
                  '🥩 Top protein items',
                  '💸 Weekly spend breakdown',
                  '🥗 Healthy food swaps',
                  '🏪 Compare grocery hauls',
                  '⚠️ Any overspending alerts?',
                ]).map((chip, idx) => (
                  <TouchableOpacity
                    key={`chip-${idx}`}
                    style={styles.chip}
                    onPress={() => handleSend(chip)}
                    activeOpacity={0.75}
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
              placeholder="Ask about receipts, protein, or spending..."
              placeholderTextColor="#9A9285"
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
              <Feather name="arrow-up" size={18} color="#FFFFFF" />
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
    marginRight: 6,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: '#1A1816',
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
    backgroundColor: '#22c55e',
  },
  headerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#7A7265',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F4F0E8',
    borderWidth: 1,
    borderColor: '#E2D9C8',
  },
  clearBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#554D40',
  },
  contextBanner: {
    backgroundColor: '#FAF8F5',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE6DD',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  contextPillsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F0E8',
    borderWidth: 1,
    borderColor: '#E2D9C8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  contextPillIcon: {
    marginRight: 5,
  },
  contextPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#554D40',
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
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  bubble: {
    borderRadius: 16,
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2D9C8',
    borderTopLeftRadius: 4,
  },
  timeText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#9A9285',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  userTimeText: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  messageText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: '#4A3B32',
    marginBottom: 6,
  },
  userMessageText: {
    color: '#FFFFFF',
    marginBottom: 0,
  },
  boldText: {
    fontFamily: FONTS.bold,
    fontWeight: '600',
    color: '#2A1E17',
  },
  userBoldText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  italicText: {
    fontStyle: 'italic',
    color: '#4A3B32',
  },
  userItalicText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 16,
    marginTop: 2,
    marginBottom: 6,
  },
  bulletDot: {
    fontSize: 14,
    lineHeight: 21,
    color: '#821414',
    marginRight: 8,
    fontWeight: 'bold',
  },
  userBulletDot: {
    color: '#FFFFFF',
  },
  numIndex: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    lineHeight: 21,
    color: '#821414',
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    marginBottom: 0,
  },
  actionPillRow: {
    marginVertical: 6,
  },
  actionPill: {
    backgroundColor: '#F4F0E8',
    borderWidth: 1,
    borderColor: '#D9CFC0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  actionPillText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2D9C8',
    flexShrink: 1,
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#7A7265',
  },
  suggestionsContainer: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FAF8F5',
    borderTopWidth: 1,
    borderTopColor: '#EAE6DD',
  },
  chipsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2D9C8',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
  },
  chipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#554D40',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EAE6DD',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 90,
    backgroundColor: '#F4F0E8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 9,
    paddingBottom: 9,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#1A1816',
    borderWidth: 1,
    borderColor: '#E2D9C8',
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#D5CFC5',
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
