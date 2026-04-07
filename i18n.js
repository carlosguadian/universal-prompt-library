// i18n.js - Sistema de traducción simple basado en JSON

const AVAILABLE_LOCALES = ['es', 'en', 'ca'];
const DEFAULT_LOCALE = 'es';

let currentLocale = DEFAULT_LOCALE;
let translations = {};

async function loadLocale(locale) {
  if (!AVAILABLE_LOCALES.includes(locale)) locale = DEFAULT_LOCALE;
  try {
    const response = await fetch(chrome.runtime.getURL(`i18n/${locale}.json`));
    translations = await response.json();
    currentLocale = locale;
  } catch (err) {
    console.error('Error loading locale', locale, err);
    if (locale !== DEFAULT_LOCALE) await loadLocale(DEFAULT_LOCALE);
  }
}

async function initI18n() {
  // Prioridad: 1) preferencia guardada, 2) idioma del navegador, 3) default
  const result = await chrome.storage.local.get('locale');
  let locale = result.locale;

  if (!locale) {
    const browserLang = (navigator.language || 'es').slice(0, 2).toLowerCase();
    locale = AVAILABLE_LOCALES.includes(browserLang) ? browserLang : DEFAULT_LOCALE;
  }

  await loadLocale(locale);
}

async function setLocale(locale) {
  if (!AVAILABLE_LOCALES.includes(locale)) return;
  await loadLocale(locale);
  chrome.storage.local.set({ locale });
}

function getCurrentLocale() {
  return currentLocale;
}

// t('header.search') o t('var.step', { current: 1, total: 5 })
function t(key, params = {}) {
  const parts = key.split('.');
  let value = translations;
  for (const p of parts) {
    if (value && typeof value === 'object' && p in value) {
      value = value[p];
    } else {
      return key; // fallback: muestra la clave si no se encuentra
    }
  }
  if (typeof value !== 'string') return key;

  // Sustituir {param} con los valores
  return value.replace(/\{(\w+)\}/g, (match, name) => {
    return params[name] !== undefined ? params[name] : match;
  });
}
