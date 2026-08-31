import React, { createContext, useContext, useMemo, useState } from 'react';

const OnboardingContext = createContext(null);

export function OnboardingProvider({ children }) {
  const [profile, setProfile] = useState({
    fullName: '', age: '', gender: '', height: '', weight: '',
    activity: '', foodPreference: '', allergies: [], conditions: [],
    goals: [], budget: '', stores: [], householdSize: '', frequency: '', city: '',
  });
  const [completed, setCompleted] = useState(false);

  const value = useMemo(() => ({
    profile,
    updateProfile: (changes) => setProfile((current) => ({ ...current, ...changes })),
    completed,
    finish: () => setCompleted(true),
  }), [profile, completed]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return context;
}
