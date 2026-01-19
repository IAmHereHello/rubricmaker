import AES from 'crypto-js/aes';
import encUtf8 from 'crypto-js/enc-utf8';

const STORAGE_KEY = 'RUBRIC_PRIVACY_KEY';

/**
 * Retrieves the stored privacy key from localStorage.
 */
export function getPrivacyKey(): string | null {
    return localStorage.getItem(STORAGE_KEY);
}

/**
 * Saves the privacy key to localStorage.
 */
export function setPrivacyKey(key: string): void {
    localStorage.setItem(STORAGE_KEY, key);
}

/**
 * Removes the privacy key from localStorage.
 */
export function clearPrivacyKey(): void {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Encrypts a text string using AES encryption with the provided key.
 * If no key is provided, it attempts to use the stored key.
 * Throws an error if no key is available.
 */
export function encrypt(text: string, key?: string): string {
    const encryptionKey = key || getPrivacyKey();
    if (!encryptionKey) {
        throw new Error('No encryption key provided or found in storage.');
    }
    return AES.encrypt(text, encryptionKey).toString();
}

/**
 * Decrypts a ciphertext string using AES encryption with the provided key.
 * If no key is provided, it attempts to use the stored key.
 * Returns null if decryption fails (e.g., wrong key).
 */
export function decrypt(ciphertext: string, key?: string): string | null {
    const decryptionKey = key || getPrivacyKey();
    if (!decryptionKey) {
        throw new Error('No decryption key provided or found in storage.');
    }

    try {
        const bytes = AES.decrypt(ciphertext, decryptionKey);
        const decryptedData = bytes.toString(encUtf8);
        if (!decryptedData) return null; // Logic for wrong key often results in empty string or malformed utf8
        return decryptedData;
    } catch (error) {
        console.warn('Decryption failed:', error);
        return null;
    }
}
