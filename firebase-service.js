import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, updateProfile, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, updatePassword } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, query, where, orderBy, limit, getDocs, deleteDoc } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-functions.js';
import { firebaseConfig } from './firebase-config.js';
import { siteSettings } from './site-settings.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, siteSettings.functionsRegion);
export const getOrderQuote = async input => (await httpsCallable(functions, 'quoteOrder')(input)).data;
export const placeOrder = async input => (await httpsCallable(functions, 'submitOrder')(input)).data;
export const getLiveCatalog = async () => (await httpsCallable(functions, 'memberCatalog')({})).data;
export async function getCustomerStats(uid) {
  const snapshot = await getDoc(doc(db, 'customerStats', uid));
  return snapshot.exists() ? snapshot.data() : {};
}
export async function getOrders(uid) {
  const snapshot = await getDocs(query(collection(db, 'orders'), where('ownerUid','==',uid), orderBy('createdAt','desc'), limit(50)));
  return snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
}
export const watchSession = callback => onAuthStateChanged(auth, callback);
export const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);
export const resetPassword = email => sendPasswordResetEmail(auth, email);
export async function signup(name, email, password) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: name });
  return credential.user;
}
export async function getProfile(user) {
  const snapshot = await getDoc(doc(db, 'users', user.uid));
  return snapshot.exists() ? snapshot.data() : null;
}
export async function confirmMembership(user) {
  const existing = await getProfile(user);
  if (existing?.ageConfirmed === true) return existing;
  const profile = { name: user.displayName || '', email: user.email, ageConfirmed: true, researchOnlyAccepted: true, termsVersion: '2026-10-07', acceptedAt: serverTimestamp(), createdAt: serverTimestamp() };
  await setDoc(doc(db, 'users', user.uid), profile);
  return profile;
}

function accountUser() {
  if (!auth.currentUser) throw new Error('Sign in to manage your account.');
  return auth.currentUser;
}
async function confirmPassword(user, password) {
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  if (auth.currentUser?.uid !== user.uid) throw new Error('Your session changed. Sign in again.');
}
export async function changeAccountEmail(email, password) {
  const user = accountUser();
  await confirmPassword(user, password);
  await verifyBeforeUpdateEmail(user, email.trim());
}
export async function changeAccountPassword(password, nextPassword) {
  const user = accountUser();
  await confirmPassword(user, password);
  await updatePassword(user, nextPassword);
}
export async function getSavedAddress() {
  const user = accountUser();
  const snapshot = await getDoc(doc(db, 'customerAddresses', user.uid));
  return snapshot.exists() ? snapshot.data() : null;
}
export async function saveAddress(address) {
  const user = accountUser();
  await setDoc(doc(db, 'customerAddresses', user.uid), address);
}
export async function removeAddress() {
  const user = accountUser();
  await deleteDoc(doc(db, 'customerAddresses', user.uid));
}
