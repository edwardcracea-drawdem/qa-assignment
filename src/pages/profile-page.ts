import { Locator, Page } from '@playwright/test';

export class ProfilePage {
  /** Shows the logged-in account's user name. */
  readonly userNameValue: Locator;
  /** Collection rows, scoped to the profile's own grid container. */
  readonly rows: Locator;
  readonly titleLinks: Locator;
  /**
   * Several profile buttons share id="submit" (Logout, Delete Account,
   * Delete All Books) — a genuine SUT defect (BUG-03 in docs/findings.md).
   * The accessible name is the only selector that is actually unambiguous.
   */
  readonly logoutButton: Locator;
  /** The "Delete Book" confirmation modal. */
  readonly deleteModal: Locator;

  constructor(readonly page: Page) {
    this.userNameValue = page.locator('#userName-value');
    this.rows = page.locator('.profile-wrapper tbody tr');
    this.titleLinks = page.locator('.profile-wrapper tbody tr a');
    this.logoutButton = page.getByRole('button', { name: 'Logout' });
    this.deleteModal = page.locator('.modal-content');
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

  /** Clicks the row's trash icon and waits for the confirmation modal. */
  async openDeleteConfirmation(isbn: string): Promise<void> {
    await this.page.locator(`#delete-record-${isbn}`).click();
    await this.deleteModal.waitFor();
  }

  /**
   * Confirms the open delete modal and returns the text of the closing
   * JS alert ("Book deleted.").
   */
  async confirmDeletion(): Promise<string> {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.page.locator('#closeSmallModal-ok').click();
    const dialog = await dialogPromise;
    const message = dialog.message();
    await dialog.accept();
    return message;
  }
}
