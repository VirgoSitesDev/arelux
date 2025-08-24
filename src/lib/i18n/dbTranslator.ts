import { _, locale } from 'svelte-i18n';
import { get, derived } from 'svelte/store';

type DatabaseTerms = Record<string, string>;

function getDatabaseTerms(): DatabaseTerms | null {
    const currentLocale = get(locale);
    
    if (!currentLocale || currentLocale === 'it') {
        return null;
    }
    
    try {
        const translationFunction = get(_);
        const terms = translationFunction('database.terms', { default: "" });

        if (terms && typeof terms === 'object' && !Array.isArray(terms)) {
            const typedTerms = terms as Record<string, unknown>;
            const validTerms: DatabaseTerms = {};

            for (const [key, value] of Object.entries(typedTerms)) {
                if (typeof value === 'string') {
                    validTerms[key] = value;
                }
            }
            
            return Object.keys(validTerms).length > 0 ? validTerms : null;
        }
        
        return null;
    } catch (error) {
        console.warn('Errore nel caricamento delle traduzioni del database:', error);
        return null;
    }
}

export const databaseTerms = derived([locale, _], () => getDatabaseTerms());

export function translateDatabaseText(text: string): string {
    const currentLocale = get(locale);

    if (!text || currentLocale === 'it' || !currentLocale) {
        return text;
    }

    const translations = getDatabaseTerms();
    
    if (!translations || Object.keys(translations).length === 0) {
        return text;
    }
    
    let translatedText = text;

    const sortedKeys = Object.keys(translations).sort((a, b) => b.length - a.length);
    
    for (const italianTerm of sortedKeys) {
        const translatedTerm = translations[italianTerm];

        if (typeof translatedTerm !== 'string') {
            continue;
        }

        const regex = new RegExp(`\\b${escapeRegExp(italianTerm)}\\b`, 'gi');
        
        translatedText = translatedText.replace(regex, (match: string) => {
            if (match === match.toUpperCase()) {
                return translatedTerm.toUpperCase();
            } else if (match === match.toLowerCase()) {
                return translatedTerm.toLowerCase();
            } else if (match[0] === match[0].toUpperCase()) {
                return translatedTerm.charAt(0).toUpperCase() + translatedTerm.slice(1).toLowerCase();
            }
            return translatedTerm;
        });
    }
    
    return translatedText;
}

export function createTranslatedTextStore(text: string) {
    return derived([locale, _], () => translateDatabaseText(text));
}

function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function translateFamilyDisplayName(displayName: string): string {
    return translateDatabaseText(displayName);
}

export function translateObjectDescription(description: string): string {
    return translateDatabaseText(description);
}

export function translateFamilyGroup(groupName: string): string {
    return translateDatabaseText(groupName);
}