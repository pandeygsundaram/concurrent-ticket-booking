import { forwardRef, useCallback } from 'react'
import { View, Text, Pressable } from 'react-native'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { Seat } from '../types'

interface Props {
  seat:      Seat | null
  onConfirm: () => void
  onRelease: () => void
  onCancel:  () => void
  isLoading: boolean
}

// forwardRef lets the parent control open/close via a ref
export const BookingSheet = forwardRef<BottomSheet, Props>(
  ({ seat, onConfirm, onRelease, onCancel, isLoading }, ref) => {
    const snapPoints = ['35%']   // sheet takes up 35% of screen height

    if (!seat) return null

    const isConfirmed = seat.status === 'confirmed'

    return (
      <BottomSheet
        ref={ref}
        index={-1}               // -1 = closed by default
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onCancel}
        backgroundStyle={{ backgroundColor: '#1a1a1a' }}
        handleIndicatorStyle={{ backgroundColor: '#555' }}
      >
        <BottomSheetView className="flex-1 px-6 pt-4">
          <Text className="text-white text-xl font-bold mb-2">
            Seat {seat.seat_id}
          </Text>
          <Text className="text-gray-400 mb-8">
            {isConfirmed ? 'You have confirmed this seat.' : 'This seat is being held for you.'}
          </Text>

          {isConfirmed ? (
            <Pressable
              onPress={onRelease}
              disabled={isLoading}
              className="bg-red-700 rounded-xl py-4 items-center"
            >
              <Text className="text-white font-bold text-base">
                {isLoading ? 'Releasing...' : 'Release Seat'}
              </Text>
            </Pressable>
          ) : (
            <View className="gap-3">
              <Pressable
                onPress={onConfirm}
                disabled={isLoading}
                className="bg-green-700 rounded-xl py-4 items-center"
              >
                <Text className="text-white font-bold text-base">
                  {isLoading ? 'Confirming...' : 'Confirm Seat'}
                </Text>
              </Pressable>
              <Pressable
                onPress={onCancel}
                className="bg-gray-700 rounded-xl py-4 items-center"
              >
                <Text className="text-white font-bold text-base">Cancel Hold</Text>
              </Pressable>
            </View>
          )}
        </BottomSheetView>
      </BottomSheet>
    )
  }
)