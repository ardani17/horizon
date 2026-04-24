import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../bot/src/index';

describe('Bot Express Server', () => {
  // ---- GET /api/bot/status ----

  describe('GET /api/bot/status', () => {
    it('returns 200 with success response', async () => {
      const res = await request(app).get('/api/bot/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('includes status, uptime, startedAt, and timestamp in data', async () => {
      const res = await request(app).get('/api/bot/status');
      const { data } = res.body;

      expect(data.status).toBe('running');
      expect(typeof data.uptime).toBe('number');
      expect(data.uptime).toBeGreaterThanOrEqual(0);
      expect(data.startedAt).toBeTruthy();
      expect(data.timestamp).toBeTruthy();
    });

    it('returns valid ISO 8601 timestamps', async () => {
      const res = await request(app).get('/api/bot/status');
      const { data } = res.body;

      const startedAt = new Date(data.startedAt);
      expect(startedAt.toISOString()).toBe(data.startedAt);

      const timestamp = new Date(data.timestamp);
      expect(timestamp.toISOString()).toBe(data.timestamp);
    });

    it('includes botTokenConfigured field', async () => {
      const res = await request(app).get('/api/bot/status');
      expect(typeof res.body.data.botTokenConfigured).toBe('boolean');
    });
  });

  // ---- POST /webhook/telegram ----

  describe('POST /webhook/telegram', () => {
    it('returns 200 for a valid request body', async () => {
      const res = await request(app)
        .post('/webhook/telegram')
        .send({ update_id: 123 });

      expect(res.status).toBe(200);
    });

    it('accepts empty body without crashing', async () => {
      const res = await request(app)
        .post('/webhook/telegram')
        .send({});

      // Should not return 500
      expect(res.status).toBeLessThan(500);
    });
  });

  // ---- 404 for unknown routes ----

  describe('Unknown routes', () => {
    it('returns 404 for unregistered GET routes', async () => {
      const res = await request(app).get('/api/bot/nonexistent');
      expect(res.status).toBe(404);
    });

    it('returns 404 for unregistered POST routes', async () => {
      const res = await request(app).post('/api/bot/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
