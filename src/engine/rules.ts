import type {
  ConditionRule,
  Community,
  DocumentRequirement,
  EducationLevel,
  GroupRule,
  NotRule,
  Rule,
} from "./types";

/**
 * Rule builders. These exist so scheme definitions in `data/` read like a
 * sentence instead of a nested object literal — the dataset is reviewed by
 * non-engineers and the readability is the point.
 */

export const all = (...rules: Rule[]): GroupRule => ({ op: "and", rules });
export const any = (...rules: Rule[]): GroupRule => ({ op: "or", rules });
export const not = (rule: Rule): NotRule => ({ op: "not", rule });

export const eq = (field: string, value: unknown, label?: string): ConditionRule => ({
  field,
  cmp: "eq",
  value,
  label,
});

export const neq = (field: string, value: unknown, label?: string): ConditionRule => ({
  field,
  cmp: "neq",
  value,
  label,
});

export const inList = (field: string, value: unknown[], label?: string): ConditionRule => ({
  field,
  cmp: "in",
  value,
  label,
});

export const notIn = (field: string, value: unknown[], label?: string): ConditionRule => ({
  field,
  cmp: "nin",
  value,
  label,
});

export const lte = (field: string, value: number, label?: string): ConditionRule => ({
  field,
  cmp: "lte",
  value,
  label,
});

export const gte = (field: string, value: number, label?: string): ConditionRule => ({
  field,
  cmp: "gte",
  value,
  label,
});

export const between = (field: string, min: number, max: number, label?: string): ConditionRule => ({
  field,
  cmp: "between",
  value: [min, max],
  label,
});

export const exists = (field: string, label?: string): ConditionRule => ({
  field,
  cmp: "exists",
  label,
});

export const isTrue = (field: string, label?: string): ConditionRule => ({
  field,
  cmp: "truthy",
  label,
});

/** True when the field is empty. Used for "only if you have not already claimed X". */
export const notSet = (field: string, label?: string): ConditionRule => ({
  field,
  cmp: "notSet",
  label,
});

/** Case-insensitive substring match, e.g. course contains "B.Sc". */
export const contains = (field: string, needle: string, label?: string): ConditionRule => ({
  field,
  cmp: "contains",
  value: [needle],
  label,
});

/** Case-insensitive "matches any of these substrings", for free-text fields. */
export const containsAny = (field: string, needles: string[], label?: string): ConditionRule => ({
  field,
  cmp: "containsAny",
  value: needles,
  label,
});

/** True only when *every* listed field is truthy. */
export const allOf = (fields: string[], label?: string): ConditionRule => ({
  field: fields.join("|"),
  cmp: "truthyList",
  value: fields,
  label,
});

export const atLevel = (levels: EducationLevel[], label?: string): ConditionRule =>
  inList("level", levels, label ?? "Education level");

export const inCommunity = (communities: Community[], label?: string): ConditionRule =>
  inList("community", communities, label ?? "Social category");

export const hasDocs = (reqs: DocumentRequirement[]): Rule =>
  any(
    ...reqs.map((r) => isTrue(`docs.${r.type}${r.mandatory ? "" : ".optional"}`, r.type)),
  );
