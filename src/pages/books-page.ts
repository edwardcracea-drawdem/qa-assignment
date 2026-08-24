import { Locator, Page } from '@playwright/test';

export class BooksPage {
  readonly searchBox: Locator;
  /**
   * Real result rows, scoped to the book grid's own container so the
   * locator stays correct even if another table ever joins the page.
   * The redesigned grid renders plain table rows only for actual
   * results, so rows are safe to count directly.
   */
  readonly rows: Locator;
  readonly titleLinks: Locator;

  constructor(readonly page: Page) {
    this.searchBox = page.locator('#searchBox');
    this.rows = page.locator('.books-wrapper tbody tr');
    this.titleLinks = page.locator('.books-wrapper tbody tr a');
  }

  async goto(): Promise<void> {
    await this.page.goto('/books');
    // The list is fetched client-side after the shell renders; the page
    // is not usable until both the search box and the catalog are there.
    await this.searchBox.waitFor();
    await this.rows.first().waitFor();
  }

  async search(query: string): Promise<void> {
    await this.searchBox.fill(query);
  }

  visibleTitles(): Promise<string[]> {
    return this.titleLinks.allTextContents();
  }

  /** Clicks a book's title link, landing on its detail page. */
  async openBook(title: string): Promise<void> {
    await this.page.getByRole('link', { name: title, exact: true }).click();
  }
}
