import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Languages } from 'lucide-react';

export function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();

    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'nl' : 'en');
    };

    return (
        <Button variant="ghost" size="icon" onClick={toggleLanguage} title="Switch Language">
            <div className="flex items-center gap-2">
                <Languages className="h-4 w-4" />
                <span className="text-xs font-bold uppercase">{language}</span>
            </div>
        </Button>
    );
}
