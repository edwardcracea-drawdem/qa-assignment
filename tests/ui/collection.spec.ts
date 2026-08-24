import { test, expect } from '../../src/fixtures/test-fixtures';
import { LoginPage } from '../../src/pages/login-page';
import { BooksPage } from '../../src/pages/books-page';
import { BookDetailPage } from '../../src/pages/book-detail-page';
import { ProfilePage } from '../../src/pages/profile-page';

test.describe('Book Store collection', () => {
  test('TC-07: a logged-in user can add a book to their collection', async ({ page, api, testUser }) => {
    // The book under test is the first catalog entry, taken from the API
    // rather than hard-coded — the catalog belongs to the demo site.
    const [book] = await api.getBooks();

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.logIn(testUser.userName, testUser.password);
    await expect(page).toHaveURL(/\/profile$/);

    // The documented user journey: list -> title click -> detail page.
    const booksPage = new BooksPage(page);
    await booksPage.goto();
    await booksPage.openBook(book.title);
    await expect(page).toHaveURL(new RegExp(book.isbn));

    const detailPage = new BookDetailPage(page);
    await detailPage.waitForLoaded();
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

    await profilePage.openDeleteConfirmation(book.isbn);
    await expect(profilePage.deleteModal).toContainText('Do you want to delete this book?');
    const alertText = await profilePage.confirmDeletion();
    expect(alertText).toBe('Book deleted.');

    await expect(profilePage.rows).toHaveCount(0);

    // Deleting from a personal collection must not touch the shared catalog.
    const catalogAfter = await api.getBooks();
    expect(catalogAfter.some((b) => b.isbn === book.isbn)).toBe(true);
  });
});
