import { test, expect } from '../../src/fixtures/test-fixtures';
import { LoginPage } from '../../src/pages/login-page';
import { ProfilePage } from '../../src/pages/profile-page';

test.describe('Book Store login', () => {
  test('TC-01: login with valid credentials lands on profile', async ({ page, testUser }) => {
    const loginPage = new LoginPage(page);
    const profilePage = new ProfilePage(page);

    await loginPage.goto();
    await loginPage.logIn(testUser.userName, testUser.password);

    await expect(page).toHaveURL(/\/profile$/);
    await expect(profilePage.userNameValue).toHaveText(testUser.userName);
    await expect(profilePage.logoutButton).toBeVisible();
  });

  test('TC-02: login with wrong password is rejected with an error message', async ({ page, testUser }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.logIn(testUser.userName, 'Wr0ng!Pass#9');

    await expect(loginPage.errorMessage).toHaveText('Invalid username or password!');
    await expect(page).toHaveURL(/\/login$/);
  });
});
