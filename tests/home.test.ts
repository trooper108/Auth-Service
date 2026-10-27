import request from 'supertest';
import { app } from '../src/app';

describe('Landing Page (GET /)', () => {
  it('should return HTML landing page with status 200', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');

    // Title
    expect(res.text).toContain('<title>Auth Service</title>');
    expect(res.text).toContain('<h1>Auth Service</h1>');

    // Description
    expect(res.text).toContain('JWT authentication with refresh token rotation, RBAC');
    expect(res.text).toContain('rate limiting and audit logs');

    // Buttons/Links
    expect(res.text).toContain('href="/docs"');
    expect(res.text).toContain('API Docs (Swagger)');
    expect(res.text).toContain('href="/health"');
    expect(res.text).toContain('Health');
    expect(res.text).toContain('href="https://github.com/trooper108/Auth-Service"');
    expect(res.text).toContain('Source on GitHub');

    // Idle note
    expect(res.text).toContain('Free instance, the first request after idle can take up to 50 seconds.');
  });
});
