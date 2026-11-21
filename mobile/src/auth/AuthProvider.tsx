import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { login as apiLogin } from '../api/auth';
import { getCurrentUser } from '../api/users';
import { ApiError } from '../api/client';
import type { CurrentUser } from '../api/types';
import { loadToken, saveToken, clearToken } from './session';

type AuthValue = {
    token: string | null;
    user: CurrentUser | null;
    loading: boolean;
    login: (loginName: string, password: string) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }){
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function restore(){
            const saved = await loadToken();
            if(!saved) return;
            try{
                const{ user: me} = await getCurrentUser(saved);
                setToken(saved);
                setUser(me);
            } catch (e){
                if (e instanceof ApiError && (e.status === 401 || e.status === 4)) {
                    await clearToken();
                }
            }
        }
        restore().finally(()=> setLoading(false));
    }, []);



async function login(loginName: string, password: string) {
    const result = await apiLogin(loginName, password);
    await saveToken(result.token);
    setToken(result.token);
    setUser(result.user);
}

    function logout() {
        clearToken();
        setToken(null);
        setUser(null);
    }

    async function refreshUser(){
        if(!token) return;
        try {
            const{ user: me} = await getCurrentUser(token);
            setUser(me);
        } catch{

        }
    }
    return(
        <AuthContext.Provider value={{ token, user, loading, login, logout, refreshUser }}> 
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(){
    const value = useContext(AuthContext);
    if(!value) throw new Error('useAuth must be used inside AuthProvider');
    return value;
}