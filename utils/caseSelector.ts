// utils/recentCases.ts

const RECENT_CASES_KEY = 'recent_cases';
const MAX_RECENT = 5;

export async function getRecentCases(): Promise<string[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([RECENT_CASES_KEY], (result) => {
      resolve(result[RECENT_CASES_KEY] || []);
    });
  });
}

export async function addRecentCase(caseId: string): Promise<void> {
  const existing = await getRecentCases();
  const updated = [caseId, ...existing.filter((id) => id !== caseId)].slice(
    0,
    MAX_RECENT
  );

  return new Promise((resolve) => {
    chrome.storage.local.set({ [RECENT_CASES_KEY]: updated }, resolve);
  });
}
