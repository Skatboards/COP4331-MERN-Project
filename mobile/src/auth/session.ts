import * as SecureStore from 'expo-secure-store';
import { addTransitionType } from 'react';

const TOKEN_KEY = 'sweeple-token';

export async function loadToken(): Promise<string | null> {
    try{
        return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch{
        return null;
    }
}

export async function saveToken(token: string){
    try{
        await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch {

    }
}

export async function clearToken(){
    try{
        await SecureStore.deleteItemAsync(TOKEN_KEY);

    } catch {
        
    }
}