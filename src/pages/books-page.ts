import { Locator, Page } from '@playwright/test';

export class BooksPage {
  readonly searchBox: Locator;
  /**
   * Real result rows. The redesigned book grid renders plain table rows
   * only for actual results, so `tbody tr` is safe to count directly.
   */
  readonly rows: Locator;
  readonly titleLinks: Locator;

  constructor(readonly page: Page) {
    this.searchBox = page.locator('#searchBox');
    this.rows = page.locator('tbody tr');
    this.titleLinks = page.locator('tbody tr a');
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
}
