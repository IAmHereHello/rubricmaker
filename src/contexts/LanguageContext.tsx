import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { en, Translations } from '../lib/locales/en';
import { nl } from '../lib/locales/nl';

type Language = 'en' | 'nl';

const languages: Record<Language, Translations> = {
    en,
    nl,
};

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguage] = useState<Language>(() => {
        const saved = localStorage.getItem('app-language');
        return (saved as Language) || 'en';
    });

    useEffect(() => {
        localStorage.setItem('app-language', language);
    }, [language]);

    const t = (path: string): string => {
        const keys = path.split('.');
        let current: any = languages[language];

        for (const key of keys) {
            if (current[key] === undefined) {
                console.warn(`Translation missing for key: ${path} in language: ${language}`);
                return path;
            }
            current = current[key];
        }

        return current as string;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
