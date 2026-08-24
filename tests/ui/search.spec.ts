import { test, expect } from '../../src/fixtures/test-fixtures';
import { BooksPage } from '../../src/pages/books-page';

test.describe('Book Store search', () => {
  test('TC-05: search by partial, case-insensitive title filters the list', async ({ page, api }) => {
    const booksPage = new BooksPage(page);
    const query = 'GIT';

    // Derive the expected result set from the catalog API instead of
    // hardcoding titles: the search filters across title, author and
    // publisher, and the catalog is owned by the demo site, not by us.
    const catalog = await api.getBooks();
    const expected = catalog
      .filter((book) =>
        [book.title, book.author, book.publisher].some((field) =>
          field.toLowerCase().includes(query.toLowerCase()),
        ),
      )
      .map((book) => book.title)
      .sort();
    expect(expected.length, 'the query must match at least one catalog entry').toBeGreaterThan(0);

    await booksPage.goto();
    await booksPage.search(query);

    await expect(booksPage.rows).toHaveCount(expected.length);
    expect((await booksPage.visibleTitles()).sort()).toEqual(expected);
  });

  test('TC-06: search handles no-match and boundary inputs and clears cleanly', async ({ page, api }) => {
    const booksPage = new BooksPage(page);
    const catalog = await api.getBooks();

    await booksPage.goto();

    // Plain non-matching term -> empty grid.
    await booksPage.search('no such book 0000');
    await expect(booksPage.rows).toHaveCount(0);

    // Boundary inputs the filter must survive without matching or breaking:
    // a markup/injection-shaped term, and a whitespace-only term (which the
    // app does not trim -> documented as UX-01 in docs/findings.md).
    for (const term of ['<script>alert(1)</script>', '   ']) {
      await booksPage.search(term);
      await expect(booksPage.rows).toHaveCount(0);
    }
    await expect(booksPage.searchBox).toBeEnabled();

    // Clearing the search restores the full catalog.
    await booksPage.search('');
    await expect(booksPage.rows).toHaveCount(catalog.length);
  });
});
