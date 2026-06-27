import * as React from 'react'
import type { LayoutRectangle, ViewStyle } from 'react-native'
import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import type { SharedValue } from 'react-native-reanimated'
import Animated, {
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useFrameCallback,
    useSharedValue,
    withDecay,
} from 'react-native-reanimated'

type MarqueeDirection = 'horizontal' | 'vertical'

export type MarqueeProps = React.PropsWithChildren<{
    speed?: number
    spacing?: number
    style?: ViewStyle
    reverse?: boolean
    frameRate?: number
    direction?: MarqueeDirection
    position?: SharedValue<number>
    withGesture?: boolean
}>

export type MarqueeRef = {
    start: () => void
    stop: () => void
    isActive: boolean
}

const AnimatedChild = ({
    index,
    children,
    anim,
    textMeasurement,
    spacing,
    direction,
}: React.PropsWithChildren<{
    index: number
    anim: SharedValue<number>
    textMeasurement: SharedValue<LayoutRectangle>
    spacing: number
    direction: MarqueeDirection
}>) => {
    const stylez = useAnimatedStyle(() => {
        if (direction === 'vertical') {
            return {
                position: 'absolute',
                top: (index - 1) * (textMeasurement.value.height + spacing),
                transform: [
                    {
                        translateY: -(anim.value % (textMeasurement.value.height + spacing)),
                    },
                ],
            }
        }
        return {
            position: 'absolute',
            left: (index - 1) * (textMeasurement.value.width + spacing),
            transform: [
                {
                    translateX: -(anim.value % (textMeasurement.value.width + spacing)),
                },
            ],
        }
    }, [index, spacing, textMeasurement])

    return <Animated.View style={stylez}>{children}</Animated.View>
}

export const Marquee = React.memo(
    React.forwardRef<MarqueeRef, MarqueeProps>(
        (
            {
                speed = 1,
                children,
                spacing = 0,
                style,
                reverse,
                frameRate,
                direction = 'horizontal',
                position,
                withGesture = true,
            },
            ref
        ) => {
            const parentMeasurement = useSharedValue<LayoutRectangle>({
                width: 0,
                height: 0,
                x: 0,
                y: 0,
            })
            const textMeasurement = useSharedValue<LayoutRectangle>({
                width: 0,
                height: 0,
                x: 0,
                y: 0,
            })
            const [cloneTimes, setCloneTimes] = React.useState(0)
            const anim = useSharedValue(0)

            const frameRateMs = frameRate ? 1000 / frameRate : null

            const frameCallback = useFrameCallback((frameInfo) => {
                if (frameInfo.timeSincePreviousFrame === null) return

                const frameDelta = frameRateMs
                    ? frameInfo.timeSincePreviousFrame / frameRateMs
                    : 1

                if (reverse) {
                    anim.value -= speed * frameDelta
                } else {
                    anim.value += speed * frameDelta
                }
            }, true)

            // v4 fix: useDerivedValue cannot write to other SharedValues in Reanimated 4
            // replaced with useAnimatedReaction which is the correct API for side effects
            useAnimatedReaction(
                () => anim.value,
                (val) => {
                    if (position) {
                        position.value = val
                    }
                }
            )

            useAnimatedReaction(
                () => {
                    if (
                        textMeasurement.value.width === 0 ||
                        parentMeasurement.value.width === 0 ||
                        textMeasurement.value.height === 0 ||
                        parentMeasurement.value.height === 0
                    ) {
                        return 0
                    }
                    return (
                        Math.round(
                            direction === 'horizontal'
                                ? parentMeasurement.value.width / textMeasurement.value.width
                                : parentMeasurement.value.height / textMeasurement.value.height
                        ) + 1
                    )
                },
                (v) => {
                    if (v === 0) return
                    runOnJS(setCloneTimes)(v + 2)
                },
                [direction]
            )

            function start() {
                frameCallback.setActive(true)
            }
            function stop() {
                frameCallback.setActive(false)
            }

            React.useImperativeHandle(ref, () => ({
                start,
                stop,
                isActive: frameCallback.isActive,
            }))

            const pan = Gesture.Pan()
                .enabled(withGesture)
                .onBegin(() => {
                    runOnJS(stop)()
                })
                .onChange((e) => {
                    anim.value += -(direction === 'horizontal' ? e.changeX : e.changeY)
                })
                .onFinalize((e) => {
                    anim.value = withDecay(
                        {
                            velocity: -(direction === 'horizontal' ? e.velocityX : e.velocityY),
                        },
                        (finished) => {
                            if (finished) {
                                runOnJS(start)()
                            }
                        }
                    )
                })

            return (
                <Animated.View
                    key={direction}
                    style={style}
                    onLayout={(ev) => {
                        parentMeasurement.value = ev.nativeEvent.layout
                    }}
                    pointerEvents="box-none"
                >
                    <GestureDetector gesture={pan}>
                        <Animated.View style={styles.row} pointerEvents="box-none">
                            <Animated.ScrollView
                                horizontal={direction === 'horizontal'}
                                style={styles.hidden}
                                pointerEvents="box-none"
                            >
                                <View
                                    onLayout={(ev) => {
                                        textMeasurement.value = ev.nativeEvent.layout
                                    }}
                                >
                                    {children}
                                </View>
                            </Animated.ScrollView>

                            {cloneTimes > 0 &&
                                [...Array(cloneTimes).keys()].map((index) => (
                                    <AnimatedChild
                                        key={`clone-${index}`}
                                        index={index}
                                        anim={anim}
                                        textMeasurement={textMeasurement}
                                        spacing={spacing}
                                        direction={direction}
                                    >
                                        {children}
                                    </AnimatedChild>
                                ))}
                        </Animated.View>
                    </GestureDetector>
                </Animated.View>
            )
        }
    )
)

const styles = StyleSheet.create({
    hidden: { opacity: 0, zIndex: -9999 },
    row: { flexDirection: 'row' },
})
