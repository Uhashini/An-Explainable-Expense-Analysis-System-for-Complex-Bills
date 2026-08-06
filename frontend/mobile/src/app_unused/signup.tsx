import { useRouter } from 'expo-router';
import OnboardingFlowScreen from '../../screens/OnboardingFlowScreen';
export default function Signup() { const router=useRouter(); return <OnboardingFlowScreen navigation={{reset:()=>router.replace('/dashboard')}} route={{params:{}}}/>; }
