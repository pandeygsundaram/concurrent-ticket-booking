import { ScrollView, View, Text } from 'react-native'
import { Seat } from '../types'
import { SeatCell } from './SeatCell'

interface Props {
  seats:   Seat[]
  onPress: (seat: Seat) => void
}

export function SeatGrid({ seats, onPress }: Props) {
  // Group seats by row letter
  const rows = seats.reduce<Record<string, Seat[]>>((acc, seat) => {
    const row = seat.seat_id[0]
    if (!acc[row]) acc[row] = []
    acc[row].push(seat)
    return acc
  }, {})

  return (
    <ScrollView className="flex-1">
      {/* Screen indicator */}
      <View className="mx-8 mb-8 py-2 bg-gray-700 rounded items-center">
        <Text className="text-gray-300 text-sm">SCREEN</Text>
      </View>

      {Object.entries(rows).map(([rowLetter, rowSeats]) => (
        <View key={rowLetter} className="flex-row items-center mb-2 px-4">
          <Text className="text-gray-500 w-6 text-sm">{rowLetter}</Text>
          <View className="flex-row flex-wrap">
            {rowSeats.map(seat => (
              <SeatCell key={seat.seat_id} seat={seat} onPress={onPress} />
            ))}
          </View>
        </View>
      ))}

      {/* Legend */}
      <View className="flex-row justify-center gap-6 mt-8 mb-4">
        {[
          { color: 'bg-gray-700',  label: 'Available' },
          { color: 'bg-yellow-600', label: 'Held' },
          { color: 'bg-green-700', label: 'Confirmed' },
        ].map(({ color, label }) => (
          <View key={label} className="flex-row items-center gap-2">
            <View className={`w-4 h-4 rounded ${color}`} />
            <Text className="text-gray-400 text-xs">{label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}