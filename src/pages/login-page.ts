import { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly userNameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  /** Populated with "Invalid username or password!" on failed login. */
  readonly errorMessage: Locator;

  constructor(readonly page: Page) {
    this.userNameInput = page.locator('#userName');
    this.passwordInput = page.locator('#password');
    this.loginButton = page.locator('#login');
    this.errorMessage = page.locator('#name');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.loginButton.waitFor();
  }

  async logIn(userName: string, password: string): Promise<void> {
    await this.userNameInput.fill(userName);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}
