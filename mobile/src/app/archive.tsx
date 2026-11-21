import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { getMyAttempts } from '../api/users';
import { ApiError } from '../api/client';
import type { ArchiveStats, Attempt } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { colors } from '../constants/sweeple';

function attemptDate(attempt: Attempt) {
  const seedDate = attempt.seed?.match(/^daily-(\d{4}-\d{2}-\d{2})$/)?.[1];
  const date = seedDate
    ? new Date(`${seedDate}T00:00:00Z`)
    : attempt.completedAt
      ? new Date(attempt.completedAt)
      : null;
  if (!date || Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function attemptStatus(attempt: Attempt) {
  if (attempt.status === 'won') return 'Won';
  if (attempt.status === 'lost') return 'Lost';
  return 'In progress';
}

export default function ArchiveScreen() {
  const { token, user, logout } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    getMyAttempts(token)
      .then((result) => {
        if (!active) return;
        setAttempts(result.attempts);
        setStats(result.stats);
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) {
          logout();
          return;
        }
        setError(e instanceof Error ? e.message : 'Could not load your archive.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, reload]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>PAST PUZZLES</Text>
        <Text style={styles.title}>Board archive</Text>
        {!user ? (
            <View style={styles.card}>
                <Text style={styles.muted}>Sign in to see your completed boards.</Text>
                <Link href="/sign-in" style={styles.linkStrong}>Sign in</Link>
            </View>
            ) : loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
            ) : error ? (
            <View style={styles.card}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => setReload(reload + 1)}>
                <Text style={styles.linkStrong}>Try again</Text>
                </Pressable>
            </View>
            ) : (
            <>
                {stats ? (
                <View style={styles.statsGrid}>
                    {[
                    { label: 'Games played', value: String(stats.gamesPlayed) },
                    { label: 'Games won', value: String(stats.gamesWon) },
                    { label: 'Win rate', value: `${stats.winRate}%` },
                    { label: 'Avg. efficiency', value: `${stats.averageEfficiency.toFixed(1)}%` },
                    { label: 'Total clicks', value: String(stats.totalClicks) },
                    ].map((item) => (
                    <View key={item.label} style={styles.statBox}>
                        <Text style={styles.statValue}>{item.value}</Text>
                        <Text style={styles.statLabel}>{item.label}</Text>
                    </View>
                    ))}
                </View>
                ) : null}

                {attempts.length === 0 ? (
                <Text style={styles.muted}>You haven't played any boards yet.</Text>
                ) : (
                attempts.map((attempt, index) => (
                    <View key={attempt.id} style={styles.gameCard}>
                    <Text style={styles.gameTag}>{index === 0 ? 'MOST RECENT' : attemptStatus(attempt).toUpperCase()}</Text>
                    <Text style={styles.gameDate}>{attemptDate(attempt)}</Text>
                    <Text
                        style={[
                        styles.gameResult,
                        attempt.status === 'won' && { color: colors.brandText },
                        attempt.status === 'lost' && { color: colors.muted },
                        ]}
                    >
                        {attemptStatus(attempt)} · {attempt.completionPercentage}% complete
                    </Text>
                    <Text style={styles.gameClicks}>
                        {attempt.clicks} clicks
                        {attempt.status === 'won' ? ` · ${attempt.efficiency}% efficiency` : ''}
                    </Text>
                    </View>
                ))
                )}
            </>
            )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { paddingHorizontal: 24, paddingBottom: 40 },
  back: { alignSelf: 'flex-start', paddingVertical: 8, marginTop: 8 },
  backText: { fontSize: 15, fontWeight: '600', color: colors.brandText },
  eyebrow: { marginTop: 16, fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.brand },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -1, color: colors.text, marginBottom: 20 },
  card: {
    padding: 18, 
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 10,
  },
  muted: { fontSize: 14, color: colors.textSoft, textAlign: 'center'},
  linkStrong: { fontSize: 14, fontWeight: '700', color: colors.brandText, padding: 4},
  errorText: { fontSize: 14, color: colors.error, textAlign: 'center'},
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20},
  statBox: {
    width: '47%',
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    backgroundColor: colors.surface,
    gap: 2,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, color: colors.muted},
  gameCard: {
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    backgroundColor: colors.surface,
    gap: 3,
  },
  gameTag: {fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.brand},
  gameDate: {fontSize: 17, fontWeight: '700', color: colors.text},
  gameResult: {fontSize: 14, fontWeight: '600', color: colors.text },
  gameClicks: {fontSize: 13, color: colors.muted },
});