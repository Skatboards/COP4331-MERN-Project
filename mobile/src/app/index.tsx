import { View, Text, ScrollView, StyleSheet} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/sweeple';

export default function LandingScreen(){
    return(
       <SafeAreaView style={styles.screen}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                <View style = {styles.header}>
                    <Text style={styles.wordmark}>
                        sweeple<Text style={{color: colors.brand}}>.</Text>
                    </Text>
                    <Text style={styles.tagline}>One Minesweer board a day. Same for everyone.</Text>
                </View>
            </ScrollView>
       </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.page},
    content: { paddingHorizontal: 24, paddingBottom: 40},
    header: {alignItems: 'center', marginTop: 40, marginBottom: 28, gap: 8},
    wordmark: { fontSize: 36, fontWeight: '800', letterSpacing: -1.8, color: colors.text },
    tagline: { fontSize: 15, color: colors.textSoft, textAlign: 'center'},
});