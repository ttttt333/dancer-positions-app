import type { FormationCueAction } from "../types/CueTypes";
import type { FormationTemplate } from "../types/FormationTypes";
import { createDefaultFormationTemplates } from "./FormationTemplates";

export class FormationTemplateRegistry {
  private readonly byId = new Map<string, FormationTemplate>();

  registerTemplate(template: FormationTemplate): void {
    this.byId.set(template.id, template);
  }

  getTemplate(id: string): FormationTemplate | undefined {
    return this.byId.get(id);
  }

  getTemplatesForDancerCount(count: number): FormationTemplate[] {
    return this.list().filter((t) => count >= t.minCount && count <= t.maxCount);
  }

  getTemplatesForIntent(intent: FormationCueAction): FormationTemplate[] {
    return this.list().filter((t) => t.preferredIntents.includes(intent));
  }

  list(): FormationTemplate[] {
    return [...this.byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}

export function createDefaultFormationTemplateRegistry(): FormationTemplateRegistry {
  const registry = new FormationTemplateRegistry();
  for (const template of createDefaultFormationTemplates()) {
    registry.registerTemplate(template);
  }
  return registry;
}

export const defaultFormationTemplateRegistry = createDefaultFormationTemplateRegistry();
