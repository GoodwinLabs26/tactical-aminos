import { getApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-functions.js';
import { siteSettings } from './site-settings.js';
export const adminCommand = async (action,input={}) => (await httpsCallable(getFunctions(getApp(),siteSettings.functionsRegion),'adminCommand')({action,input})).data;
export const initializeCatalog = async () => (await httpsCallable(getFunctions(getApp(),siteSettings.functionsRegion),'initializeDraftCatalog')({})).data;

export const reportOrders = async input => (await httpsCallable(getFunctions(getApp(),siteSettings.functionsRegion),'reportOrders')(input)).data;
export const manageProductCoa = async input => (await httpsCallable(getFunctions(getApp(),siteSettings.functionsRegion),'manageProductCoa')(input)).data;
export const setLaunchInventory = async () => (await httpsCallable(getFunctions(getApp(),siteSettings.functionsRegion),'setLaunchInventory')({confirmation:'SET ALL STOCK TO 100'})).data;

export async function watchDashboardChanges(onChange,onError) {
  const {getFirestore,doc,onSnapshot}=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js');
  return onSnapshot(doc(getFirestore(getApp()),'adminLive','dashboard'),{includeMetadataChanges:true},snapshot=>{
    if(!snapshot.metadata.fromCache)onChange();
  },onError);
}

export const promotionsAdmin = async input => (await httpsCallable(getFunctions(getApp(),siteSettings.functionsRegion),'promotionsAdmin',{timeout:120000})(input)).data;

export const manageSales = async input => (await httpsCallable(getFunctions(getApp(),siteSettings.functionsRegion),'manageSales')(input)).data;
