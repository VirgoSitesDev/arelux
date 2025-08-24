import { browser } from '$app/environment';
import { init, register } from 'svelte-i18n';

const defaultLocale = 'it';

register('it', () => import('./locales/it.json'));
register('en', () => import('./locales/en.json'));

init({
  fallbackLocale: defaultLocale,
  initialLocale: browser ? window.localStorage.getItem('locale') ?? defaultLocale : defaultLocale,
});