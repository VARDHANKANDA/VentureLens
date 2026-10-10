'use strict';
const TEXT_FIELDS = ['businessName','description','industry','stage','businessModel','problemStatement','solutionStatement','targetCustomers','revenueContext','useOfFunds','milestones'];
const TOTAL_SECTIONS = 13;
const GUIDANCE = {
  businessName: 'Add your business name so investors can identify your company.',
  description: 'Write a brief description of your business and what it does.',
  industry: 'Specify your industry so investors can find profiles matching their focus.',
  stage: 'Indicate your current business stage (e.g., Idea, MVP, Seed, Growth).',
  businessModel: 'Describe how your business generates revenue.',
  problemStatement: 'Explain the problem your business solves for customers.',
  solutionStatement: 'Describe the solution your business provides.',
  targetCustomers: 'Define who your target customers are.',
  revenueContext: 'Provide context about your current or projected revenue.',
  fundingGoal: 'Set a funding goal amount to show investors what you are seeking.',
  useOfFunds: 'Explain how you plan to use the funds raised.',
  milestones: 'List key milestones you plan to achieve with this funding.',
  evidenceCoverage: 'Add at least one evidence record to support your profile claims.'
};
function isTextComplete(value) { return typeof value === 'string' && value.trim().length > 0; }
function computeReadiness(profile, hasEvidenceRecords) {
  let completed = 0; const incompleteItems = [];
  for (const field of TEXT_FIELDS) {
    if (isTextComplete(profile[field])) { completed++; }
    else { incompleteItems.push({ section: field, guidance: GUIDANCE[field] }); }
  }
  const fg = profile.fundingGoal;
  if (fg !== null && fg !== undefined && typeof fg === 'number' && fg > 0) { completed++; }
  else { incompleteItems.push({ section: 'fundingGoal', guidance: GUIDANCE.fundingGoal }); }
  if (hasEvidenceRecords) { completed++; }
  else { incompleteItems.push({ section: 'evidenceCoverage', guidance: GUIDANCE.evidenceCoverage }); }
  const percentage = Math.round((completed / TOTAL_SECTIONS) * 100);
  return { completed, total: TOTAL_SECTIONS, percentage, incompleteItems };
}
module.exports = { computeReadiness, TOTAL_SECTIONS, TEXT_FIELDS, GUIDANCE, isTextComplete };