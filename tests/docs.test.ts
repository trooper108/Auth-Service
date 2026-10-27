import request from 'supertest';
import { app } from '../src/app';

describe('Swagger Documentation (GET /docs)', () => {
  it('should serve Swagger UI at /docs', async () => {
    const res = await request(app).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });

  it('should redirect /docs to /docs/ with trailing slash', async () => {
    const res = await request(app).get('/docs');
    expect([200, 301, 302]).toContain(res.status);
  });
});
