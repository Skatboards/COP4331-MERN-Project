import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/sweeple';
import { Link } from 'expo-router';

const previewTiles = Array.from({ length: 25 });
const rules = [
    { title: 'Starting', copy: "The board automatically reveals today's starting area."},
    { title: 'Progressing', copy: 'Each number shows how many of the 8 surrounding tiles contain mines.'},
    { title: 'Switching modes', copy: 'Use the mode button to switch between Dig and Flag. In Dig mode, tapping a tile reveals it. In Flag mode, tapping a tile marks it as a mine.'},
    { title: 'Chording', copy: 'In Dig mode, tap a number to reveal its neighbors when the flags around it match the number'},
    { title: 'Winning', copy: 'Reveal every safe tile to win.'},  
];
export default function LandingScreen() {
    return (
        <SafeAreaView style={styles.screen}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.wordmark}>
                        sweeple<Text style={{ color: colors.brand }}>.</Text>
                    </Text>
                    <Text style={styles.tagline}>One Minesweeper board a day. Same for everyone.</Text>
                </View>

                <Link href="/play" asChild>
                    <Pressable style={styles.card}>
                        <View style={styles.previewBoard}>
                            {previewTiles.map((_, index) => (
                                <View key={index} style={styles.previewTile} />
                            ))}
                        </View>
                        <Text style={styles.cardLabel}>
                            Play today's puzzle <Text style={{ color: colors.brand }}>→</Text>
                        </Text>
                    </Pressable>
                </Link>
                <Link href="/sign-in" style={styles.signIn}>Sign in</Link>
                <View style = {styles.rules}>
                    <Text style = {styles.rulesTitle}>How to play</Text>
                    {rules.map((rule, index) => (
                        <View key={rule.title} style={styles.ruleCard}>
                            <Text style = {styles.ruleNumber}>{String(index + 1).padStart(2,'0')}</Text>
                            <Text style = {styles.ruleTitle}>{rule.title}</Text>
                            <Text style = {styles.ruleCopy}>{rule.copy}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.page },
    content: { paddingHorizontal: 24, paddingBottom: 40 },
    header: { alignItems: 'center', marginTop: 40, marginBottom: 28, gap: 8 },
    wordmark: { fontSize: 36, fontWeight: '800', letterSpacing: -1.8, color: colors.text },
    tagline: { fontSize: 15, color: colors.textSoft, textAlign: 'center' },
    card: {
        alignItems: 'center', gap: 14, paddingTop: 18, paddingBottom: 14,
        borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: colors.surface,
    },
    previewBoard: { width: 5 * 42 + 4 * 4, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    previewTile: {
        width: 42, height: 42, borderRadius: 6,
        borderWidth: 1, borderColor: colors.cellBorder,
        borderBottomWidth: 4, borderBottomColor: colors.cellShadow,
        backgroundColor: colors.cell,
    },
    cardLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    signIn : {alignSelf: 'center', marginTop: 12, padding: 8, fontSize: 14, fontWeight: '700', color: colors.textSoft},
    rules: { marginTop: 28, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.line, gap: 10},
    rulesTitle: {fontSize: 23, fontWeight: '800', letterSpacing: -0.6, color: colors.text, marginBottom: 4},
    ruleCard: { padding: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.surface, gap: 4},
    ruleNumber: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.brand},
    ruleTitle: { fontSize: 15, fontWeight: '700', color: colors.text},
    ruleCopy: { fontSize: 13, lineHeight: 19, color: colors.muted},
});