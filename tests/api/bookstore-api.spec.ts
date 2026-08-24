import { test, expect } from '../../src/fixtures/test-fixtures';

/**
 * API-level checks (assignment bonus). These pin down the contract the UI
 * suite builds on, plus negative paths that are awkward or impossible to
 * reach through the UI (duplicate adds race the alert handling; the
 * registration UI is behind reCAPTCHA).
 */
test.describe('BookStore API', () => {
  test('catalog contract: GET /BookStore/v1/Books returns well-formed books', async ({ api }) => {
    const res = await api.getBooksRaw();
    expect(res.status()).toBe(200);

    const { books } = await res.json();
    expect(books.length).toBeGreaterThan(0);
    for (const book of books) {
      expect(book.isbn).toMatch(/^\d{13}$/);
      expect(book.title).not.toBe('');
      expect(book.author).not.toBe('');
      expect(book.publisher).not.toBe('');
      expect(typeof book.pages).toBe('number');
    }
  });

  test('catalog contract: a single book fetched by ISBN matches its list entry', async ({ api }) => {
    const [expected] = await api.getBooks();
    const res = await api.getBookRaw(expected.isbn);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual(expected);
  });

  test('negative: an unknown ISBN is rejected', async ({ api }) => {
    const res = await api.getBookRaw('0000000000000');
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({
      code: '1205',
      message: 'ISBN supplied is not available in Books Collection!',
    });
  });

  test('negative: token generation fails cleanly for bad credentials', async ({ api }) => {
    const res = await api.generateTokenRaw('no-such-user-000', 'Wr0ng!Pass#9');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('Failed');
    expect(body.token).toBeNull();
  });

  test('TC-08: adding the same book twice is rejected', async ({ api, testUser }) => {
    const [book] = await api.getBooks();

    const first = await api.addBooks(testUser.token, testUser.userId, [book.isbn]);
    expect(first.status()).toBe(201);

    const second = await api.addBooks(testUser.token, testUser.userId, [book.isbn]);
    expect(second.status()).toBe(400);
    expect((await second.json()).message).toBe("ISBN already present in the User's Collection!");

    // The rejected duplicate must not have touched the collection.
    const user = await api.getUser(testUser.token, testUser.userId);
    expect(user.books).toHaveLength(1);
    expect(user.books[0].isbn).toBe(book.isbn);
  });

  test('negative: collection writes require a token', async ({ api, testUser }) => {
    const res = await api.addBooks('not-a-real-token', testUser.userId, ['9781449325862']);
    expect(res.status()).toBe(401);
  });

  test('TC-10 (API level): registration rejects a weak password with the policy message', async ({ api }) => {
    const res = await api.createUserRaw(`qa-ec-weak-${Date.now()}`, 'weak');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('1300');
    expect(body.message).toBe(
      "Passwords must have at least one non alphanumeric character, one digit ('0'-'9'), " +
        "one uppercase ('A'-'Z'), one lowercase ('a'-'z'), one special character and Password " +
        'must be eight characters or longer.',
    );
  });
});
