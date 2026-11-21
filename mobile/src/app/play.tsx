import { View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router';
import { colors } from '../constants/sweeple';
import { useMemo, useState, useEffect, useRef } from 'react';
import { dailySeed, generateBoard, parClicks, efficiency } from '../game/minesweeper';
import Cell  from '../components/minesweeper/Cell';
import { newGame, type GameState } from '../game/state';
import { revealCell, toggleFlag, chordCell, parseSavedGame } from '../game/state';
import AsyncStorage from '@react-native-async-storage/async-storage'
import Animated, {useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAuth } from '../auth/AuthProvider';
import { getGameProgress, saveGameProgress, submitAttempt } from '../api/boards';

const seed = dailySeed(new Date());
const GAP = 1;
const SCREEN_PAD = 12;
const FRAME_EDGE = 2 * (8 + 1);
const BOARD_EDGE = 2 * (4 + 1);
const storageKey = `sweeple.game.${seed}`;
const MAX_ZOOM = 3;

function clamp(value: number, min: number, max: number) {
    'worklet';
    return Math.min(Math.max(value, min), max)
}

export default function PlayScreen(){
    const board = useMemo(() => generateBoard(seed), []);
    
    const { width } = useWindowDimensions();
    const room = width - 2 * SCREEN_PAD - FRAME_EDGE - BOARD_EDGE - (board.cols - 1) * GAP;
    const tile = Math.max(18, Math.min(32, Math.floor(room / board.cols)));
    const viewWidth = board.cols * tile + (board.cols - 1) * GAP;
    const viewHeight = board.rows * tile + (board.rows - 1) * GAP;
    const [game, setGame] = useState<GameState>(() => newGame(board, seed));
    const revealed = useMemo(()=> new Set(game.revealed), [game.revealed]);
    const flags = useMemo(()=> new Set(game.flags), [game.flags]);
    const date = new Date().toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'});
    const [flagMode, setFlagMode] = useState(false);
    const minesLeft = board.mineCount - game.flags.length;
    const finished = game.status !== 'playing';
    const won = game.status === 'won';
    const[loaded, setloaded] = useState(false);
    const scale = useSharedValue(1);
    const x = useSharedValue(0);
    const y = useSharedValue(0);
    const pinchStart = useSharedValue({ scale: 1, x: 0, y: 0, focalX: 0, focalY: 0});
    const panStart = useSharedValue({ x: 0, y: 0});
    
    const { token, loading: authLoading} = useAuth();
    const savedMilestone = useRef(0);
    const safeCells = board.rows * board.cols - board.mineCount;
    function percentCleared(g: GameState) {
        return Math.floor((new Set(g.revealed).size / safeCells) * 100);
    }

    const pinch = Gesture.Pinch()
    .onStart((e) => {
        pinchStart.value = {
            scale: scale.value,
            x: x.value,
            y: y.value,
            focalX: e.focalX - viewWidth / 2,
            focalY: e.focalY - viewHeight / 2,
        };
    })
    .onUpdate((e) => {
        const start = pinchStart.value;
        const s = clamp(start.scale * e.scale, 1, MAX_ZOOM);
        const k = s/ start.scale;
        const maxX= ((s-1) * viewWidth) / 2;
        const maxY = ((s-1) * viewHeight) / 2;
        scale.value = s;
        x.value = clamp(e.focalX - viewWidth / 2 - k * (start.focalX - start.x), -maxX, maxX);
        y.value = clamp(e.focalY - viewHeight / 2 - k * (start.focalY - start.y), -maxY, maxY);
    })
    .onEnd(() => {
        if (scale.value < 1.1){
            scale.value = withTiming(1);
            x.value = withTiming(0);
            y.value = withTiming(0);
        }
    });

    const pan = Gesture.Pan()
        .maxPointers(1)
        .onStart(()=> {
            panStart.value = {x: x.value, y: y.value};
        })
        .onUpdate((e) => {
            const maxX = ((scale.value - 1) * viewWidth) / 2;
            const maxY = ((scale.value - 1) * viewHeight) / 2;
            x.value = clamp(panStart.value.x + e.translationX, -maxX, maxX);
            y.value = clamp(panStart.value.y + e.translationY, -maxY, maxY);
        });

    const zoomGesture = Gesture.Simultaneous(pinch, pan);
    const zoomStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: x.value }, {translateY: y.value}, { scale: scale.value }],
    }));

    const score = useMemo(
        () => (game.status === 'won' ? efficiency(parClicks(board), game.clicks) :0),
        [board, game.status, game.clicks],
    );

    useEffect ( () => {
        if (authLoading) return;
        let active = true;

        async function load() {
            const raw = await AsyncStorage.getItem(storageKey).catch(() => null)
            const local = parseSavedGame(raw, seed, board.rows * board.cols);

            if(!token) {
                if(local && active) setGame(local);
                return;
            }

            try{
                const{game: serverGame, played} = await getGameProgress(token, seed);
                if(!active) return;

                if(played){
                    setGame({
                        seed,
                        revealed: Array.from({ length: board.rows * board.cols}, (_, i) => i). filter(
                            (i) => !board.isMine[i],
                        ),
                        flags: [],
                        clicks: played.clicks,
                        status: played.status,
                        explodedAt: null,
                    });
                    return;
                }

                const fromServer = parseSavedGame(
                    serverGame ? JSON.stringify(serverGame) : null,
                    seed,
                    board.rows * board.cols,
                );
                const restored = fromServer ?? local;
                if (restored) setGame(restored);
                    savedMilestone.current = fromServer ? Math.floor(percentCleared(fromServer) / 10) * 10 : 0;
                } catch {
                if (local && active) setGame(local);
                }
         }
        

        load().finally(() => {
            if (active) setloaded(true);
        });
        return() => {
            active = false;
        };
        }, [authLoading, token]);


    useEffect(() => {
        if(!loaded) return;
        AsyncStorage.setItem(storageKey, JSON.stringify(game)). catch(() => {});
    }, [game, loaded]);

    function update(next: GameState) {
        if(next === game) return;
        setGame(next);
        if (!token) return;

        if(next.status !== 'playing') {
            submitAttempt(token, seed, {
                clicks: next.clicks,
                status: next.status,
                efficiency: next.status === 'won' ? efficiency(parClicks(board), next.clicks) : 0,
                completionPercentage: percentCleared(next),
            }).catch(() => {});
            return;
        }

        const milestone = Math.floor(percentCleared(next) /10 ) * 10;
        if(milestone > savedMilestone.current) {
            savedMilestone.current = milestone;
            saveGameProgress(token, seed, next, percentCleared(next)).catch(() => {});
        }
    }

    function onCellPress(index: number) {
        if(revealed.has(index)) update(chordCell(board, game, index));
        else if (flagMode) update(toggleFlag(game, index));
        else update(revealCell(board, game, index));
    }

    function onCellLongPress(index: number) {
        if(!revealed.has(index)) update(toggleFlag(game, index));
    }
    function resetForTesting(){
        AsyncStorage.removeItem(storageKey).catch(() => {});
        setGame(newGame(board, seed));
    }

    if(!loaded){
        return(
            <SafeAreaView style={[styles.screen, styles.center]}>
                <ActivityIndicator color={colors.brand}/>
            </SafeAreaView>
        );
    }

    return(
        <SafeAreaView style={styles.screen}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                <Pressable onPress={() => router.back()} style={styles.back}>
                    <Text style = {styles.backText}>← Back</Text>
                </Pressable>

                <View style={styles.topline}>
                    <Text style = {styles.title}>Today's board</Text>
                    <Text style= {styles.date}>{date}</Text>
                </View>

                <View style={styles.frame}>
                    <View style={styles.scoreboard}>
                        <Text style={styles.counter}>⚑ {String(minesLeft).padStart(3, '0')} </Text>
                        <Text style={styles.counter}>{String(game.clicks).padStart(3, '0')} clicks</Text>
                    </View>
                    <View style={styles.board}>
                        <GestureDetector gesture={zoomGesture}>
                        <View style={[styles.viewport, { width: viewWidth, height: viewHeight }]}>
                            <Animated.View style={[styles.grid, {width: viewWidth }, zoomStyle ]}>
                            {board.isMine.map(( isMine, index) => (
                                <Cell 
                                key={index} 
                                size = {tile} 
                                revealed = {revealed.has(index)} 
                                adjacent = {board.adjacent[index]}
                                index = {index}
                                onPress = {onCellPress}
                                flagged = {flags.has(index)}
                                onLongPress={onCellLongPress}
                                showMine={finished && isMine && !revealed.has(index)}
                                exploded = {game.explodedAt === index}
                                wrongFlag = {finished && flags.has(index) && !isMine}
                                won = {won}
                                disabled={finished}
                                
                                />
                            ))}
                            </Animated.View>
                        </View>
                        </GestureDetector>
                    </View>

                </View>
                {finished ? (
                    <View style={styles.result}>
                        <Text style = {styles.resultTitle}>{won ? 'Board cleared!' : 'Boom.'}</Text>
                        <Text style = {styles.resultCopy}>
                            {won
                            ? `${game.clicks} clicks * ${score}% efficiency`
                            : `You hit a mine after ${game.clicks} clicks.`}
                            
                        </Text>
                    </View>
                ) :(
                <Pressable
                    style={[styles.modeButton, flagMode && styles.modeButtonOn]}
                    onPress={() => setFlagMode(!flagMode)}
                >
                    <Text style={styles.modeText}>
                        {flagMode ? '⚑ Tapping places flags' : 'Tapping reveals tiles'}
                    </Text>
                </Pressable> )}
                {__DEV__ ?(
                    <Pressable onPress={resetForTesting}>
                        <Text style={styles.devReset}> Reset (testing only)</Text>
                    </Pressable>
                ):null}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {flex: 1, backgroundColor: colors.page, paddingHorizontal: 24},
    back: {alignSelf: 'flex-start', paddingVertical: 8, marginTop: 8},
    backText: { fontSize: 15, fontWeight: '600', color: colors.brandText},
    topline: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16, marginBottom: 20},
    title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.6, color: colors.text},
    date: { fontSize: 13, color: colors.muted},
    content: { paddingHorizontal: SCREEN_PAD, paddingBottom: 40},
    frame: {
        alignSelf: 'center',
        padding: 8,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 12,
        backgroundColor: colors.surfaceTint,
    },
    board: {
        padding: 4,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 7,
        backgroundColor: colors.surfaceTint,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP},
    scoreboard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 8,
        backgroundColor: colors.surface,
    },
    counter: {
        fontSize: 16,
        fontWeight: '800',
        color: colors.brand,
        fontVariant: ['tabular-nums'],
    },
    modeButton: {
        height: 50,
        marginTop: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modeButtonOn: {backgroundColor: colors.lime, borderColor: colors.brand},
    modeText: {fontSize: 15, fontWeight: '700', color: colors.text },
    result: {
        marginTop: 16,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.surface,
        alignItems: 'center',
        gap: 4,
    },
    resultTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
    resultCopy: { fontSize: 14, color: colors.textSoft},
    center: {alignItems: 'center', justifyContent: 'center'},
    devReset: {textAlign: 'center', marginTop: 20, fontSize: 13, color: colors.muted},
    viewport: { overflow: 'hidden'},
});