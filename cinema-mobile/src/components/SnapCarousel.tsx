import { useState } from "react"
import { View, Image, Dimensions } from "react-native"
import Animated, {
    useSharedValue, useAnimatedStyle,
    interpolate, Extrapolation, useAnimatedReaction, runOnJS
} from "react-native-reanimated"
import type { SharedValue } from "react-native-reanimated"
import { Marquee } from "./Marquee"

const { width } = Dimensions.get('window')

const POSTERS = [
    require('../../assets/posters/interstellar.jpg'),
    require('../../assets/posters/oppenheimer.jpg'),
    require('../../assets/posters/dune--part-two.jpg'),
    require('../../assets/posters/the-batman.jpg'),
    require('../../assets/posters/sinners.jpg'),
    require('../../assets/posters/deadpool---wolverine.jpg'),
    require('../../assets/posters/wicked.jpg'),
    require('../../assets/posters/top-gun--maverick.jpg'),
]

const ITEM_WIDTH = width * 0.62
const ITEM_HEIGHT = ITEM_WIDTH * 1.67
const SPACING = 16
const ITEM_SIZE = ITEM_WIDTH + SPACING

// arc effect: cards dip on the sides, center card is raised
function Card({ image, index, position, totalCount }: {
    image: any
    index: number
    position: SharedValue<number>
    totalCount: number
}) {
    const animStyle = useAnimatedStyle(() => {
        // position.value is the raw marquee scroll offset (pixels)
        // normalize so 0 = this card is centered
        const itemPos = index * ITEM_SIZE
        const loopSize = totalCount * ITEM_SIZE
        // bring itemPos into the same modulo space as position.value
        const raw = ((itemPos - position.value) % loopSize + loopSize) % loopSize
        // convert to signed distance from center of screen
        const centered = raw > loopSize / 2 ? raw - loopSize : raw
        const screenCenter = (width - ITEM_WIDTH) / 2

        const dist = centered - screenCenter

        const translateY = interpolate(
            dist,
            [-ITEM_SIZE, 0, ITEM_SIZE],
            [30, 0, 30],
            Extrapolation.CLAMP
        )
        const rotate = interpolate(
            dist,
            [-ITEM_SIZE, 0, ITEM_SIZE],
            [-4, 0, 4],
            Extrapolation.CLAMP
        )
        const scale = interpolate(
            dist,
            [-ITEM_SIZE, 0, ITEM_SIZE],
            [0.9, 1, 0.9],
            Extrapolation.CLAMP
        )

        return {
            transform: [
                { translateY },
                { rotate: `${rotate}deg` },
                { scale },
            ]
        }
    })

    return (
        <Animated.View style={[{
            width: ITEM_WIDTH,
            height: ITEM_HEIGHT,
            borderRadius: 16,
            overflow: 'hidden',
            marginRight: SPACING,
        }, animStyle]}>
            <Image source={image} style={{ flex: 1, width: '100%' }} resizeMode="cover" />
        </Animated.View>
    )
}

function CarouselTrack({ onIndexChange }: { onIndexChange?: (i: number) => void }) {
    const position = useSharedValue(0)

    // track which poster is centered and call onIndexChange on JS thread
    useAnimatedReaction(
        () => {
            const loopSize = POSTERS.length * ITEM_SIZE
            const screenCenter = position.value + (width - ITEM_WIDTH) / 2
            const raw = ((screenCenter % loopSize) + loopSize) % loopSize
            return Math.round(raw / ITEM_SIZE) % POSTERS.length
        },
        (index, prev) => {
            if (index !== prev && onIndexChange) {
                runOnJS(onIndexChange)(index)
            }
        }
    )

    return (
        <Marquee
            speed={0.5}
            withGesture
            position={position}
            style={{ width, height: ITEM_HEIGHT + 40 }}
        >
            <View style={{ flexDirection: 'row', paddingTop: 20 }}>
                {POSTERS.map((image, index) => (
                    <Card
                        key={index}
                        image={image}
                        index={index}
                        position={position}
                        totalCount={POSTERS.length}
                    />
                ))}
            </View>
        </Marquee>
    )
}

export default function SnapCarousel({ onIndexChange }: { onIndexChange?: (i: number) => void }) {
    return <CarouselTrack onIndexChange={onIndexChange} />
}
