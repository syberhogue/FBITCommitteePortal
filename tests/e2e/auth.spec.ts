import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("FbitPortal123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/signin/);
}

test("sign-in screen is accessible", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("local administrator can reach the admin dashboard", async ({ page }) => {
  await signIn(page, "admin@fbit.test");
  await page.getByRole("link", { name: "Admin" }).click();
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
});

test("meeting plan moves through Chair approval, attendance, locking, unlock, and archive", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const meetingTitle = `Governance workflow ${Date.now()}`;
  const committeeUrl = "/committees/10000000-0000-0000-0000-000000000001?tab=meetings";

  await signIn(page, "staff@fbit.test");
  await page.goto(committeeUrl);
  await expect(page.getByRole("heading", { name: "Next Meeting" })).toBeVisible();
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  const planner = page.getByRole("heading", { name: "Plan a meeting" }).locator("xpath=..");
  await planner.getByPlaceholder("Meeting title").fill(meetingTitle);
  await planner.locator('input[name="starts_at"]').fill("2026-08-20T10:00");
  await planner
    .locator('[contenteditable="true"][aria-label="Proposed agenda"]')
    .pressSequentially("Approve the annual governance plan");
  await planner
    .locator('[contenteditable="true"][aria-label="Meeting goals"]')
    .pressSequentially("Reach agreement on owners and dates");
  await planner.getByRole("button", { name: "Submit plan for Chair" }).click();

  let planCard = page.locator("section").filter({ hasText: meetingTitle });
  await expect(planCard).toBeVisible();
  await expect(planCard.getByText("Read only for your role", { exact: true })).toBeVisible();
  await expect(planCard.getByRole("button", { name: "Save plan" })).toHaveCount(0);
  await expect(planCard.getByRole("button", { name: "Finalize and schedule" })).toHaveCount(0);

  await signOut(page);
  await signIn(page, "chair@fbit.test");
  await expect(page.getByRole("heading", { name: "Plans requiring finalization" })).toBeVisible();
  await page.getByRole("link").filter({ hasText: meetingTitle }).click();
  planCard = page
    .locator("section")
    .filter({ has: page.locator(`input[name="title"][value="${meetingTitle}"]`) });
  await planCard.getByRole("button", { name: "Finalize and schedule" }).click();

  const nextMeetingSection = page
    .getByRole("heading", { name: "Next Meeting" })
    .locator("xpath=..");
  await expect(nextMeetingSection).toContainText(meetingTitle);
  await expect(nextMeetingSection.getByText("Scheduled", { exact: true })).toBeVisible();
  const scheduledCard = nextMeetingSection.locator("section").filter({ hasText: meetingTitle });
  await scheduledCard.locator("summary").click();
  await expect(scheduledCard.getByText("Approve the annual governance plan")).toBeVisible();
  await expect(scheduledCard.getByText("Meeting notes / minutes", { exact: true })).toBeVisible();

  await signOut(page);
  await signIn(page, "member@fbit.test");
  await expect(page.getByRole("heading", { name: "Your scheduled meetings" })).toBeVisible();
  await expect(page.getByText(meetingTitle, { exact: true })).toBeVisible();
  await page.goto(committeeUrl);
  await expect(page.getByText("Read only for your role", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Plan a meeting" })).toBeVisible();
  await expect(page.getByText(/Planning is unavailable for your committee role/)).toBeVisible();

  await signOut(page);
  await signIn(page, "chair@fbit.test");
  await page.goto(committeeUrl);
  await page
    .getByRole("heading", { name: "Next Meeting" })
    .locator("xpath=..")
    .getByRole("button", { name: "Start meeting" })
    .click();
  await expect(page).toHaveURL(/meetingView=in-progress&focus=.*#meeting-/);
  await expect(page.getByRole("heading", { name: "Meetings in progress" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^In Progress [1-9]\d*$/ })).toBeVisible();

  let activeMeeting = page
    .locator("section")
    .filter({ has: page.locator(`input[name="title"][value="${meetingTitle}"]`) });
  await expect(activeMeeting).toBeInViewport();
  await expect(activeMeeting.getByText("Meeting has started", { exact: true })).toBeVisible();
  await expect(activeMeeting.getByText("in progress", { exact: true })).toBeVisible();
  await activeMeeting.getByLabel("Minutes").pressSequentially("The governance plan was approved.");
  await activeMeeting.getByRole("button", { name: "Save meeting notes" }).click();

  activeMeeting = page
    .locator("section")
    .filter({ has: page.locator(`input[name="title"][value="${meetingTitle}"]`) });
  await activeMeeting.getByRole("button", { name: /Mark present: Morgan Member/ }).click();
  await activeMeeting.getByPlaceholder("New action item").fill("Publish the approved plan");
  await activeMeeting.getByRole("button", { name: "Add" }).click();

  activeMeeting = page
    .locator("section")
    .filter({ has: page.locator(`input[name="title"][value="${meetingTitle}"]`) });
  page.once("dialog", (dialog) => dialog.accept());
  await activeMeeting.getByRole("button", { name: "Complete and lock" }).click();
  let completedCard = page
    .locator("section")
    .filter({ has: page.locator("details") })
    .filter({ hasText: meetingTitle });
  await expect(completedCard.getByText("Locked record", { exact: true })).toBeVisible();
  await expect(completedCard.locator('input[name="title"]')).toHaveCount(0);

  await signOut(page);
  await signIn(page, "staff@fbit.test");
  await page.goto(committeeUrl);
  await page.getByRole("link", { name: /^History/ }).click();
  completedCard = page
    .locator("section")
    .filter({ has: page.locator("details") })
    .filter({ hasText: meetingTitle });
  await completedCard.getByRole("button", { name: "Unlock meeting" }).click();
  await expect(page).toHaveURL(/meetingView=in-progress&focus=.*#meeting-/);

  activeMeeting = page
    .locator("section")
    .filter({ has: page.locator(`input[name="title"][value="${meetingTitle}"]`) });
  await activeMeeting.getByRole("button", { name: /Mark absent: Morgan Member/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await activeMeeting.getByRole("button", { name: "Complete and lock" }).click();

  completedCard = page
    .locator("section")
    .filter({ has: page.locator("details") })
    .filter({ hasText: meetingTitle });
  page.once("dialog", (dialog) => dialog.accept());
  await completedCard.getByRole("button", { name: "Archive" }).click();
  completedCard = page
    .locator("section")
    .filter({ has: page.locator("details") })
    .filter({ hasText: meetingTitle });
  await expect(completedCard.getByText("Archived", { exact: true })).toBeVisible();

  await signOut(page);
  await signIn(page, "admin@fbit.test");
  await page.goto(`${committeeUrl}&meetingView=history`);
  completedCard = page
    .locator("section")
    .filter({ has: page.locator("details") })
    .filter({ hasText: meetingTitle });
  page.once("dialog", (dialog) => dialog.accept());
  await completedCard.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByText(meetingTitle, { exact: true })).toHaveCount(0);
});
