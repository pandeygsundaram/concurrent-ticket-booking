import { Pressable, Text } from 'react-native'
import { Seat } from '../types'

interface Props {
  seat:    Seat
  onPress: (seat: Seat) => void
}

const STATUS_COLORS = {
  available: 'bg-gray-700 border-gray-600',
  held:      'bg-yellow-600 border-yellow-500',
  confirmed: 'bg-green-700 border-green-600',
}

export function SeatCell({ seat, onPress }: Props) {
  const colorClass = STATUS_COLORS[seat.status]
  const isDisabled = seat.status === 'held'   // held by someone else — can't tap

  return (
    <Pressable
      disabled={isDisabled}
      onPress={() => onPress(seat)}
      className={`m-1 w-8 h-8 rounded items-center justify-center border ${colorClass} ${isDisabled ? 'opacity-40' : ''}`}
    >
      <Text className="text-white text-xs">{seat.seat_id}</Text>
    </Pressable>
  )
}