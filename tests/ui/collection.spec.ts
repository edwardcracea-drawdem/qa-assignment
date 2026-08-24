import { test, expect } from '../../src/fixtures/test-fixtures';
import { LoginPage } from '../../src/pages/login-page';
import { BookDetailPage } from '../../src/pages/book-detail-page';
import { ProfilePage } from '../../src/pages/profile-page';

test.describe('Book Store collection', () => {
  test('TC-07: a logged-in user can add a book to their collection', async ({ page, api, testUser }) => {
    const [book] = await api.getBooks();

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.logIn(testUser.userName, testUser.password);
    await expect(page).toHaveURL(/\/profile$/);

    const detailPage = new BookDetailPage(page);
    await detailPage.gotoBook(book.isbn);
    const alertText = await detailPage.addToCollection();
    expect(alertText).toBe('Book added to your collection.');

    const profilePage = new ProfilePage(page);
    await profilePage.goto();
    await expect(profilePage.bookRow(book.title)).toBeVisible();
    await expect(profilePage.rows).toHaveCount(1);
  });

  test('TC-09: deleting a book from the profile removes it from the collection', async ({ page, api, testUser }) => {
    // Seed the collection through the API; the UI part under test here
    // is deletion, not adding.
    const [book] = await api.getBooks();
    const seed = await api.addBooks(testUser.token, testUser.userId, [book.isbn]);
    expect(seed.status()).toBe(201);

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.logIn(testUser.userName, testUser.password);
    // Login redirects to /profile on its own; navigating away before the
    // redirect settles loses the fresh session.
    await expect(page).toHaveURL(/\/profile$/);

    const profilePage = new ProfilePage(page);
    await profilePage.waitForLoaded();
    await expect(profilePage.bookRow(book.title)).toBeVisible();

    const alertText = await profilePage.deleteBook(book.isbn);
    expect(alertText).toBe('Book deleted.');

    await expect(profilePage.rows).toHaveCount(0);
  });
});
