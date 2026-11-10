import { Pressable, ActivityIndicator, Text, View, StyleSheet, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/sweeple';
import { useState } from 'react'
import { register} from '../api/auth';


export default function RegisterScreen() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const[password, setPassword] = useState('');
    const[confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState('');
    const [welcome, setWelcome] = useState('');
    function findProblem(): string | null{
        if(!/^[A-Za-z0-9_]{3,20}$/.test(username.trim())){
            return 'Username must be 3-20 letters, numbers, or underscores.';
        }
        if (!email.includes('@')) return 'Enter a valid email address.';
        if(password.length < 8) return 'Password must be at least 8 characters.';
        if( password != confirm) return 'Passwords dont match.';
        return null;
    }
    async function onRegister(){
        const problem = findProblem();
        if(problem) {setError(problem); return; }

        setError('');
        setLoading(true);
        try{
            const{ message } = await register({
                username: username.trim(),
                email: email.trim(),
                password,
            });
            setDone(message || 'Account created. Check your email to verify it, then sign in.');
        } catch (e){
            setError(e instanceof Error ? e.message : 'Something went wrong.');
        } finally{
            setLoading(false);
        }

        
    }
    return (
        <SafeAreaView style = {styles.screen}>
            <ScrollView keyboardShouldPersistTaps='handled' showsVerticalScrollIndicator={false}>
            <View style = {styles.header}>
                <Text style = {styles.title}>Create an account</Text>
                <Text style = {styles.tagline}>Play today's board and keep your streak.</Text>
            </View>
            <View style={styles.form}>
                <Text style={styles.label}>Username</Text>
                <TextInput style = {styles.input} placeholder = "3-20 letters, numbers, or _"
                autoCapitalize='none'
                autoCorrect = {false}
                value = {username}
                onChangeText = {setUsername}/>

                <Text style = {styles.label}>Email</Text>
                <TextInput style = {styles.input} placeholder = "you@example.com"
                autoCapitalize='none'
                keyboardType = "email-address"
                value = {email}
                onChangeText = {setEmail}/>

                <Text style = {styles.label}>Password</Text>
                <TextInput style = {styles.input} placeholder="8+ characters"
                secureTextEntry
                value = {password}
                onChangeText = {setPassword}/>

                <Text style = {styles.label}>Confirm password</Text>
                <TextInput style = {styles.input}
                secureTextEntry
                value={confirm}
                onChangeText = {setConfirm} />
            
                </View>
               {error ? <Text style={styles.error}>{error}</Text>: null}
                <Pressable style = {styles.button}
                onPress = {onRegister}>
                <Text style={styles.buttonText}>Register</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.page, paddingHorizontal: 24},
    header: { alignItems: 'center', marginTop: 40, marginBottom: 24, gap: 8},
    title: {fontSize: 28, fontWeight: '800', letterSpacing: -1, color: colors.text},
    tagline: { fontSize: 15, color: colors.textSoft, textAlign: 'center'},
    form: { gap: 8},
    label: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 8},
    input: {
    height: 50, 
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14, 
    fontSize: 16,
    color: colors.text
    },
    button:{
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    },
    buttonText: {fontSize: 17, fontWeight: '700', color: colors.text},
    error: { color: colors.error, fontSize: 14, marginTop: 8},
})
