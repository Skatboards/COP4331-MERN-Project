import { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { useAuth } from '../auth/AuthProvider';
import { colors } from '../constants/sweeple';

export default function SettingsScreen(){
    const{user, logout, refreshUser} = useAuth();

    useEffect(()=> {
        refreshUser();
    }, []);

    return(
        <SafeAreaView style={styles.screen}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                <Pressable onPress={()=> router.back()} style={styles.back}>
                    <Text style={styles.backText}>← Back</Text>
                </Pressable>

                <Text style={styles.title}>Settings</Text>

                <View style={styles.card}>
                    <Text style= {styles.cardTitle}>Account</Text>

                    {user ? (
                        <>
                        <View style={styles.row}>
                            <Text style={styles.rowLabel}>Username</Text>
                            <Text style={styles.rowValue}>{user.username}</Text>
                        </View>
                        <View style = {styles.row}>
                            <Text style = {styles.rowLabel}>Email</Text>
                            <Text style={styles.rowValue} numberOfLines={1}>{user.email}</Text>
                        </View>

                        <View style={styles.stats}>
                            <View style={styles.stat}>
                                <Text style={styles.statValue}>{user.boardsCompleted}</Text>
                                <Text style={styles.statLabel}>Boards completed</Text>
                            </View>
                            <View style={styles.stat}>
                                <Text style={styles.statValue}>{user.totalClicks}</Text>
                                <Text style={styles.statLabel}>Total clicks</Text>
                            </View>
                            <View style = {styles.stat}>
                                <Text style={styles.statValue}>{user.efficiency}%</Text>
                                <Text style={styles.statLabel}>Efficiency</Text>
                            </View>
                            </View>

                            <Pressable style={styles.signOut} onPress={logout}>
                                <Text style={styles.signOutText}>Sign out</Text>
                            </Pressable>

                        </>
                    ): (
                        <View style={styles.row}>
                            <Text style={styles.rowLabel}>Sign in to view your profile.</Text>
                            <Link href="/sign-in" style={styles.link}>Sign in</Link>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { paddingHorizontal: 24, paddingBottom: 40 },
  back: { alignSelf: 'flex-start', paddingVertical: 8, marginTop: 8 },
  backText: { fontSize: 15, fontWeight: '600', color: colors.brandText },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -1, color: colors.text, marginTop: 16, marginBottom: 20 },
  card: {
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.surface,
    gap: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLabel: { fontSize: 14, color: colors.textSoft, flexShrink: 1 },
  rowValue: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  link: { fontSize: 14, fontWeight: '700', color: colors.brandText, padding: 4 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 4 },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceTint,
    gap: 2,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  signOut: {
    height: 50,
    marginTop: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: colors.error },
});