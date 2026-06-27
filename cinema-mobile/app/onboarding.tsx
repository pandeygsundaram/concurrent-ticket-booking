import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../src/stores/appStore";
import { router } from "expo-router";
import { Animated, Dimensions, Image, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import MovieBelt from "../src/components/MovieBelt";
import { VideoView, useVideoPlayer } from 'expo-video';
const { height, width } = Dimensions.get('window')

const PAGES = [
    {
        title: 'Explore Popular ',
        supportTitle: 'Movies',
        subtitle: 'Browse through trending and popular movies to see what everyone\'s talking about. ',
        image: require('../assets/posters/dune--part-two-blurred-v2.jpg')
    },
    {
        title: 'Your Next',
        supportTitle: 'Blockbuster Awaits',
        subtitle: 'Tell us the latest movie and we will find a way for you to watch',
        image: require('../assets/collage-onboarding.jpg')
    },
]


export default function OnBoarding() {
    const [page, setPage] = useState(0);
    const setOnboardingComplete = useAppStore(s => s.setOnboardingComplete);
    const isLast = page === PAGES.length - 1

    const player = useVideoPlayer(require('../assets/dune-animated-compressed.mp4'), p => {
        p.loop = true
        p.play()
    })

    const fumeAnim = useRef(new Animated.Value(0)).current
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(fumeAnim, { toValue: -30, duration: 3000, useNativeDriver: true }),
                Animated.timing(fumeAnim, { toValue: 0, duration: 3000, useNativeDriver: true }),
            ])
        ).start()
    }, [])


    function handleNext() {
        if (isLast) {
            router.replace('/login')
        } else {
            setPage(p => p + 1)
        }
    }

    return (
        <View className="flex-1 bg-black ">
            {/* here comes the image */}
            <View style={{ height: height * 0.65 }} >
                {page === 1 ? (<MovieBelt />) :
                    (
                        <VideoView
                            player={player}
                            style={{ flex: 1, width: '100%' }}
                            contentFit="cover"
                            nativeControls={false}
                        />
                    )
                }
                {page === 0 && (
                    <Animated.View
                        pointerEvents="none"
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '60%',
                            transform: [{ translateY: fumeAnim }],
                            opacity: 0.85,
                        }}
                    >
                        <LinearGradient
                            colors={['transparent', 'rgba(200,100,30,0.8)', 'transparent']}
                            locations={[0, 0.5, 1]}
                            style={{ flex: 1 }}
                            pointerEvents="none"
                        />
                    </Animated.View>
                )}
                <BlurView
                    intensity={5}
                    tint="light"
                    className="absolute inset-0"
                    pointerEvents="none"
                />
                {/* gradient overlay — sits on top of image */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.5)', '#000000']}
                    locations={[0.1, 0.5, 1]}
                    className="absolute inset-0"
                    pointerEvents="none"
                />
            </View>

            <View style={{ height: height * 0.35, marginTop: -(height * 0.1) }} className="px-12 justify-between pt-12">

                {/* title + subtitle */}
                <View>
                    <Text className="text-white text-3xl leading-tight font-bold ">
                        {PAGES[page].title}
                    </Text>
                    <Text className="text-white text-3xl  font-bold mb-2">
                        {PAGES[page].supportTitle}
                    </Text>
                    <Text className="text-gray-400 text-sm">
                        {PAGES[page].subtitle}
                    </Text>
                </View>

                {/* dots + arrow row */}
                <View className="flex-row items-center justify-between">
                    {/* dots */}
                    <View className="flex-row gap-2">
                        {PAGES.map((_, i) => (
                            <View
                                key={i}
                                className={`h-2 rounded-full ${i === page ? 'w-10 bg-yellow-700' : 'w-2 bg-gray-600'}`}
                            />
                        ))}
                    </View>

                    {/* arrow button */}
                    <Pressable
                        onPress={handleNext}
                        className="w-14 h-14 rounded-full  items-center justify-center"
                        style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
                    >
                        <Text className=" text-white text-xl"> ⟩ </Text>
                    </Pressable>
                </View>

            </View>

            {/* <Pressable
                onPress={()=>{console.log("eat samosa")}}
                style={{backgroundColor: 'rgba(255,255,255,0.25)', width: 60, height: 26, borderRadius: 28 }}
                className="absolute top-12 left-6 px-4 pt-0.5   border border-white/40"
            >
                <Text className="text-white font-medium" >Skip</Text>
            </Pressable> */}



        </View>
    )



}