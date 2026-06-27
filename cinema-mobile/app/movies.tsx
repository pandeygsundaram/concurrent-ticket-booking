import { FlatList, View, Text, Pressable, Image } from 'react-native'
import { router } from 'expo-router'
import { Movie, useAppStore } from '../src/stores/appStore'
import { MOVIES } from '../src/data/movies'
import AsyncStorage from '@react-native-async-storage/async-storage'

export default function Movies() {
  AsyncStorage.clear()

  const setSelectedMovie = useAppStore(s => s.setSelectedMovie)

  function handleMoviePress(movie :Movie ) {
    setSelectedMovie(movie)       // into Zustand — seats screen reads it from there
    router.push('/seats')
  }

  return (
    <View className="flex-1 bg-black">
      <View className="px-4 pt-14 pb-4">
        <Text className="text-white text-2xl font-bold">Now Showing</Text>
      </View>
      <FlatList
        data={MOVIES}
        keyExtractor={item => String(item.id)}
        numColumns={2}
        contentContainerClassName="px-2 pb-8"
        renderItem={({ item }) => (
          <Pressable
            className="flex-1 m-2 rounded-xl overflow-hidden"
            onPress={() => handleMoviePress(item)}
          >
            <Image
              source={{ uri: item.poster }}
              className="w-full h-64"
              resizeMode="cover"
            />
            <View className="p-2 bg-gray-900">
              <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                {item.title}
              </Text>
              <Text className="text-gray-400 text-xs">{item.year}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  )
}