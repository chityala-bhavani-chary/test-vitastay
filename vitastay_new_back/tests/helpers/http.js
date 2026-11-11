const request = require('supertest');
const app = require('../../app');

const login = async (email, password) => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.accessToken;
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { request, app, login, auth };
