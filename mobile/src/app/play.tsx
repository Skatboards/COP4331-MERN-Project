import { View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router';
import { colors } from '../constants/sweeple';
import { useMemo, useState } from 'react';
import { dailySeed, generateBoard } from '../game/minesweeper';
import Cell  from '../components/minesweeper/Cell';
import { newGame, type GameState } from '../game/state';

const seed = dailySeed(new Date());
const GAP = 1;
const SCREEN_PAD = 12;
const FRAME_EDGE = 2 * (8 + 1);
const BOARD_EDGE = 2 * (4 + 1);

export default function PlayScreen(){
    const board = useMemo(() => generateBoard(seed), []);
    
    const { width } = useWindowDimensions();
    const room = width - 2 * SCREEN_PAD - FRAME_EDGE - BOARD_EDGE - (board.cols - 1) * GAP;
    const tile = Math.max(18, Math.min(32, Math.floor(room / board.cols)));
    const gridWidth = board.cols * tile + (board.cols - 1) * GAP;
    const [game, setGame] = useState<GameState>(() => newGame(board, seed));
    const revealed = useMemo(()=> new Set(game.revealed), [game.revealed]);
    const date = new Date().toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'});
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
                    <View style={styles.board}>
                        <View style={[styles.grid, { width: gridWidth}]}>
                            {board.isMine.map((_, index) => (
                                <Cell key={index} size = {tile} revealed = {revealed.has(index)} adjacent = {board.adjacent[index]} />
                            ))}
                        </View>
                    </View>

                </View>
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
});