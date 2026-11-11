const request = require('supertest');
const app = require('../app');

describe('Health Check', () => {
  it('should return 200 for health endpoint', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Auth', () => {
  it('should reject login without credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.statusCode).toBe(422);
  });

  it('should reject invalid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'invalid@test.com',
      password: 'wrongpassword',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Protected Routes', () => {
  it('should reject unauthenticated access', async () => {
    const res = await request(app).get('/api/hostels');
    expect(res.statusCode).toBe(401);
  });

  it('does not expose tenant leave requests', async () => {
    const res = await request(app).get('/api/leave');
    expect(res.statusCode).toBe(404);
  });
});
