import ts from 'typescript';
import { posix } from 'node:path';
import { builtinModules } from 'node:module';

const nodeModules = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));

export const workspaceRoots = {
  editor: 'apps/editor',
  ai: 'packages/ai',
  'ai-server': 'apps/ai-server',
};
const workspaceNames = {
  '@alabuga/editor': 'editor',
  '@alabuga/ai': 'ai',
  '@alabuga/ai-server': 'ai-server',
};
const allowedWorkspaces = { editor: ['ai'], ai: [], 'ai-server': [] };
// These modules operate on documents or injected services, without UI or persistence.
export const documentModules = new Set([
  'apps/editor/src/model.ts',
  'apps/editor/src/editor-save.ts',
  'apps/editor/src/editor-session.ts',
  'apps/editor/src/property-patch.ts',
  'apps/editor/src/section-name.ts',
  'apps/editor/src/sections.ts',
  'apps/editor/src/document-content.ts',
  'apps/editor/src/document-validation.ts',
  'apps/editor/src/project-file/format.ts',
]);
const documentFrameworkEntries = new Set([
  '@alabuga/framework/schema',
  '@alabuga/framework/compositions',
]);
const viewModules = new Set([
  'apps/editor/src/editor-canvas.ts',
  'apps/editor/src/editor-inspector.ts',
]);
const viewOwners = new Set([
  ...viewModules,
  'apps/editor/src/main.ts',
  'apps/editor/src/editor-session.ts',
  'apps/editor/src/storage.ts',
]);
const storageRoot = 'apps/editor/src/storage/';
// Relative dependencies point down to transaction primitives and pure contracts.
const storageImports = {
  'types.ts': ['../project-file/format'],
  'db.ts': ['types'],
  'project-state.ts': [],
  'settings.ts': ['db'],
  'images.ts': [],
  'assets.ts': [
    'types',
    'db',
    'settings',
    'images',
    '../document-validation',
    '../framework-assets',
  ],
  'projects.ts': ['db', 'types', 'project-state', 'assets', '../document-validation'],
  'revisions.ts': ['db', 'types', 'assets'],
  'drafts.ts': ['db', 'types', 'settings', 'assets'],
  'legacy-import.ts': ['settings', 'assets', 'projects', '../document-validation'],
  'portable-project.ts': ['types', 'assets', 'images', '../framework-assets'],
  'maintenance.ts': ['db', 'types', 'images'],
};

export function workspaceOf(file) {
  return Object.keys(workspaceRoots).find((name) => file.startsWith(workspaceRoots[name] + '/'));
}

/** Include re-exports, type imports, literal dynamic imports and CommonJS requires. */
export function importsOf(file, text) {
  const imports = [];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  function literal(node) {
    while (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      imports.push(node.text);
    }
  }
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      literal(node.moduleSpecifier);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      literal(node.argument.literal);
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      if (node.moduleReference.expression) literal(node.moduleReference.expression);
    }
    if (ts.isCallExpression(node) && node.arguments[0]) {
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')
      ) {
        literal(node.arguments[0]);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return [...new Set(imports)];
}

export function publicEntry(specifier, packageName, exports) {
  const entry = specifier === packageName ? '.' : '.' + specifier.slice(packageName.length);
  return (
    Object.hasOwn(exports, entry) ||
    Object.keys(exports).some((key) => {
      const star = key.indexOf('*');
      return (
        star >= 0 && entry.startsWith(key.slice(0, star)) && entry.endsWith(key.slice(star + 1))
      );
    })
  );
}

export function relativeTarget(file, specifier, files) {
  const target = posix.normalize(posix.join(posix.dirname(file), specifier.split('?')[0]));
  return [
    target,
    ...['.ts', '.mjs', '.js', '/index.ts', '/index.mjs', '/index.js'].map((ext) => target + ext),
  ].find((path) => files.has(path));
}

export function dependencyErrors(file, specifier, aiExports) {
  const clean = specifier.split('?')[0];
  const source = workspaceOf(file);
  const errors = [];
  if (clean.startsWith('.')) {
    const target = posix.normalize(posix.join(posix.dirname(file), clean));
    if (target === '..' || target.startsWith('../')) errors.push('import escapes repository');
    const destination = workspaceOf(target);
    const modulePath = target.endsWith('.ts') ? target : target + '.ts';
    if (
      viewModules.has(file) &&
      (viewOwners.has(modulePath) || modulePath.startsWith(storageRoot)) &&
      file !== modulePath
    ) {
      errors.push('canvas and inspector receive owner operations through callbacks');
    }
    if (file.startsWith(storageRoot)) {
      const allowed = (storageImports[file.slice(storageRoot.length)] ?? []).map((path) =>
        posix.normalize(storageRoot + path + '.ts'),
      );
      if (!allowed.includes(modulePath)) errors.push('storage layer cannot import ' + clean);
    }
    if (source && destination !== source && !target.startsWith('config/')) {
      errors.push('cross-workspace relative import; use an allowed public package export');
    }
    if (source === 'ai' && destination !== source)
      errors.push('ai must be independent of application files');
    if (documentModules.has(file)) {
      const candidate = target.endsWith('.ts') ? target : target + '.ts';
      if (!documentModules.has(candidate))
        errors.push('document modules cannot import UI or persistence');
    }
  } else {
    if (
      file.startsWith(storageRoot) &&
      !['@alabuga/framework/schema', '@alabuga/ai/contracts'].includes(clean)
    ) {
      errors.push('storage modules can use only public schema/contracts and declared local layers');
    }
    const packageName = clean.startsWith('@')
      ? clean.split('/').slice(0, 2).join('/')
      : clean.split('/')[0];
    const destination = workspaceNames[packageName];
    if (
      source &&
      destination &&
      source !== destination &&
      !allowedWorkspaces[source].includes(destination)
    ) {
      errors.push(source + ' cannot depend on ' + destination);
    }
    if (packageName === '@alabuga/ai' && !publicEntry(clean, packageName, aiExports)) {
      errors.push('unpublished AI entry');
    }
    if (packageName === '@alabuga/editor' || packageName === '@alabuga/ai-server') {
      errors.push('application workspaces have no public exports');
    }
    if (
      (source === 'editor' || source === 'ai') &&
      (clean.startsWith('node:') || nodeModules.has(clean))
    ) {
      errors.push('browser and generation modules cannot import Node.js APIs');
    }
    if (documentModules.has(file) && !documentFrameworkEntries.has(clean)) {
      errors.push(
        'document modules can use only document modules and Framework schema/compositions',
      );
    }
    if (source === 'ai' && !['@alabuga/framework', 'zod', '@alabuga/ai'].includes(packageName)) {
      errors.push('ai can use only Framework, Zod and its own modules');
    }
  }
  return errors.map((error) => file + ': ' + error + ' (' + specifier + ')');
}

/** Report back edges with a readable cycle, including type-only and dynamic imports. */
export function findCycles(graph) {
  const visited = new Set(),
    active = new Set(),
    path = [],
    cycles = [];
  function visit(file) {
    if (active.has(file)) {
      cycles.push([...path.slice(path.indexOf(file)), file]);
      return;
    }
    if (visited.has(file)) return;
    visited.add(file);
    active.add(file);
    path.push(file);
    for (const target of graph.get(file) ?? []) visit(target);
    path.pop();
    active.delete(file);
  }
  for (const file of graph.keys()) visit(file);
  return cycles;
}
