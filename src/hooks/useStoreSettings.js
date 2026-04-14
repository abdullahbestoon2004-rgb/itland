import { useEffect, useState } from 'react';
import { getSettings, loadSettings, subscribeToSettings } from '../data/settings';

export default function useStoreSettings() {
    const [settings, setSettings] = useState(() => getSettings());
    const [settingsError, setSettingsError] = useState('');
    const [isLoadingSettings, setIsLoadingSettings] = useState(true);

    useEffect(() => {
        let ignore = false;

        const applySettings = (nextSettings) => {
            if (ignore || !nextSettings) {
                return;
            }

            setSettings(nextSettings);
            setSettingsError('');
            setIsLoadingSettings(false);
        };

        const syncSettings = async () => {
            try {
                const nextSettings = await loadSettings();
                applySettings(nextSettings);
            } catch (error) {
                console.error(error);

                if (!ignore) {
                    setSettingsError('Unable to load site settings right now.');
                    setIsLoadingSettings(false);
                }
            }
        };

        syncSettings();

        const unsubscribe = subscribeToSettings((nextSettings) => {
            applySettings(nextSettings);
        });

        return () => {
            ignore = true;
            unsubscribe();
        };
    }, []);

    return {
        settings,
        setSettings,
        settingsError,
        isLoadingSettings,
    };
}
