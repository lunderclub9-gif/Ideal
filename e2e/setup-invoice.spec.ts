import { test, expect } from '@playwright/test';

test('first-run setup reaches dashboard', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Nom réel de votre entreprise').fill('IDEAL Test SARL');
  await page.getByPlaceholder('Votre nom complet').fill('Admin Test');
  await page.getByPlaceholder('Ex. gestionnaire').fill('admin');
  await page.getByPlaceholder('10 caractères minimum').fill('Password1234');
  await page.getByPlaceholder('Répétez le mot de passe').fill('Password1234');
  await page.getByRole('button', { name: 'Créer mon espace et continuer' }).click();

  await expect(page.getByText('Tableau de bord').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Clients' })).toBeVisible();
});
