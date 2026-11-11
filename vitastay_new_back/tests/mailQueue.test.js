const { enqueue, flush, pendingCount, resetQueue, setSender } = require('../services/mailQueue');
const { sendSms, isConfigured } = require('../services/smsService');

describe('mail queue', () => {
  afterEach(async () => {
    resetQueue();
    setSender(null);
  });

  test('retries a failed send then succeeds', async () => {
    let n = 0;
    setSender(async () => {
      n += 1;
      if (n < 3) throw new Error('smtp down');
      return { success: true };
    });
    enqueue({ channel: 'email', to: 'a@test.local', subject: 'Rent due', html: '<p>x</p>' });
    await flush();
    expect(n).toBe(3);
    expect(pendingCount()).toBe(0);
  });

  test('drops the job after max attempts', async () => {
    let n = 0;
    setSender(async () => {
      n += 1;
      throw new Error('smtp down');
    });
    enqueue({
      channel: 'email',
      to: 'a@test.local',
      subject: 'Complaint assigned',
      html: '<p>x</p>',
      maxAttempts: 2,
    });
    await flush();
    expect(n).toBe(2);
    expect(pendingCount()).toBe(0);
  });

  test('skips SMS until a provider key is set', async () => {
    const prevKey = process.env.SMS_API_KEY;
    const prevProv = process.env.SMS_PROVIDER;
    try {
      delete process.env.SMS_API_KEY;
      delete process.env.SMS_PROVIDER;
      expect(isConfigured()).toBe(false);
      const result = await sendSms({ to: '9876500002', text: 'hello' });
      expect(result.skipped).toBe(true);
    } finally {
      if (prevKey === undefined) delete process.env.SMS_API_KEY;
      else process.env.SMS_API_KEY = prevKey;
      if (prevProv === undefined) delete process.env.SMS_PROVIDER;
      else process.env.SMS_PROVIDER = prevProv;
    }
  });
});
