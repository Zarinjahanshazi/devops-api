const request = require('supertest');
const app = require('./server');

describe('GET /status', () => {
  it('should return 200 and status ok', async () => {
    const res = await request(app).get('/status');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /health', () => {
  it('should return healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
  });
});

describe('POST /data', () => {
  it('should save data and return id', async () => {
    const res = await request(app)
      .post('/data')
      .send({ payload: 'test data' });
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBeDefined();
  });

  it('should return 400 if payload missing', async () => {
    const res = await request(app)
      .post('/data')
      .send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /data/:id', () => {
  it('should retrieve saved data', async () => {
    const post = await request(app)
      .post('/data')
      .send({ payload: 'hello' });
    const id = post.body.id;
    const res = await request(app).get(`/data/${id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.payload).toBe('hello');
  });

  it('should return 404 for unknown id', async () => {
    const res = await request(app).get('/data/fakeid123');
    expect(res.statusCode).toBe(404);
  });
});