import type { TemplateVariables } from "@/types";

export function renderTemplate(
  text: string,
  vars: TemplateVariables
): string {
  return text
    .replace(/\{\{firstName\}\}/g, vars.firstName)
    .replace(/\{\{role\}\}/g, vars.role)
    .replace(/\{\{location\}\}/g, vars.location)
    .replace(/\{\{company\}\}/g, vars.company);
}

export function getTemplateVariablesFromCandidate(candidate: {
  fullName: string;
  role: string;
  location: string;
  currentEmployer: string;
}): TemplateVariables {
  return {
    firstName: candidate.fullName.split(" ")[0] ?? candidate.fullName,
    role: candidate.role,
    location: candidate.location,
    company: candidate.currentEmployer,
  };
}
