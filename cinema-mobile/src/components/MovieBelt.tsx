import { useCallback, useEffect } from "react"
import { Dimensions, Image, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue, withRepeat, withTiming } from "react-native-reanimated"

const ROW1 = [
    require('../../assets/posters/john-wick--chapter-4.jpg'),
    require('../../assets/posters/interstellar.jpg'),
    require('../../assets/posters/spider-man--across-the-spider-verse.jpg'),
    require('../../assets/posters/mickey-17.jpg'),
    require('../../assets/posters/elio.jpg'),
    require('../../assets/posters/gladiator-ii.jpg'),
    require('../../assets/posters/wonka.jpg'),
    require('../../assets/posters/the-fantastic-four--first-steps.jpg'),
]

const ROW2 = [
    require('../../assets/posters/mission--impossible---dead-reckoning.jpg'),
    require('../../assets/posters/the-batman.jpg'),
    require('../../assets/posters/avatar.jpg'),
    require('../../assets/posters/thunderbolts-.jpg'),
    require('../../assets/posters/avatar--the-way-of-water.jpg'),
    require('../../assets/posters/how-to-train-your-dragon.jpg'),
]
const ROW3 = [
    require('../../assets/posters/the-wild-robot.jpg'),
    require('../../assets/posters/sinners.jpg'),
    require('../../assets/posters/the-super-mario-bros--movie.jpg'),
    require('../../assets/posters/wicked.jpg'),
    require('../../assets/posters/f1.jpg'),
    require('../../assets/posters/oppenheimer.jpg'),
    require('../../assets/posters/deadpool---wolverine.jpg'),
    require('../../assets/posters/inside-out-2.jpg'),
    require('../../assets/posters/dune.jpg'),
    require('../../assets/posters/top-gun--maverick.jpg'),
    require('../../assets/posters/dune--part-two.jpg'),
]

const CARD_WIDTH = 120
const CARD_HEIGHT = 160
const GAP = 8

function BeltRow({ images, direction }: { images: any[], direction: 1 | -1 }) {
    const totalWidth = (CARD_WIDTH + GAP) * images.length
    const offset = useSharedValue(direction === -1 ? 0 : -totalWidth)
    const extraSpeed = useSharedValue(0)

    useFrameCallback((frame) => {
        // if (!frame.timeSincePreviousFrame) return
        const delta = (frame.timeSincePreviousFrame ?? 32) / 1000
        const speed = 20 // 40 pixel per second
        offset.value = offset.value - (direction * speed * delta)

        extraSpeed.value *= 0.95

        if (offset.value <= -totalWidth * 2) offset.value += totalWidth
        if (offset.value >= 0) offset.value -= totalWidth
    })
    const previousTranslation = useSharedValue(0)

    const pan = Gesture.Pan().onBegin(()=>{
        previousTranslation.value=0
    }).onUpdate((e) => {
        const delta = e.translationX - previousTranslation.value
        offset.value +=delta
        previousTranslation.value= e.translationX
    }).onEnd((e) => {
        const boost = Math.max(-600, Math.min(200, -e.velocityX * 0.3))
        extraSpeed.value = boost
    })

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: offset.value }]
    }))

    const doubled = [...images, ...images, ...images]

    return (
        <GestureDetector gesture={pan}>

            <View style={{  marginBottom: GAP }}>
                <Animated.View style={[{ flexDirection: 'row' }, animStyle]}>
                    {doubled.map((img, i) => (
                        <Image
                            key={i}
                            source={img}
                            style={{ width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 10, marginRight: GAP }}
                            resizeMode="cover"
                        />
                    ))}
                </Animated.View>
            </View>
        </GestureDetector>
    )

}

export default function MovieBelt() {
    const { width } = Dimensions.get('window')
    return (
        <View style={{ transform: [{ rotate: '-6deg' }], width: width + 300, marginLeft: -150 }}>
            {/* 3 rows go here */}

            <BeltRow images={ROW1} direction={-1} />
            <BeltRow images={ROW2} direction={1} />
            <BeltRow images={ROW3} direction={-1} />
        </View>
    )
}