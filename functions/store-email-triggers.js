import { createHash } from 'node:crypto';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { renderOrderEmails, renderLowStockEmail } from './email-templates.js';

const apiKey = defineSecret('RESEND_API_KEY');
const sender = defineString('SHIPPING_EMAIL_FROM');
const adminEmail = 'goodwinlabs.co@gmail.com';
const options = {
  region: 'us-central1',
  maxInstances: 3,
  minInstances: 0,
  timeoutSeconds: 60,
  memory: '256MiB',
  secrets: [apiKey],
  retry: true
};

const validEmail = value =>
  typeof value === 'string' &&
  /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value);

class DeliveryError extends Error {
  constructor(retryable) {
    super('Email delivery was not confirmed.');
    this.retryable = retryable;
  }
}

async function send(message, recipient, key) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: 'Bearer ' + apiKey.value(),
      'Content-Type': 'application/json',
      'Idempotency-Key': key
    },
    body: JSON.stringify({
      from: sender.value(),
      to: [recipient],
      reply_to: adminEmail,
      subject: message.subject,
      html: message.html,
      text: message.text
    })
  });

  if (!response.ok) {
    throw new DeliveryError(
      [408, 409, 429].includes(response.status) || response.status >= 500
    );
  }

  const result = await response.json();
  if (typeof result.id !== 'string' || !result.id) {
    throw new DeliveryError(true);
  }
  return result.id;
}

async function deliver(event, makeJobs) {
  if (!event.data) return;

  const ref = getFirestore().doc(event.data.ref.path);
  const current = await ref.get();
  if (!current.exists) return;

  const status = current.data().emailDelivery || {};
  if (['sent', 'failed', 'expired'].includes(status.state)) return;

  // Retries must stay inside the provider's 24-hour duplicate protection.
  const eventTime = Date.parse(event.time);
  if (!Number.isFinite(eventTime) ||
      Date.now() - eventTime > 23 * 60 * 60 * 1000) {
    await ref.set({
      emailStatus: 'expired',
      emailDelivery: { ...status, state: 'expired' }
    }, { merge: true });
    console.error('Email event expired; manual review required.', {
      eventId: event.id
    });
    return;
  }

  let jobs;
  try {
    jobs = makeJobs(event.data.data());
  } catch {
    await ref.set({
      emailStatus: 'failed',
      emailDelivery: { ...status, state: 'failed' }
    }, { merge: true });
    console.error('Email data needs review.', { eventId: event.id });
    return;
  }

  if (!jobs.length) return;

  const delivered = { ...(status.delivered || {}) };
  const eventKey = createHash('sha256').update(event.id).digest('hex');

  for (const job of jobs) {
    if (delivered[job.kind]) continue;

    let providerId;
    try {
      providerId = await send(
        job.message, job.recipient, eventKey + '-' + job.kind
      );
    } catch (error) {
      const permanent =
        error instanceof DeliveryError && !error.retryable;

      await ref.set({
        emailStatus: permanent ? 'failed' : 'retrying',
        emailDelivery: {
          state: permanent ? 'failed' : 'retrying',
          delivered
        }
      }, { merge: true });

      if (permanent) {
        console.error('Email rejected; manual review required.', {
          eventId: event.id, kind: job.kind
        });
        return;
      }
      throw new Error('Email delivery not confirmed; retrying.');
    }

    delivered[job.kind] = providerId;
    await ref.set({
      emailDelivery: { state: 'sending', delivered }
    }, { merge: true });
  }

  await ref.set({
    emailStatus: 'sent',
    emailDelivery: {
      state: 'sent',
      delivered,
      acceptedAt: FieldValue.serverTimestamp()
    }
  }, { merge: true });
}

export const notifyNewOrder = onDocumentCreated({
  ...options, document: 'orders/{orderId}'
}, event => deliver(event, order => {
  if (!validEmail(order.customer?.email)) {
    throw new Error('Customer email needs review.');
  }
  return renderOrderEmails(order).map(message => {
    if (!['customer-confirmation', 'admin-order-alert'].includes(message.kind)) {
      throw new Error('Unexpected email type.');
    }
    return {
      kind: message.kind,
      message,
      recipient: message.kind === 'customer-confirmation'
        ? order.customer.email : adminEmail
    };
  });
}));

export const notifyLowStock = onDocumentCreated({
  ...options, document: 'notifications/{noticeId}'
}, event => deliver(event, notice => {
  if (notice.kind !== 'low-stock') return [];
  const createdAt = notice.createdAt?.toDate instanceof Function
    ? notice.createdAt.toDate().toISOString() : notice.createdAt;

  return [{
    kind: 'low-stock',
    recipient: adminEmail,
    message: renderLowStockEmail({ ...notice, createdAt })
  }];
}));
