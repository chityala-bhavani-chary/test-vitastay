const {
  isProtectedDatabase,
  assertDrillTarget,
  assertProductionConfirm,
} = require('../scripts/restoreGuard');

describe('restore guards', () => {
  it('protects live master and engine schemas', () => {
    expect(isProtectedDatabase('nivas_hostel')).toBe(true);
    expect(isProtectedDatabase('mysql')).toBe(true);
    expect(isProtectedDatabase('nivas_hostel_restore_drill')).toBe(false);
    expect(isProtectedDatabase('vitastay_nph001')).toBe(false);
  });

  it('refuses a drill onto nivas_hostel', () => {
    expect(() => assertDrillTarget('nivas_hostel')).toThrow(/protected database/);
  });

  it('refuses production restore without typed confirmation', () => {
    expect(() => assertProductionConfirm({ confirm: '', nodeEnv: 'staging', flags: [] }))
      .toThrow(/--confirm RESTORE/);
    expect(() => assertProductionConfirm({
      confirm: 'RESTORE',
      nodeEnv: 'production',
      flags: [],
    })).toThrow(/--i-am-restoring-production/);
    expect(() => assertProductionConfirm({
      confirm: 'RESTORE',
      nodeEnv: 'production',
      flags: ['--i-am-restoring-production'],
    })).not.toThrow();
  });
});
