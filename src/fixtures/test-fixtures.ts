import { test as base, request } from '@playwright/test';
import { BookStoreApi, BookStoreUser } from '../api/bookstore-api';

/**
 * Hosts serving ads/analytics on demoqa.com. Blocking them makes tests
 * faster and removes the main source of flakiness (overlaying ad frames,
 * slow third-party loads) without touching application behaviour.
 */
const BLOCKED_HOSTS = [
  'googlesyndication.com',
  'doubleclick.net',
  'adtrafficquality.google',
  'googletagmanager.com',
  'googletagservices.com',
  'google-analytics.com',
  'amazon-adsystem.com',
];

interface Fixtures {
  api: BookStoreApi;
  testUser: BookStoreUser;
}

export const test = base.extend<Fixtures>({
  // Applies to every page in every test: never let ad requests through.
  context: async ({ context }, use) => {
    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (BLOCKED_HOSTS.some((host) => url.includes(host))) {
        return route.abort();
      }
      return route.continue();
    });
    await use(context);
  },

  // API client on its own request context, independent of the browser.
  api: async ({}, use, testInfo) => {
    const ctx = await request.newContext({
      baseURL: testInfo.project.use.baseURL ?? 'https://demoqa.com',
    });
    await use(new BookStoreApi(ctx));
    await ctx.dispose();
  },

  /**
   * A dedicated Book Store account for this test, created through the
   * Account API (the registration UI is behind reCAPTCHA) and deleted in
   * teardown so the shared public backend is left the way we found it.
   */
  testUser: async ({ api }, use, testInfo) => {
    const userName = `qa-ec-${Date.now()}-${testInfo.workerIndex}-${Math.floor(Math.random() * 1e4)}`;
    const password = 'Str0ng!Pass#1';
    const { userId } = await api.createUser(userName, password);
    const token = await api.generateToken(userName, password);
    await use({ userId, userName, password, token });
    try {
      await api.deleteUser({ userId, userName, password });
    } catch (error) {
      // The site occasionally 502s; a leaked throwaway user is not worth
      // failing an otherwise green test over.
      console.warn(`Teardown: could not delete user ${userName}: ${error}`);
    }
  },
});

export { expect } from '@playwright/test';
