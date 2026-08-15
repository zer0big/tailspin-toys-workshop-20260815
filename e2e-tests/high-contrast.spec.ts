import { test, expect } from '@playwright/test';

test.describe('High Contrast Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="games-grid"]', { timeout: 10000 });
  });

  test('toggle enables high contrast mode and updates aria-pressed', async ({ page }) => {
    const toggle = page.getByTestId('high-contrast-toggle');

    await test.step('Starts disabled', async () => {
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('html')).not.toHaveClass(/high-contrast/);
    });

    await test.step('Enables high contrast mode on click', async () => {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('html')).toHaveClass(/high-contrast/);
    });

    await test.step('Disables high contrast mode on second click', async () => {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('html')).not.toHaveClass(/high-contrast/);
    });
  });

  test('preference persists after reloading the page', async ({ page }) => {
    const toggle = page.getByTestId('high-contrast-toggle');

    await test.step('Enable high contrast mode', async () => {
      await toggle.click();
      await expect(page.locator('html')).toHaveClass(/high-contrast/);
    });

    await test.step('Reload and verify the preference is restored before content settles', async () => {
      await page.reload();
      await expect(page.locator('html')).toHaveClass(/high-contrast/);
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    });
  });

  test('preference persists across navigation to another page', async ({ page }) => {
    const toggle = page.getByTestId('high-contrast-toggle');

    await test.step('Enable high contrast mode on the home page', async () => {
      await toggle.click();
      await expect(page.locator('html')).toHaveClass(/high-contrast/);
    });

    await test.step('Navigate to the about page and verify the preference carries over', async () => {
      await page.goto('/about');
      await page.waitForSelector('[data-testid="about-section"]', { timeout: 10000 });
      await expect(page.locator('html')).toHaveClass(/high-contrast/);
      await expect(page.getByTestId('high-contrast-toggle')).toHaveAttribute('aria-pressed', 'true');
    });
  });

  test('toggle is keyboard operable and has a visible focus indicator', async ({ page }) => {
    const toggle = page.getByTestId('high-contrast-toggle');

    await toggle.focus();
    await expect(toggle).toBeFocused();

    const hasVisibleFocus = await toggle.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return (styles.outline !== 'none' && styles.outlineWidth !== '0px') || styles.boxShadow !== 'none';
    });
    expect(hasVisibleFocus).toBeTruthy();

    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});
