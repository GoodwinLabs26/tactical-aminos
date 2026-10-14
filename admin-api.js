import { getApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-functions.js';
import { siteSettings } from './site-settings.js';
export const adminCommand = async (action,input={}) => (await httpsCallable(getFunctions(getApp(),siteSettings.functionsRegion),'adminCommand')({action,input})).data;
export const initializeCatalog = async () => (await httpsCallable(getFunctions(getApp(),siteSettings.functionsRegion),'initializeDraftCatalog')({})).data;
