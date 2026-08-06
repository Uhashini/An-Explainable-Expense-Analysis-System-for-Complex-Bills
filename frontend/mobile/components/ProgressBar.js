import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ProgressBar({ step, total = 5 }) {
  return (
    <View style={styles.container}>
      <View style={styles.stepperRow}>
        {Array.from({ length: total }).map((_, index) => {
          const stepNum = index + 1;
          const isActive = stepNum === step;
          const isCompleted = stepNum < step;

          return (
            <React.Fragment key={stepNum}>
              {/* Step Circle */}
              <View
                style={[
                  styles.circle,
                  (isActive || isCompleted) ? styles.circleActive : styles.circleInactive,
                ]}
              >
                <Text
                  style={[
                    styles.circleText,
                    (isActive || isCompleted) ? styles.circleTextActive : styles.circleTextInactive,
                  ]}
                >
                  {stepNum}
                </Text>
              </View>

              {/* Connecting Line */}
              {index < total - 1 && (
                <View
                  style={[
                    styles.line,
                    stepNum < step ? styles.lineActive : styles.lineInactive,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '85%',
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleActive: {
    backgroundColor: '#7A3525',
  },
  circleInactive: {
    backgroundColor: '#EFEAE2',
    borderWidth: 1,
    borderColor: '#E2DAD0',
  },
  circleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  circleTextActive: {
    color: '#FFFFFF',
  },
  circleTextInactive: {
    color: '#7A3525',
  },
  line: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
  },
  lineActive: {
    backgroundColor: '#7A3525',
  },
  lineInactive: {
    backgroundColor: '#E2DAD0',
  },
});
