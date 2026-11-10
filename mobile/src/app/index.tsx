import { useState } from 'react';
import { Pressable, View, Text, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/sweeple';
import { login } from '../api/auth'
import { Link } from 'expo-router';

export default function SignInScreen() {
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [welcome, setWelcome] = useState('');
  async function onSignIn(){
    setError('');
    setLoading(true);
    try {
      const {user} = await login(loginName, password);
      setWelcome(`signed in as ${user.username}`);
      } catch(e){
        setError(e instanceof Error ? e.message : 'Something Went Wrong.');
      } finally{
        setLoading(false)
      }

  } 
  return (
    <SafeAreaView style={styles.screen}>
      <View style = {styles.header}>
        <Text style = {styles.wordmark}>
          {/*The sweeple title centered with the dot, inspiration taken from
          the front end */}
          sweeple<Text style={{ color: colors.brand}}>.</Text>
        </Text>
      </View>
            
      <View style = {styles.form}>
          <Text style = {styles.label}>Email or username</Text>
          <TextInput
            style = {styles.input}
            placeholder = "you@example.com"
            placeholderTextColor= "#999a92"
            autoCapitalize="none"
            value = {loginName}
            onChangeText = {setLoginName}/>
          <Text style = {styles.label}>Password</Text>
          <TextInput 
          style = {styles.input} 
          secureTextEntry
          value = {password}
          onChangeText = {setPassword}
          />
          {error ? <Text style={styles.error}>{error}</Text>: null}
          {welcome ? <Text style={styles.welcome}>{welcome}</Text> : null}
          <Pressable style = {styles.button}
          onPress = {onSignIn}>
            <Text style={styles.buttonText}>Sign in</Text>
          </Pressable>
          <Link href="/register" style = {styles.Link}>
            No Account? <Text style={styles.linkStrong}>Create one</Text>
          </Link>
          </View>
    </SafeAreaView>
  );
}



const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
    paddingHorizontal: 24,
  },
  header: {alignItems: 'center', marginTop: 60, marginBottom: 32, gap: 8},
  wordmark: { fontSize: 36, fontWeight: '800', letterSpacing: -1.8, color: colors.text},
  tagline: {fontSize: 15, color: colors.textSoft, textAlign: 'center'},
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
  welcome: {color: colors.brandText, fontSize: 14, fontWeight: '600', marginTop: 8},
  Link: { textAlign: 'center', marginTop: 16, fontSize: 14, color: colors.textSoft},
  linkStrong: { color: colors.brandText, fontWeight: '700'},
});