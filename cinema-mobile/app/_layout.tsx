import '../global.css'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAppStore } from '../src/stores/appStore'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

const queryClient = new QueryClient()

export default function RootLayout() {
    const setReady = useAppStore(s => s.setReady)

    useEffect(() => {
        const unsub = useAppStore.persist.onFinishHydration(() => {
            setReady()
        })
        if (useAppStore.persist.hasHydrated()) {
            setReady()
        }
        return unsub
    }, [])

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <QueryClientProvider client={queryClient}>
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' }, animation: 'fade' }} />
            </QueryClientProvider>
        </GestureHandlerRootView>
    )
}