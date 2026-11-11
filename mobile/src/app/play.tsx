import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router';
import { colors } from '../constants/sweeple';

const SIZE = 16;
const TILE = 32;
const GAP = 3;
const cells = Array.from({ length: SIZE * SIZE });

export default function PlayScreen(){
    const date = new Date().toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'});
    return(
        <SafeAreaView style={styles.screen}>
            <Pressable onPress={() => router.back()} style = {styles.back}>
                <Text style = {styles.backText}>← Back</Text>
            </Pressable>

            <View style={styles.topline}>
                <Text style={styles.title}> Today's board</Text>
                <Text style={styles.date}>{date}</Text>
            </View>
            <View style= {styles.boardCard}>
                <View style = {styles.board}>
                    {cells.map((_, index) => (
                        <View key={index} style={styles.cell}/>
                    ))}
                </View>
            </View>
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
    boardCard: { alignItems: 'center', padding: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: colors.surface},
    board: { width: SIZE * TILE + (SIZE - 1) * GAP, flexDirection: 'row', flexWrap: 'wrap', gap: GAP},
    cell: {
        width: TILE, height: TILE, borderRadius: 5,
        borderWidth: 1, borderColor: colors.cellBorder,
        borderBottomWidth: 3, borderBottomColor: colors.cellShadow,
        backgroundColor: colors.cell,
    },
});