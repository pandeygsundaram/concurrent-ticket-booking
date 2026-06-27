import { useRef, useState } from "react"
import {
    View, Image, Text, Pressable,
    Animated, Easing, StyleSheet, Dimensions, StatusBar, Linking
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import SnapCarousel from "../src/components/SnapCarousel"
import { useAppStore } from "../src/stores/appStore"
import { router, useRouter } from "expo-router"

const { width: screenW, height: screenH } = Dimensions.get('screen')

const POSTERS = [
    require('../assets/posters/interstellar.jpg'),
    require('../assets/posters/oppenheimer.jpg'),
    require('../assets/posters/dune--part-two.jpg'),
    require('../assets/posters/the-batman.jpg'),
    require('../assets/posters/sinners.jpg'),
    require('../assets/posters/deadpool---wolverine.jpg'),
    require('../assets/posters/wicked.jpg'),
    require('../assets/posters/top-gun--maverick.jpg'),
]


const bgStyle = {
    position: 'absolute' as const,
    top: 0, left: 0,
    width: screenW, height: screenH,
}

const googleLogo = require('../assets/search.png')

export default function Login() {
    const [current, setCurrent] = useState(0)
    const [incoming, setIncoming] = useState<number | null>(null)
    const fadeAnim = useRef(new Animated.Value(0)).current
    const animRef = useRef<Animated.CompositeAnimation | null>(null)
    const setOnboardingComplete = useAppStore(s => s.setOnboardingComplete);

    
    function handleLogin(){
        setOnboardingComplete()
        router.replace('/login')
    
    }

    function handleIndexChange(i: number) {
        if (i === current && incoming === null) return
        animRef.current?.stop()
        setIncoming(i)
        fadeAnim.setValue(0)
        animRef.current = Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
        })
        animRef.current.start(({ finished }) => {
            if (finished) {
                setCurrent(i)
                setIncoming(null)
            }
        })
    }

    return (
        <View style={styles.root}>
            <StatusBar translucent backgroundColor="transparent" />

            {/* blurred background */}
            <Image source={POSTERS[current]} style={bgStyle} blurRadius={20} resizeMode="cover" />
            {incoming !== null && (
                <Animated.Image
                    source={POSTERS[incoming]}
                    style={[bgStyle, { opacity: fadeAnim }]}
                    blurRadius={20}
                    resizeMode="cover"
                />
            )}
            <View style={[StyleSheet.absoluteFill, styles.overlay]} />

            <SafeAreaView style={styles.safe}>
                {/* carousel pushed slightly toward top */}
                <View style={styles.carouselWrap}>
                    <SnapCarousel onIndexChange={handleIndexChange} />
                </View>

                {/* bottom content */}
                <View style={styles.content}>
                    <Text style={styles.welcomeLabel}>WELCOME TO</Text>
                    <Text style={styles.appName}>LUME</Text>

                    {/* decorative divider */}
                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerStar}>✦</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    <Text style={styles.sub}>Your next movie night starts here.</Text>

                    <Pressable
                        style={styles.googleBtn}
                        onPress={handleLogin}
                        android_ripple={{ color: 'rgba(255,255,255,0.15)', borderless: false }}
                    >
                        <Image source={googleLogo} style={{ width: 16, height: 16 }} resizeMode="contain" />
                        <Text style={styles.googleBtnText}>Continue with Google</Text>
                    </Pressable>

                    <Text style={styles.terms}>
                        {'By continuing, you agree to our '}
                        <Text style={styles.termsLink} onPress={() => Linking.openURL('#')}>Terms of Service</Text>
                        <Text style={styles.termsGray}> and </Text>
                        <Text style={styles.termsLink} onPress={() => Linking.openURL('#')}>Privacy Policy</Text>
                    </Text>
                </View>
            </SafeAreaView>
        </View>
    )
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    overlay: {
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    safe: {
        flex: 1,
    },
    carouselWrap: {
        // pushes carousel up slightly so content section has more room
        marginTop: -8,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingTop: 12,
        paddingBottom: 16,
        justifyContent: 'center',
    },
    welcomeLabel: {
        color: '#9CA3AF',
        fontSize: 11,
        textAlign: 'center',
        letterSpacing: 5,
        fontWeight: '500',
        marginBottom: 8,
    },
    appName: {
        color: '#E8A040',      // warm amber-orange matching the image
        fontSize: 56,
        fontWeight: '700',
        letterSpacing: 12,
        textAlign: 'center',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '60%',
        marginTop: 14,
        marginBottom: 14,
        gap: 8,
    },
    dividerLine: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    dividerStar: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
    },
    sub: {
        color: '#FFFFFF',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 4,
    },
    googleBtn: {
        marginTop: 24,
        width: '60%',
        alignSelf: 'center',
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 50,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 11,
        paddingHorizontal: 18,
    },
    googleBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    terms: {
        color: '#6B7280',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 18,
        lineHeight: 18,
    },
    termsLink: {
        color: '#F59E0B',
        fontSize: 12,
    },
    termsGray: {
        color: '#6B7280',
        fontSize: 12,
    },
})
