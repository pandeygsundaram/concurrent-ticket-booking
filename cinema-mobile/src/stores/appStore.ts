import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export interface Movie {
    title: string,
    id: number,
    poster: string,
    year: string
}

interface AppStore {
    onboardingComplete: boolean
    selectedMovie: Movie | null

    // Not persisted — recomputed on each launch
    isReady: boolean
    // Setters
    setOnboardingComplete: () => void
    setSelectedMovie: (movie: Movie) => void
    setReady: () => void

}



export const useAppStore = create<AppStore>()(
    persist(
        (set) => ({
            onboardingComplete: false,
            selectedMovie: null,
            isReady: false,

            setOnboardingComplete: () => set({ onboardingComplete: true }),
            setSelectedMovie: (movie) => set({ selectedMovie: movie }),
            setReady: () => set({ isReady: true }),
        }), {

        name: 'cinema-app-storage',
        storage: createJSONStorage(() => AsyncStorage),
        // basically it sets them permanently!
        partialize: (state) => ({
            onboardingComplete: state.onboardingComplete,
            selectedMovie: state.selectedMovie,
        }),
        onRehydrateStorage: () => (state) => {
            state?.setReady()
        },

    }
    )

)