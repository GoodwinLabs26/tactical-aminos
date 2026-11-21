const keys = ['name','phone','street','apartment','city','state','zip'];
const shippingIds = ['shippingName','shippingPhone','shippingStreet','shippingApartment','shippingCity','shippingState','shippingZip'];
export function normalizeAddress(value) {
  const address = Object.fromEntries(keys.map(key => [key, String(value[key] ?? '').trim()]));
  address.state = address.state.toUpperCase();
  const limits = [100,30,160,80,80,2,10];
  if (keys.some((key,i) => address[key].length > limits[i] || (key !== 'apartment' && address[key].length < 2)) ||
      !/^[A-Z]{2}$/.test(address.state) || !/^\d{5}(-\d{4})?$/.test(address.zip)) {
    throw new Error('Enter a complete US shipping address, two-letter state, and valid ZIP code.');
  }
  return address;
}
export function initAccountSettings({getService}) {
  const $ = id => document.getElementById(id);
  let uid, generation = 0, checkoutEdited = false, addressEdited = false;
  const statusIds = ['addressStatus','emailStatus','passwordStatus'];
  const forms = ['savedAddressForm','changeEmailForm','changePasswordForm'];
  for (const id of shippingIds) $(id).addEventListener('input', () => { checkoutEdited = true; });
  $('savedAddressForm').addEventListener('input', () => { addressEdited = true; });
  const fill = address => keys.forEach(key => { $('saved-'+key).value = address?.[key] || ''; });
  const prefill = address => {
    if (!address || checkoutEdited) return;
    shippingIds.forEach((id,i) => { $(id).value = address[keys[i]] || ''; });
  };
  function errorMessage(error) {
    return ({
      'auth/invalid-credential':'The current password is incorrect. Please try again.',
      'auth/wrong-password':'The current password is incorrect. Please try again.',
      'auth/requires-recent-login':'Please sign out and sign in again, then retry.',
      'auth/email-already-in-use':'That email is already in use by another account.',
      'auth/invalid-email':'Enter a valid email address.',
      'auth/weak-password':'Use a stronger password that meets the account password policy.',
      'auth/password-does-not-meet-requirements':'Use a stronger password that meets the account password policy.',
      'auth/too-many-requests':'Too many attempts. Please wait and try again.',
      'permission-denied':'Your address could not be saved or loaded. Please contact Tactical Aminos.',
      'auth/network-request-failed':'Check your connection and try again.'
    })[error?.code] || 'Unable to complete this change. Please try again.';
  }
  async function perform(formId, statusId, action) {
    const form = $(formId), token = generation;
    if (!uid || form.dataset.busy === 'true') return;
    form.dataset.busy = 'true';
    form.querySelectorAll('button').forEach(button => { button.disabled = true; });
    $(statusId).textContent = 'Please wait…';
    try {
      const api = await getService();
      if (token !== generation) return;
      const result = await action(api);
      if (token === generation) $(statusId).textContent = result;
    } catch (error) {
      if (token === generation) $(statusId).textContent = errorMessage(error);
    } finally {
      if (token === generation) {
        form.dataset.busy = 'false';
        form.querySelectorAll('button').forEach(button => { button.disabled = false; });
        form.querySelectorAll('input[type=password]').forEach(input => { input.value = ''; });
      }
    }
  }
  $('savedAddressForm').addEventListener('submit', event => {
    event.preventDefault();
    let address;
    try { address = normalizeAddress(Object.fromEntries(keys.map(key => [key, $('saved-'+key).value]))); }
    catch (error) { $('addressStatus').textContent = error.message; return; }
    const token = generation;
    perform('savedAddressForm','addressStatus', async api => {
      await api.saveAddress(address);
      if (token === generation) { fill(address); prefill(address); }
      return 'Address saved. It will prefill checkout on your next visit. You can edit shipping details for any order.';
    });
  });
  $('removeSavedAddress').addEventListener('click', () => {
    const token = generation;
    perform('savedAddressForm','addressStatus', async api => {
      await api.removeAddress();
      if (token === generation) {
        fill(null);
        if (!checkoutEdited) shippingIds.forEach(id => { $(id).value = ''; });
      }
      return 'Saved address removed. Existing orders have not changed.';
    });
  });
  $('changeEmailForm').addEventListener('submit', event => {
    event.preventDefault();
    const email = $('newAccountEmail').value.trim(), password = $('emailCurrentPassword').value;
    perform('changeEmailForm','emailStatus', async api => {
      await api.changeAccountEmail(email,password);
      return 'Verification sent to '+email+'. Check your inbox and Spam. Verify the new address, then sign out and sign in with it.';
    });
  });
  $('changePasswordForm').addEventListener('submit', event => {
    event.preventDefault();
    const password = $('passwordCurrent').value, next = $('passwordNew').value;
    if (next !== $('passwordConfirm').value) { $('passwordStatus').textContent = 'Your new passwords do not match.'; return; }
    perform('changePasswordForm','passwordStatus', async api => {
      await api.changeAccountPassword(password,next);
      return 'Password updated. Use your new password the next time you sign in.';
    });
  });
  return { async updateSession(user) {
    if (uid === (user?.uid || null)) return;
    uid = user?.uid || null;
    const token = ++generation;
    checkoutEdited = false; addressEdited = false;
    forms.forEach(id => {
      $(id).reset(); $(id).dataset.busy = 'false';
      $(id).querySelectorAll('button').forEach(button => { button.disabled = false; });
    });
    fill(null);
    shippingIds.forEach(id => { $(id).value = ''; });
    statusIds.forEach(id => { $(id).textContent = ''; });
    if (!user) return;
    $('saved-name').value = user.displayName || '';
    $('addressStatus').textContent = 'Loading saved address…';
    try {
      const api = await getService();
      if (token !== generation) return;
      const address = await api.getSavedAddress();
      if (token !== generation) return;
      // Do not overwrite edits made while the saved address was loading.
      if (!addressEdited) fill(address);
      prefill(address);
      $('addressStatus').textContent = address ? 'Your saved address is ready for checkout.' : 'No address saved yet.';
    } catch (error) {
      if (token === generation) $('addressStatus').textContent = errorMessage(error);
    }
  }};
}
