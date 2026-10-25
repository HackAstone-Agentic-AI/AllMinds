// End-to-end smoke test of the fixes from the win-readiness review, run against a live
// stack (frontend :3000, backend :5000, agents :8000). Works without LLM keys: it checks
// the deterministic paths and that AI paths fail gracefully.
//
//   node e2e/smoke.cjs            (SCREENSHOT_DIR=... to keep screenshots)
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';
const API = process.env.API_URL || 'http://localhost:5000/api';
const SHOTS = process.env.SCREENSHOT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'allminds-e2e-'));

const results = [];
let currentPage = null;
const check = async (name, fn) => {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: error.message.split('\n')[0] });
    console.log(`FAIL  ${name}\n      ${error.message.split('\n').slice(0, 6).join('\n      ')}`);
    if (currentPage) {
      await currentPage
        .screenshot({ path: path.join(SHOTS, `fail-${results.length}.png`), fullPage: true })
        .catch(() => null);
    }
  }
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

(async () => {
  const email = `e2e.${Date.now()}@example.com`;
  const reg = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123', full_name: 'E2E Teacher' }),
  });
  if (!reg.ok) throw new Error(`register failed: ${reg.status}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, permissions: [] });
  const page = await context.newPage();
  currentPage = page;
  const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });

  await check('Login through the UI', async () => {
    await page.goto(`${FRONTEND}/login`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
  });

  await check('W5: load demo classroom from the dashboard', async () => {
    await page.getByRole('button', { name: 'Load demo classroom' }).click();
    await page.getByText('Demo classroom loaded').waitFor({ timeout: 20000 });
  });

  await check('X3/X1: attention list and impact card show data', async () => {
    await page.getByText('Who needs attention').waitFor();
    await page.locator('li', { hasText: '(demo)' }).first().waitFor({ timeout: 15000 });
    await page.getByText('Your impact').waitFor();
    await shot('01-dashboard');
  });

  await check('W1/W8: analytics shows real scores and the agent narrative', async () => {
    await page.goto(`${FRONTEND}/dashboard/learnerAnalytics`);
    await page.getByRole('button', { name: /Thabo \(demo\)/ }).click();
    await page.getByText('Engagement Average').waitFor();
    const engagement = await page.locator('p:has-text("Engagement Average") >> xpath=../../p[contains(@class,"text-3xl")]').innerText();
    assert(engagement !== '0/5', `engagement average is ${engagement}`);
    assert((await page.getByText('Not enough data').count()) === 0, 'support priority says not enough data');
    await page.getByRole('button', { name: 'Analyse with AI' }).click();
    await page.getByText(/is showing an? (declining|stable|improving) overall pattern/).waitFor({ timeout: 30000 });
    await shot('02-analytics');
  });

  await check('W2: support request returns a plan to the page', async () => {
    await page.fill('textarea[placeholder^="Describe the progress-related support need"]', 'Help with reading engagement after absences');
    await page.getByRole('button', { name: 'Get support plan' }).click();
    await page.getByRole('heading', { name: 'Support plan' }).waitFor({ timeout: 60000 });
  });

  await check('W1: progress modal captures engagement, completion and attendance', async () => {
    await page.goto(`${FRONTEND}/dashboard/tools/learner-profiles`);
    await page.getByRole('button', { name: /Progress/ }).first().click();
    await page.selectOption('select >> nth=0', 'Reading');
    await page.selectOption('select >> nth=1', 'Good');
    await page.selectOption('#progress-engagement', '4');
    await page.selectOption('#progress-completion', '3');
    await page.selectOption('#progress-attendance', 'present');
    await page.getByRole('button', { name: 'Save Progress Record' }).click();
    await page.getByText('Engagement 4/5').first().waitFor({ timeout: 15000 });
    await page.keyboard.press('Escape');
  });

  await check('W13: import preview flags names and phone numbers', async () => {
    await page.goto(`${FRONTEND}/dashboard/tools/learner-profiles`);
    const csv = path.join(SHOTS, 'learners.csv');
    fs.writeFileSync(csv, 'Name,Phone,grade,supportNeeds\nSipho Dlamini,082 123 4567,Grade 2,Movement breaks; Visual timer\n');
    await page.setInputFiles('input[type="file"]', csv);
    await page.getByText('Review before upload').waitFor();
    await page.getByText('2 column(s) may identify a learner').waitFor();
    await shot('03-import-preview');
    await page.getByRole('button', { name: /Upload 1 learner/ }).click();
    await page.getByText(/learner uploaded/).waitFor({ timeout: 15000 });
    const learners = await page.evaluate(async (api) => {
      const res = await fetch(`${api}/learners`, { headers: { Authorization: `Bearer ${localStorage.getItem('allminds_token')}` } });
      return res.json();
    }, API);
    const imported = learners.find((l) => !l.anonymous_id.startsWith('DEMO-'));
    assert(imported.profile_data.pseudonym === 'Sipho D.', `pseudonym is ${imported.profile_data.pseudonym}`);
    assert(!('Phone' in imported.profile_data), 'phone column was stored');
    assert(Array.isArray(imported.profile_data.supportNeeds), 'supportNeeds not stored as a list');
  });

  await check('W3: forum accepts "students" and blocks a phone number', async () => {
    await page.goto(`${FRONTEND}/dashboard/community/forum`);
    await page.getByRole('button', { name: /New Post/ }).click();
    await page.fill('input[placeholder="What would you like to discuss?"]', 'Visual timers for my students');
    await page.fill('textarea[placeholder^="Share your experience"]', 'My students settle faster with a sand timer.');
    await page.getByRole('button', { name: /^(Post|Publish|Create Post)/ }).last().click();
    await page.getByText('Post published successfully.').waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: /New Post/ }).click();
    await page.fill('input[placeholder="What would you like to discuss?"]', 'Contact me');
    await page.fill('textarea[placeholder^="Share your experience"]', 'Call me on 082 123 4567');
    await page.getByRole('button', { name: /^(Post|Publish|Create Post)/ }).last().click();
    await page.getByText(/remove a phone number/).waitFor();
  });

  await check('W4/X2/W11: NGO search, AI match fallback, review and training links', async () => {
    await page.goto(`${FRONTEND}/dashboard/professional-development`);
    await page.fill('input[placeholder^="e.g. autism diagnosis"]', 'autism diagnosis');
    await page.selectOption('select', 'KwaZulu-Natal');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('heading', { name: 'Action in Autism' }).first().waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'Ask AI for the best match' }).click();
    await page.getByRole('heading', { name: 'AI recommendations' }).waitFor({ timeout: 30000 });
    await shot('04-ngo-finder');
    await page.getByRole('button', { name: 'Rate' }).first().click();
    await page.getByRole('radio', { name: '4 stars' }).first().click();
    await page.getByRole('button', { name: 'Submit review' }).click();
    await page.getByText('Thanks for your review.').waitFor({ timeout: 15000 });
    await page.getByRole('tab', { name: /Training/ }).click();
    await page.getByRole('heading', { name: 'Understanding Autism' }).waitFor();
  });

  await check('W12: strategy library lists starters and accepts a submission', async () => {
    await page.goto(`${FRONTEND}/dashboard/community/strategies`);
    await page.getByRole('heading', { name: 'First-then board' }).waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'Share a strategy' }).click();
    await page.fill('input[placeholder="Strategy title"]', 'Calm-down jar');
    await page.fill('textarea[placeholder^="What do you do"]', 'Learners shake a glitter jar and breathe until it settles.');
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await page.getByText('Waiting for review').waitFor({ timeout: 15000 });
  });

  await check('W16: visual schedule shows now/next and picture cards', async () => {
    await page.goto(`${FRONTEND}/dashboard/tools/schedule-tracking`);
    const select = page.locator('select').first();
    await select.waitFor();
    const lethabo = await select.locator('option', { hasText: 'Lethabo (demo)' }).getAttribute('value');
    await select.selectOption(lethabo);
    await page.getByText('Now', { exact: true }).waitFor({ timeout: 15000 });
    await page.getByText('Morning circle with visual timetable').waitFor();
    await page.getByRole('button', { name: 'Print schedule' }).waitFor();
    await shot('05-visual-schedule');
  });

  await check('W7/W17: Thandi proposes a calendar event, remembers facts, restores history', async () => {
    await page.goto(`${FRONTEND}/dashboard`);
    await page.getByRole('button', { name: 'Open AI assistant' }).click();
    const input = page.getByPlaceholder('Ask Thandi anything...');
    await input.fill('schedule Grade 3 maths on Friday at 9am');
    await input.press('Enter');
    await page.getByText(/I can add 'Grade 3 maths' on Friday .* at 09:00/).waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.getByText(/Connect Google Calendar in Settings first|Added to your Google Calendar/).waitFor({ timeout: 15000 });
    await input.fill('remember that my class is Grade 3');
    await input.press('Enter');
    await page.getByText("Got it. I'll remember: my class is Grade 3.").waitFor({ timeout: 30000 });
    await shot('06-thandi');
    await page.reload();
    await page.getByRole('button', { name: 'Open AI assistant' }).click();
    await page.getByText('remember that my class is Grade 3').waitFor({ timeout: 15000 });
  });

  await check('W14: language picker is honest about interface coverage', async () => {
    await page.goto(`${FRONTEND}/dashboard`);
    await page.getByRole('button', { name: 'Change language' }).first().click();
    await page.getByText('AI replies; interface partly English').first().waitFor();
  });

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${SHOTS}`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
