import { useRef, useCallback, useState } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import BottomSheet from '@gorhom/bottom-sheet'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listSeats, holdSeat, confirmSeat, releaseSeat } from '../src/lib/api'
import { SeatGrid } from '../src/components/SeatGrid'
import { BookingSheet } from '../src/components/BookingSheet'
import { useAppStore } from '../src/stores/appStore'
import { Seat } from '../src/types'

// No hardcoded MOVIE_ID — reads from Zustand

export default function Seats() {
  const queryClient  = useQueryClient()
  const sheetRef     = useRef<BottomSheet>(null)
  const selectedMovie = useAppStore(s => s.selectedMovie)   // from Zustand

  // selectedSeat is purely local UI state — which seat has the sheet open
  // It doesn't need to be global, only this screen cares about it
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null)

  const MOVIE_ID = selectedMovie?.id ? String(selectedMovie.id) : 'unknown'

  // Fetch all seats
  const { data: seats = [], isLoading, error } = useQuery({
    queryKey: ['seats', MOVIE_ID],
    queryFn:  () => listSeats(MOVIE_ID),
    refetchInterval: 5000,
    enabled: !!selectedMovie,   // don't fetch if no movie selected
  })

  const refreshSeats = () =>
    queryClient.invalidateQueries({ queryKey: ['seats', MOVIE_ID] })

  // Hold mutation
  const holdMutation = useMutation({
    mutationFn: (seatId: string) => holdSeat(MOVIE_ID, seatId),
    onSuccess: (booking) => {
      // Update the selected seat to reflect the hold (so sheet shows correct state)
      setSelectedSeat(prev => prev ? { ...prev, status: 'held', booking_id: booking.id } : null)
      refreshSeats()
    },
    onError: (err: Error) => {
      alert(err.message)
      sheetRef.current?.close()
    },
  })

  // Confirm mutation
  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!selectedSeat?.booking_id) throw new Error('No session ID')
      return confirmSeat(MOVIE_ID, selectedSeat.seat_id, selectedSeat.booking_id)
    },
    onSuccess: () => {
      refreshSeats()
      sheetRef.current?.close()
    },
  })

  // Release mutation
  const releaseMutation = useMutation({
    mutationFn: () => {
      if (!selectedSeat?.booking_id) throw new Error('No session ID')
      return releaseSeat(MOVIE_ID, selectedSeat.seat_id, selectedSeat.booking_id)
    },
    onSuccess: () => {
      refreshSeats()
      sheetRef.current?.close()
      setSelectedSeat(null)
    },
  })

  // When user taps a seat
  const handleSeatPress = useCallback((seat: Seat) => {
    setSelectedSeat(seat)
    sheetRef.current?.expand()

    // If it's available, immediately hold it
    if (seat.status === 'available') {
      holdMutation.mutate(seat.seat_id)
    }
    // If it's confirmed (theirs), just open the sheet to show release option
  }, [holdMutation])

  const isActionLoading =
    holdMutation.isPending || confirmMutation.isPending || releaseMutation.isPending

  if (isLoading) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator color="white" size="large" />
      </View>
    )
  }

  if (error) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-8">
        <Text className="text-red-400 text-center text-base">
          Failed to load seats. Check your connection.
        </Text>
      </View>
    )
  }

  return (
    // GestureHandlerRootView is required for bottom-sheet to work
    <GestureHandlerRootView className="flex-1">
      <SafeAreaView className="flex-1 bg-black">
        <View className="px-4 py-4">
          <Text className="text-white text-2xl font-bold">{selectedMovie?.title}</Text>
          <Text className="text-gray-400 text-sm mt-1">Tap a seat to hold it</Text>
        </View>

        <SeatGrid seats={seats} onPress={handleSeatPress} />

        <BookingSheet
          ref={sheetRef}
          seat={selectedSeat}
          onConfirm={() => confirmMutation.mutate()}
          onRelease={() => releaseMutation.mutate()}
          onCancel={() => {
            sheetRef.current?.close()
            setSelectedSeat(null)
          }}
          isLoading={isActionLoading}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  )
}