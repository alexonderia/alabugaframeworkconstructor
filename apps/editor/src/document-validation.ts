import { validateDocument } from '@alabuga/framework/schema';
export const checked = (input: unknown) => {
  const r = validateDocument(input);
  if (!r.success) throw new Error(r.issues.map((i) => i.message).join('; '));
  return r.data;
};
