import { Locator, Page } from '@playwright/test';

export class BookDetailPage {
  readonly addToCollectionButton: Locator;

  constructor(readonly page: Page) {
    this.addToCollectionButton = page.getByRole('button', { name: 'Add To Your Collection' });
  }

  /** The detail view is addressed as /books?search=<isbn>. */
  async gotoBook(isbn: string): Promise<void> {
    await this.page.goto(`/books?search=${isbn}`);
    await this.page.getByText(`${isbn}`).first().waitFor();
  }

  /**
   * Clicks "Add To Your Collection" and returns the text of the JS alert
   * the application raises in response ("Book added to your collection."
   * on success, "Book already present in the your collection!" — sic —
   * on a duplicate).
   */
  async addToCollection(): Promise<string> {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.addToCollectionButton.click();
    const dialog = await dialogPromise;
    const message = dialog.message();
    await dialog.accept();
    return message;
  }
}
