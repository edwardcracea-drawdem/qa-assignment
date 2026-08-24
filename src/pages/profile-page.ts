import { Locator, Page } from '@playwright/test';

export class ProfilePage {
  /** Shows the logged-in account's user name. */
  readonly userNameValue: Locator;
  readonly rows: Locator;
  readonly titleLinks: Locator;
  /**
   * Several profile buttons share id="submit" (Logout, Delete Account,
   * Delete All Books) — a genuine SUT defect worth reporting. The
   * accessible name is the only selector that is actually unambiguous.
   */
  readonly logoutButton: Locator;

  constructor(readonly page: Page) {
    this.userNameValue = page.locator('#userName-value');
    this.rows = page.locator('tbody tr');
    this.titleLinks = page.locator('tbody tr a');
    this.logoutButton = page.getByRole('button', { name: 'Logout' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/profile');
    await this.waitForLoaded();
  }

  /** Waits until the profile has rendered for a logged-in user. */
  async waitForLoaded(): Promise<void> {
    await this.userNameValue.waitFor();
  }

  bookRow(title: string): Locator {
    return this.rows.filter({ has: this.page.getByRole('link', { name: title, exact: true }) });
  }

  /**
   * Deletes one book via the row's trash icon, confirming the
   * "Do you want to delete this book?" modal, and returns the text of
   * the closing JS alert ("Book deleted.").
   */
  async deleteBook(isbn: string): Promise<string> {
    await this.page.locator(`#delete-record-${isbn}`).click();
    const modal = this.page.locator('.modal-content');
    await modal.waitFor();
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.page.locator('#closeSmallModal-ok').click();
    const dialog = await dialogPromise;
    const message = dialog.message();
    await dialog.accept();
    return message;
  }
}
