const { renderTemplate, esc } = require('../services/emailService');

describe('outbound email templates', () => {
  test('rent due includes amount and pay link', () => {
    const { subject, html } = renderTemplate('rentDue', {
      name: 'Test Tenant',
      hostel: 'Garden',
      month: 'Oct 2026',
      amount: '8000.00',
      dueDate: '05 Oct 2026',
      invoiceNumber: 'INV-1',
      appUrl: 'http://localhost:3000',
    });
    expect(subject).toMatch(/Rent due/);
    expect(html).toContain('₹8000.00');
    expect(html).toContain('http://localhost:3000/rent');
  });

  test('complaint templates escape HTML in the title', () => {
    const assigned = renderTemplate('complaintAssigned', {
      name: 'Test',
      title: '<script>x</script>',
      hostel: 'Garden',
      appUrl: 'http://localhost:3000',
    });
    expect(assigned.html).toContain(esc('<script>x</script>'));
    expect(assigned.html).not.toContain('<script>x</script>');

    const resolved = renderTemplate('complaintResolved', {
      name: 'Test',
      title: 'Tap',
      resolution: '<b>fixed</b>',
      appUrl: 'http://localhost:3000',
    });
    expect(resolved.html).toContain(esc('<b>fixed</b>'));
  });

  test('booking request templates include hostel, room, amount, support for both sides', () => {
    const vars = {
      name: 'Test',
      hostel: 'Garden',
      code: 'BKG-1',
      occupancy: 'Double',
      amount: '18000.00',
      moveIn: '07 Nov 2026',
      supportEmail: 'garden@test.local',
      supportPhone: '08012345678',
      appUrl: 'http://localhost:3000',
    };
    const owner = renderTemplate('bookingRequested', { ...vars, audience: 'owner' });
    const seeker = renderTemplate('bookingRequested', { ...vars, audience: 'seeker' });
    expect(owner.subject).toMatch(/New booking request/);
    expect(seeker.subject).toMatch(/received your request/);
    [owner, seeker].forEach((mail) => {
      expect(mail.html).toContain('Garden');
      expect(mail.html).toContain('Double');
      expect(mail.html).toContain('₹18000.00');
      expect(mail.html).toContain('08012345678');
      expect(mail.html).toContain('garden@test.local');
    });
  });

  test('booking refund owner copy names payout offset', () => {
    const mail = renderTemplate('bookingRefunded', {
      name: 'Owner',
      hostel: 'Garden',
      code: 'BKG-2',
      occupancy: 'Double',
      amount: '18000.00',
      retained: '0.00',
      kind: 'full',
      audience: 'owner',
      supportEmail: 'support@vitastay.com',
      appUrl: 'http://localhost:3000',
    });
    expect(mail.html).toContain('₹18000.00');
    expect(mail.html).toMatch(/payout/i);
    expect(mail.html).toContain('support@vitastay.com');
  });

  test('owner plan grace and lapse templates link Settings → Plan and keep ERP data', () => {
    const grace = renderTemplate('ownerPlanGrace', {
      name: 'Test Owner',
      hostel: 'Garden',
      graceDays: '7',
      appUrl: 'http://localhost:3000',
    });
    expect(grace.subject).toMatch(/Renew/i);
    expect(grace.html).toContain('7 days');
    expect(grace.html).toContain('/settings?tab=plan');
    expect(grace.html).toMatch(/Occupancy, tenants, and photos stay/i);

    const lapsed = renderTemplate('ownerPlanLapsed', {
      name: 'Test Owner',
      hostel: 'Garden',
      appUrl: 'http://localhost:3000',
    });
    expect(lapsed.subject).toMatch(/Regular/);
    expect(lapsed.html).toContain('/settings?tab=plan');
    expect(lapsed.html).toMatch(/Occupancy, tenants, rent, and photos are unchanged/i);
  });

  test('Vita Eye alert names the gate and does not lock doors', () => {
    const mail = renderTemplate('vitaEyeAlert', {
      name: 'Test Owner',
      hostel: 'Garden',
      label: 'Unknown',
      gate: 'front',
      confidence: '0.41',
      appUrl: 'http://localhost:3000',
    });
    expect(mail.subject).toMatch(/Vita Eye/);
    expect(mail.html).toContain('Unknown');
    expect(mail.html).toContain('front');
    expect(mail.html).toContain('Garden');
    expect(mail.html).toMatch(/not locked/i);
    expect(mail.html).toContain('/hostels');
  });
});
