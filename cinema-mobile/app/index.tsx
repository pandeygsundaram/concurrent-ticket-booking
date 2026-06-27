import { Redirect } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { useAppStore } from '../src/stores/appStore'
import AsyncStorage from '@react-native-async-storage/async-storage'

export default function Index() {
     const isReady = useAppStore(s => s.isReady)
    const onboardingComplete = useAppStore(s => s.onboardingComplete)

    if (!isReady) {
        return (
            <View style={{ flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="white" />
            </View>
        )
    }

    return <Redirect href={onboardingComplete ? '/movies' : '/onboarding'} />
}
