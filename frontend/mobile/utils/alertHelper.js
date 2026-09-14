import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirmation dialog that works seamlessly on Web, Android, and iOS.
 * On Web, Alert.alert does not invoke button callbacks, so window.confirm is used.
 */
export function showConfirm({
  title = 'Confirm',
  message = 'Are you sure?',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}) {
  if (Platform.OS === 'web') {
    const text = title ? `${title}\n\n${message}` : message;
    const confirmed = typeof window !== 'undefined' ? window.confirm(text) : true;
    if (confirmed) {
      onConfirm?.();
    } else {
      onCancel?.();
    }
  } else {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel', onPress: onCancel },
        { text: confirmText, style: 'destructive', onPress: onConfirm },
      ],
      { cancelable: true }
    );
  }
}

/**
 * Cross-platform notification dialog that works seamlessly on Web, Android, and iOS.
 * Executes onOk callback after dismissal on both Web and Native platforms.
 */
export function showNotification(title, message, onOk) {
  if (Platform.OS === 'web') {
    const text = title ? `${title}\n\n${message}` : message;
    if (typeof window !== 'undefined') {
      window.alert(text);
    }
    onOk?.();
  } else {
    Alert.alert(
      title,
      message,
      [{ text: 'OK', onPress: onOk }],
      { cancelable: false }
    );
  }
}
