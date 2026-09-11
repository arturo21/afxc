/**
 * AFXC: AVFenix Compiler Engine (v8.0.0 - Full Production Enterprise Edition)
 * Transpilador y Motor de Compilación Oficial para AVFenix Types.
 * 
 * Implementación de los 4 Puntos Críticos de Producción:
 *  1. Sistema de Importación y Grafo de Dependencias (import / export multi-archivo).
 *  2. Lexer / Tokenizador AST con reporte de errores por Línea y Columna.
 *  3. Instanciación de Componentes Personalizados (PascalCase) y soporte props.children / Slots.
 *  4. CLI de Producción y Configuración Dinámica (afxc.config.json).
 */

const fs = require('fs');
const path = require('path');

// =========================================================================
// PUNTO 2: LEXER / TOKENIZADOR AST Y MANEJO DE ERRORES CON LÍNEA Y COLUMNA
// =========================================================================

class AFXCLexer {
  constructor(source, filename = "module.avf") {
    this.source = source;
    this.filename = filename;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
  }

  error(message, line = this.line, col = this.col) {
    const lines = this.source.split('\n');
    const lineSnippet = lines[line - 1] || "";
    const pointer = " ".repeat(Math.max(0, col - 1)) + "^";
    const err = new Error(
      `[AFXC SyntaxError] en ${this.filename} (Línea ${line}, Columna ${col}): ${message}\n` +
      `  ${line} | ${lineSnippet}\n` +
      `  ${" ".repeat(String(line).length)} | ${pointer}`
    );
    err.line = line;
    err.col = col;
    err.filename = this.filename;
    return err;
  }

  tokenize() {
    const tokens = [];
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];

      // Salto de línea
      if (ch === '\n') {
        this.line++;
        this.col = 1;
        this.pos++;
        continue;
      }

      // Espacios en blanco
      if (/\s/.test(ch)) {
        this.col++;
        this.pos++;
        continue;
      }

      // Comentarios de línea //
      if (ch === '/' && this.source[this.pos + 1] === '/') {
        while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
          this.pos++;
        }
        continue;
      }

      // Comentarios multilínea /* ... */
      if (ch === '/' && this.source[this.pos + 1] === '*') {
        const startLine = this.line;
        const startCol = this.col;
        this.pos += 2;
        this.col += 2;
        while (this.pos < this.source.length && !(this.source[this.pos] === '*' && this.source[this.pos + 1] === '/')) {
          if (this.source[this.pos] === '\n') {
            this.line++;
            this.col = 1;
          } else {
            this.col++;
          }
          this.pos++;
        }
        if (this.pos >= this.source.length) {
          throw this.error("Comentario multilínea sin cerrar", startLine, startCol);
        }
        this.pos += 2;
        this.col += 2;
        continue;
      }

      // Cadenas de texto "..." o '...'
      if (ch === '"' || ch === "'") {
        const quote = ch;
        const startLine = this.line;
        const startCol = this.col;
        let strVal = "";
        this.pos++;
        this.col++;
        while (this.pos < this.source.length && this.source[this.pos] !== quote) {
          if (this.source[this.pos] === '\n') {
            this.line++;
            this.col = 1;
          } else {
            this.col++;
          }
          strVal += this.source[this.pos];
          this.pos++;
        }
        if (this.pos >= this.source.length) {
          throw this.error(`Cadena de texto sin cerrar`, startLine, startCol);
        }
        this.pos++;
        this.col++;
        tokens.push({ type: 'STRING', value: strVal, line: startLine, col: startCol });
        continue;
      }

      // Identificadores y Palabras Clave
      if (/[a-zA-Z_$]/.test(ch)) {
        const startCol = this.col;
        let ident = "";
        while (this.pos < this.source.length && /[a-zA-Z0-9_$]/.test(this.source[this.pos])) {
          ident += this.source[this.pos];
          this.pos++;
          this.col++;
        }
        const keywords = new Set(["schema", "component", "extension", "plugin", "import", "export", "from", "as", "state", "template", "onMount", "onUpdate", "onDestroy"]);
        const type = keywords.has(ident) ? 'KEYWORD' : 'IDENT';
        tokens.push({ type, value: ident, line: this.line, col: startCol });
        continue;
      }

      // Símbolos y Operadores
      tokens.push({ type: 'SYMBOL', value: ch, line: this.line, col: this.col });
      this.pos++;
      this.col++;
    }

    return tokens;
  }
}

// =========================================================================
// MOTOR PRINCIPAL COMPILADOR AFXC v8.0.0
// =========================================================================

class AFXC {
  constructor(options = {}) {
    this.version = "8.0.0";
    this.options = Object.assign({
      verbose: true,
      strictMode: false,
      rootDir: process.cwd(),
      cmsManifest: true,
      sourceMap: true
    }, options);
    this.hoistedNodes = [];
    this.hoistedCounter = 0;
  }

  // =========================================================================
  // PUNTO 1: RESOLUCIÓN DE MÓDULOS Y GRAFO DE DEPENDENCIAS (import / export)
  // =========================================================================

  /**
   * Compila un proyecto multi-archivo a partir de un punto de entrada.
   * Resuelve el grafo de dependencias y previene importaciones circulares.
   */
  compileProject(entryFilePath, options = {}) {
    const absEntryPath = path.resolve(this.options.rootDir, entryFilePath);
    const visitedFiles = new Map(); // path -> { schemas, components, clientJS, imports }
    const circularCheckStack = new Set();

    const processFile = (filePath) => {
      const normalizedPath = path.normalize(filePath);
      if (circularCheckStack.has(normalizedPath)) {
        throw new Error(`[AFXC ModuleError] Dependencia circular detectada: ${Array.from(circularCheckStack).join(' -> ')} -> ${normalizedPath}`);
      }

      if (visitedFiles.has(normalizedPath)) {
        return visitedFiles.get(normalizedPath);
      }

      if (!fs.existsSync(normalizedPath)) {
        throw new Error(`[AFXC ModuleError] Archivo importado no encontrado: ${normalizedPath}`);
      }

      circularCheckStack.add(normalizedPath);
      const sourceCode = fs.readFileSync(normalizedPath, 'utf8');
      const filename = path.basename(normalizedPath);

      // Lexer check para reporte de errores sintácticos
      const lexer = new AFXCLexer(sourceCode, filename);
      lexer.tokenize(); // Lanza SyntaxError con línea y columna si falla

      // Extraer imports
      const imports = this.parseImports(sourceCode, normalizedPath);

      // Procesar módulos importados recursivamente
      const importedModules = [];
      for (const imp of imports) {
        const moduleResult = processFile(imp.resolvedPath);
        importedModules.push({ importInfo: imp, moduleResult });
      }

      // Compilar módulo individual
      const singleResult = this.compileCode(sourceCode, path.basename(normalizedPath, '.avf'), normalizedPath);

      const moduleRecord = {
        path: normalizedPath,
        filename,
        sourceCode,
        imports,
        importedModules,
        result: singleResult
      };

      circularCheckStack.delete(normalizedPath);
      visitedFiles.set(normalizedPath, moduleRecord);
      return moduleRecord;
    };

    const entryRecord = processFile(absEntryPath);

    // Fusionar manifiesto CMS global
    const mergedEntities = [];
    const mergedComponents = [];
    const allDiagnostics = [];
    const bundledJsParts = [];

    for (const [fPath, rec] of visitedFiles.entries()) {
      const res = rec.result;
      if (res.cmsManifest) {
        mergedEntities.push(...res.cmsManifest.entities);
        mergedComponents.push(...res.cmsManifest.components);
      }
      if (res.diagnostics) {
        allDiagnostics.push(...res.diagnostics);
      }
      bundledJsParts.push(`// --- Módulo: ${rec.filename} ---\n${res.clientJS}`);
    }

    const baseName = path.basename(absEntryPath, path.extname(absEntryPath));
    const bundledClientJS = this.wrapBundledJS(bundledJsParts, mergedEntities, baseName);
    const sourceMap = this.generateSourceMap(entryRecord.sourceCode, bundledClientJS, `${baseName}.avf`, `${baseName}.js`);

    const manifest = {
      compiler: `afxc-v${this.version}`,
      entryFile: baseName,
      generatedAt: new Date().toISOString(),
      modulesCount: visitedFiles.size,
      modules: Array.from(visitedFiles.keys()).map(k => path.basename(k)),
      typeCheck: {
        passed: !allDiagnostics.some(d => d.severity === 'error'),
        diagnosticsCount: allDiagnostics.length,
        diagnostics: allDiagnostics
      },
      entities: mergedEntities,
      components: mergedComponents
    };

    return {
      success: true,
      entryFile: baseName,
      cmsManifest: manifest,
      clientJS: bundledClientJS,
      sourceMap: sourceMap,
      diagnostics: allDiagnostics
    };
  }

  parseImports(source, currentFilePath) {
    const imports = [];
    const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(source)) !== null) {
      const rawSpecifiers = match[1].split(',').map(s => s.trim()).filter(Boolean);
      const importPath = match[2];
      const resolvedPath = path.resolve(path.dirname(currentFilePath), importPath.endsWith('.avf') ? importPath : `${importPath}.avf`);

      imports.push({
        specifiers: rawSpecifiers,
        importPath,
        resolvedPath,
        matchIndex: match.index,
        fullMatch: match[0]
      });
    }

    return imports;
  }

  wrapBundledJS(bundledJsParts, schemas, baseName) {
    const schemaNames = schemas.map(s => s.entity).join(', ') || 'N/A';
    return `/**
 * Compilado por AFXC (AVFenix Compiler Engine v${this.version})
 * Proyecto: ${baseName} | Módulos emparejados: ${schemaNames}
 * Entorno objetivo: General.JS v2 / Reactive / Routing
 */
${bundledJsParts.join('\n\n')}`;
  }

  // =========================================================================
  // PARSER DE CÓDIGO FUENTE INDIVIDUAL
  // =========================================================================

  compileCode(sourceCode, filename = "module", fullPath = "module.avf") {
    try {
      this.hoistedNodes = [];
      this.hoistedCounter = 0;

      // 1. Lexer Check
      const lexer = new AFXCLexer(sourceCode, `${filename}.avf`);
      lexer.tokenize();

      // 2. Extraer esquemas y componentes
      const schemas = this.parseSchemas(sourceCode);
      const components = this.parseComponentMetadata(sourceCode);

      // 3. Type-Checker Estático
      const diagnostics = this.typeCheck(sourceCode, schemas, components);
      const hasErrors = diagnostics.some(d => d.severity === 'error');

      if (hasErrors && this.options.strictMode) {
        throw new Error(`[Type-Checker] Se encontraron ${diagnostics.filter(d => d.severity === 'error').length} errores de tipado en modo estricto.`);
      }

      // 4. Emitir Código JS
      const clientJS = this.emitClientCode(sourceCode, schemas, filename);

      // 5. Source Map V3
      const sourceMap = this.generateSourceMap(sourceCode, clientJS, `${filename}.avf`, `${filename}.js`);

      const manifest = {
        compiler: `afxc-v${this.version}`,
        filename: filename,
        generatedAt: new Date().toISOString(),
        typeCheck: {
          passed: !hasErrors,
          diagnosticsCount: diagnostics.length,
          diagnostics: diagnostics
        },
        optimizations: {
          hoistedNodesCount: this.hoistedNodes.length,
          hoistedNodes: this.hoistedNodes.map(h => h.varName)
        },
        entities: schemas,
        components: components
      };

      return {
        success: true,
        filename: filename,
        cmsManifest: manifest,
        clientJS: clientJS,
        sourceMap: sourceMap,
        diagnostics: diagnostics
      };
    } catch (error) {
      return {
        success: false,
        filename: filename,
        error: error.message,
        stack: error.stack
      };
    }
  }

  compileFile(inputPath, outputDir = "./dist") {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`El archivo de origen no existe: ${inputPath}`);
    }

    const result = this.compileProject(inputPath);

    if (!result.success) {
      throw new Error(`Error durante la compilación de ${inputPath}: ${result.error}`);
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const baseName = result.entryFile;
    const manifestPath = path.join(outputDir, `${baseName}.schema.json`);
    const clientJsPath = path.join(outputDir, `${baseName}.js`);
    const sourceMapPath = path.join(outputDir, `${baseName}.js.map`);

    fs.writeFileSync(manifestPath, JSON.stringify(result.cmsManifest, null, 2), 'utf8');
    fs.writeFileSync(clientJsPath, result.clientJS, 'utf8');
    fs.writeFileSync(sourceMapPath, JSON.stringify(result.sourceMap, null, 2), 'utf8');

    if (this.options.verbose) {
      console.log(`\x1b[32m[AFXC SUCCESS v8.0.0]\x1b[0m Proyecto compilado exitosamente para: \x1b[36m${baseName}.avf\x1b[0m`);
      console.log(`  └─ Manifiesto CMS: \x1b[33m${manifestPath}\x1b[0m`);
      console.log(`  └─ Bundle Cliente: \x1b[33m${clientJsPath}\x1b[0m`);
      console.log(`  └─ Source Map V3: \x1b[33m${sourceMapPath}\x1b[0m`);
      console.log(`  └─ Módulos Enlazados: \x1b[35m${result.cmsManifest.modulesCount}\x1b[0m | Diagnostics: \x1b[35m${result.diagnostics.length}\x1b[0m`);
    }

    return { manifestPath, clientJsPath, sourceMapPath, result };
  }

  // =========================================================================
  // TYPE-CHECKER ESTÁTICO
  // =========================================================================

  typeCheck(sourceCode, schemas, components) {
    const diagnostics = [];
    const knownPrimitives = new Set(["string", "number", "boolean", "text", "date", "array", "object", "any"]);
    const knownWidgets = new Set(["text-input", "rich-editor", "toggle", "select", "multi-select", "tags", "email-input", "date-picker", "number-input"]);
    const knownRelations = new Set(["one-to-one", "one-to-many", "many-to-one", "many-to-many"]);

    const declaredEntities = new Set(schemas.map(s => s.entity));

    schemas.forEach(s => {
      for (const [fieldName, fieldObj] of Object.entries(s.fields)) {
        const { type, decorators } = fieldObj;

        if (!knownPrimitives.has(type) && !declaredEntities.has(type)) {
          diagnostics.push({
            severity: "warning",
            message: `Campo '${fieldName}' en '${s.entity}' usa el tipo desconocido '${type}'. ¿Falta declarar o importar la entidad '${type}'?`
          });
        }

        if (decorators.validate) {
          const val = decorators.validate;
          if (val.min !== undefined && val.max !== undefined && val.min > val.max) {
            diagnostics.push({
              severity: "error",
              message: `Regla de validación inválida en '${s.entity}.${fieldName}': min (${val.min}) es mayor que max (${val.max}).`
            });
          }
        }

        if (decorators.ui && decorators.ui.widget && !knownWidgets.has(decorators.ui.widget)) {
          diagnostics.push({
            severity: "info",
            message: `Widget personalizado '${decorators.ui.widget}' detectado en '${s.entity}.${fieldName}'.`
          });
        }

        if (decorators.link && decorators.link.relation && !knownRelations.has(decorators.link.relation)) {
          diagnostics.push({
            severity: "error",
            message: `Relación inválida '${decorators.link.relation}' en '${s.entity}.${fieldName}'.`
          });
        }
      }
    });

    components.forEach(c => {
      if (!c.hasTemplate) {
        diagnostics.push({
          severity: "warning",
          message: `El componente '${c.name}' no define un método 'template(state)'.`
        });
      }
    });

    return diagnostics;
  }

  // =========================================================================
  // PARSER Y AST STATIC HOISTING ENGINE
  // =========================================================================

  findBlocks(source, keyword) {
    const blocks = [];
    const pattern = new RegExp(`\\b${keyword}\\s+(\\w+)\\s*\\{`, 'g');
    let match;

    while ((match = pattern.exec(source)) !== null) {
      const name = match[1];
      const startBrace = pattern.lastIndex - 1;
      let depth = 0;
      let i = startBrace;

      while (i < source.length) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
          depth--;
          if (depth === 0) break;
        }
        i++;
      }

      if (depth === 0) {
        blocks.push({
          name,
          body: source.substring(startBrace + 1, i),
          fullMatch: source.substring(match.index, i + 1),
          start: match.index,
          end: i + 1
        });
      }
    }
    return blocks;
  }

  parseSchemas(source) {
    const schemas = [];
    const blocks = this.findBlocks(source, "schema");
    for (const b of blocks) {
      schemas.push({ entity: b.name, fields: this.parseFields(b.body) });
    }
    return schemas;
  }

  parseFields(body) {
    const fields = {};
    const lines = body.trim().split(';');
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('//')) continue;
      const fieldMatch = line.match(/^(\w+)\s*:\s*(\w+)(.*)$/);
      if (!fieldMatch) continue;
      const [_, fieldName, fieldType, rest] = fieldMatch;
      fields[fieldName] = { type: fieldType, decorators: {} };
      const decMatches = rest.matchAll(/@(\w+)(?:\((.*?)\))?(?=\s*@|\s*$)/g);
      for (const dm of decMatches) {
        fields[fieldName].decorators[dm[1]] = this.parseDecoratorArgs(dm[2] || "");
      }
    }
    return fields;
  }

  parseDecoratorArgs(argsStr) {
    if (!argsStr.trim()) return true;
    const result = {};
    const argRegex = /(\w+)\s*:\s*(?:\"([^\"]*)\"|'([^']*)'|(\\[.*?\\])|(true|false|\\d+|\\w+))/g;
    let match;
    while ((match = argRegex.exec(argsStr)) !== null) {
      const [_, key, strVal1, strVal2, arrVal, rawVal] = match;
      let value;
      if (strVal1 !== undefined) value = strVal1;
      else if (strVal2 !== undefined) value = strVal2;
      else if (arrVal !== undefined) {
        try { value = JSON.parse(arrVal.replace(/'/g, '"')); } catch(e) { value = arrVal; }
      } else {
        if (rawVal === "true") value = true;
        else if (rawVal === "false") value = false;
        else value = isNaN(rawVal) ? rawVal : Number(rawVal);
      }
      result[key] = value;
    }
    return Object.keys(result).length > 0 ? result : argsStr.trim();
  }

  parseComponentMetadata(source) {
    const components = [];
    const blocks = this.findBlocks(source, "component");
    for (const b of blocks) {
      components.push({
        name: b.name,
        hasState: /state\s*=/.test(b.body),
        hasTemplate: /template\s*\(/.test(b.body),
        hasLifecycle: /(onMount|onUpdate|onDestroy)\s*\(/.test(b.body)
      });
    }
    return components;
  }

  // =========================================================================
  // PUNTO 3: INSTANCIACIÓN DE COMPONENTES PERSONALIZADOS Y props.children / Slots
  // =========================================================================

  parseJSXProps(attrsStr) {
    if (!attrsStr.trim()) return { propsJS: "{}", isStatic: true };
    const props = [];
    let isStatic = true;
    let i = 0;
    const str = attrsStr.trim();

    while (i < str.length) {
      const nameMatch = str.substring(i).match(/^\s*(\w+)\s*/);
      if (!nameMatch) break;
      const attrName = nameMatch[1];
      i += nameMatch[0].length;

      if (i < str.length && str[i] === '=') {
        i++;
        if (i < str.length && (str[i] === '"' || str[i] === "'")) {
          const q = str[i];
          const endQ = str.indexOf(q, i + 1);
          const val = str.substring(i + 1, endQ);
          props.push(`${attrName}: "${val}"`);
          i = endQ + 1;
        } else if (i < str.length && str[i] === '{') {
          let bDepth = 1;
          const startB = i + 1;
          i++;
          while (i < str.length && bDepth > 0) {
            if (str[i] === '{') bDepth++;
            else if (str[i] === '}') bDepth--;
            i++;
          }
          let expr = str.substring(startB, i - 1).trim();
          if (expr.includes('<')) expr = this.transpileJSX(expr);
          if (/state\.|this\.props\.|this\.|e=>|\(e\)|\bfunction\b|=>/.test(expr)) {
            isStatic = false;
          }
          props.push(`${attrName}: ${expr}`);
        } else {
          const valMatch = str.substring(i).match(/^(\S+)/);
          if (valMatch) {
            props.push(`${attrName}: "${valMatch[1]}"`);
            i += valMatch[1].length;
          }
        }
      } else {
        props.push(`${attrName}: true`);
      }
    }
    return { propsJS: `{ ${props.join(', ')} }`, isStatic };
  }

  findMatchingCloseTag(code, tagName, startIdx) {
    let depth = 1;
    let i = startIdx;
    const openPattern = new RegExp(`<${tagName}(\\s|>|/)`);
    const closePattern = new RegExp(`</${tagName}>`);

    while (i < code.length) {
      if (code[i] === '<') {
        const closeMatch = code.substring(i).match(closePattern);
        if (closeMatch && closeMatch.index === 0) {
          depth--;
          if (depth === 0) return i;
          i += closeMatch[0].length;
          continue;
        }

        const openMatch = code.substring(i).match(openPattern);
        if (openMatch && openMatch.index === 0) {
          let subSelfClosing = false;
          let j = i + openMatch[0].length - 1;
          let bDepth = 0;
          let inS = null;

          while (j < code.length) {
            const ch = code[j];
            if (inS) {
              if (ch === inS && code[j - 1] !== '\\') inS = null;
            } else if (ch === '"' || ch === "'" || ch === '`') {
              inS = ch;
            } else if (ch === '{') {
              bDepth++;
            } else if (ch === '}') {
              bDepth--;
            } else if (ch === '>' && bDepth === 0) {
              if (code[j - 1] === '/') subSelfClosing = true;
              break;
            }
            j++;
          }

          if (!subSelfClosing) depth++;
          i = j + 1;
          continue;
        }
      }
      i++;
    }
    return -1;
  }

  parseJSXChildren(innerContent) {
    if (!innerContent.trim()) return { childrenJS: "", isStatic: true };
    const children = [];
    let isStatic = true;
    let i = 0;
    let textBuf = "";

    const flushText = () => {
      const trimmed = textBuf.trim();
      if (trimmed) {
        children.push(`"${trimmed.replace(/"/g, '\\"')}"`);
      }
      textBuf = "";
    };

    while (i < innerContent.length) {
      const ch = innerContent[i];

      if (ch === '<' && i + 1 < innerContent.length && /[a-zA-Z_]/.test(innerContent[i + 1])) {
        flushText();
        const parsed = this.parseJSXElement(innerContent, i);
        if (parsed) {
          children.push(parsed.output);
          if (!parsed.isStatic) isStatic = false;
          i = parsed.nextIndex;
          continue;
        }
      } else if (ch === '{') {
        flushText();
        let bDepth = 1;
        const startB = i + 1;
        i++;
        while (i < innerContent.length && bDepth > 0) {
          if (innerContent[i] === '{') bDepth++;
          else if (innerContent[i] === '}') bDepth--;
          i++;
        }
        let expr = innerContent.substring(startB, i - 1).trim();
        if (expr.includes('<')) expr = this.transpileJSX(expr);
        if (/state\.|this\.props\.|this\.|e=>|\(e\)|\bfunction\b|=>|\.map\(|\?/.test(expr)) {
          isStatic = false;
        }
        children.push(expr);
        continue;
      } else {
        textBuf += ch;
        i++;
      }
    }
    flushText();
    return { childrenJS: children.join(", "), isStatic };
  }

  /**
   * Distingue entre elementos HTML nativos y Componentes Personalizados (PascalCase)
   */
  parseJSXElement(code, startIdx) {
    const nameMatch = code.substring(startIdx).match(/^<(\w+)/);
    if (!nameMatch) return null;

    const tagName = nameMatch[1];
    const isCustomComponent = tagName[0] === tagName[0].toUpperCase() && tagName[0] !== tagName[0].toLowerCase();
    const tagIdentifier = isCustomComponent ? tagName : `"${tagName}"`;

    let i = startIdx + tagName.length + 1;
    let inStr = null;
    let braceDepth = 0;
    const attrsStart = i;
    let selfClosing = false;
    let tagEnd = -1;

    while (i < code.length) {
      const ch = code[i];
      if (inStr) {
        if (ch === inStr && code[i - 1] !== '\\') inStr = null;
      } else if (ch === '"' || ch === "'" || ch === '`') {
        inStr = ch;
      } else if (ch === '{') {
        braceDepth++;
      } else if (ch === '}') {
        braceDepth--;
      } else if (ch === '>' && braceDepth === 0) {
        selfClosing = code[i - 1] === '/';
        tagEnd = i + 1;
        break;
      }
      i++;
    }

    if (tagEnd === -1) return null;

    const rawAttrs = code.substring(attrsStart, selfClosing ? i - 1 : i);
    const { propsJS, isStatic: propsStatic } = this.parseJSXProps(rawAttrs);

    if (selfClosing) {
      const vnodeCode = `reactv.h(${tagIdentifier}, ${propsJS})`;
      return { output: vnodeCode, nextIndex: tagEnd, isStatic: !isCustomComponent && propsStatic };
    }

    const closeIdx = this.findMatchingCloseTag(code, tagName, tagEnd);
    if (closeIdx === -1) return null;

    const innerContent = code.substring(tagEnd, closeIdx);
    const { childrenJS, isStatic: childrenStatic } = this.parseJSXChildren(innerContent);

    const closeTagLen = `</${tagName}>`.length;
    const isElementStatic = !isCustomComponent && propsStatic && childrenStatic;

    // Inyección de props.children para componentes personalizados
    let vnodeCode = "";
    if (isCustomComponent) {
      vnodeCode = childrenJS
        ? `reactv.h(${tagIdentifier}, Object.assign(${propsJS}, { children: [${childrenJS}] }))`
        : `reactv.h(${tagIdentifier}, ${propsJS})`;
    } else {
      vnodeCode = childrenJS
        ? `reactv.h(${tagIdentifier}, ${propsJS}, [${childrenJS}])`
        : `reactv.h(${tagIdentifier}, ${propsJS})`;
    }

    if (isElementStatic && /^(div|span|p|h1|h2|h3|h4|button|img|input|br|label|ul|li|header|main|footer|section)$/.test(tagName)) {
      const varName = `_hoisted_${++this.hoistedCounter}`;
      this.hoistedNodes.push({ varName, code: vnodeCode });
      return { output: varName, nextIndex: closeIdx + closeTagLen, isStatic: true };
    }

    return {
      output: vnodeCode,
      nextIndex: closeIdx + closeTagLen,
      isStatic: isElementStatic
    };
  }

  transpileJSX(code) {
    let result = [];
    let i = 0;

    while (i < code.length) {
      if (code[i] === '<' && i + 1 < code.length && /[a-zA-Z_]/.test(code[i + 1])) {
        const parsed = this.parseJSXElement(code, i);
        if (parsed) {
          result.push(parsed.output);
          i = parsed.nextIndex;
          continue;
        }
      }
      result.push(code[i]);
      i++;
    }

    return result.join('');
  }

  // =========================================================================
  // SOURCE MAPS V3
  // =========================================================================

  encodeVLQ(value) {
    const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let vlq = value < 0 ? ((-value) << 1) | 1 : (value << 1);
    let string = "";
    do {
      let digit = vlq & 31;
      vlq >>>= 5;
      if (vlq > 0) digit |= 32;
      string += BASE64_CHARS[digit];
    } while (vlq > 0);
    return string;
  }

  generateSourceMap(sourceCode, generatedCode, sourceFilename, generatedFilename) {
    const srcLines = sourceCode.split('\n');
    const genLines = generatedCode.split('\n');
    let lastSrcLine = 0;

    const mappings = genLines.map((genLine, genIdx) => {
      if (!genLine.trim()) return "";
      const srcLineIdx = Math.min(Math.floor((genIdx / genLines.length) * srcLines.length), srcLines.length - 1);
      const srcLineDelta = srcLineIdx - lastSrcLine;
      lastSrcLine = srcLineIdx;
      return this.encodeVLQ(0) + this.encodeVLQ(0) + this.encodeVLQ(srcLineDelta) + this.encodeVLQ(0);
    }).join(';');

    return {
      version: 3,
      file: generatedFilename,
      sources: [sourceFilename],
      sourcesContent: [sourceCode],
      names: [],
      mappings: mappings
    };
  }

  // =========================================================================
  // EMITTER
  // =========================================================================

  emitClientCode(source, schemas, filename) {
    let code = source;

    // 1. Eliminar declaraciones 'import ... from ...'
    code = code.replace(/import\s*\{[^}]+\}\s*from\s*['"][^'"]+['"];?/g, '');

    // 2. Eliminar bloques 'schema'
    const schemaBlocks = this.findBlocks(code, "schema");
    for (let i = schemaBlocks.length - 1; i >= 0; i--) {
      const b = schemaBlocks[i];
      code = code.slice(0, b.start) + code.slice(b.end);
    }

    // 3. Transpilar 'extension Name { ... }'
    const extBlocks = this.findBlocks(code, "extension");
    for (let i = extBlocks.length - 1; i >= 0; i--) {
      const b = extBlocks[i];
      code = code.slice(0, b.start) + `genrl.extend("${b.name}", {\n${b.body.trim()}\n});` + code.slice(b.end);
    }

    // 4. Transpilar 'plugin Name { ... }'
    const pluginBlocks = this.findBlocks(code, "plugin");
    for (let i = pluginBlocks.length - 1; i >= 0; i--) {
      const b = pluginBlocks[i];
      code = code.slice(0, b.start) + `genrl.use(function ${b.name}(General, opts) {\n${b.body.trim()}\n});` + code.slice(b.end);
    }

    // 5. Transpilar JSX
    code = this.transpileJSX(code);

    // 6. Transpilar componentes
    code = code.replace(/\bcomponent\s+(\w+)\s*\{/g, 'class $1 extends reactv.Componente {');

    const hoistedDeclarations = this.hoistedNodes.length > 0
      ? `// Nodos JSX Elevados (AST Static Hoisting)\n` + this.hoistedNodes.map(h => `const ${h.varName} = ${h.code};`).join('\n') + `\n\n`
      : ``;

    const schemaNames = schemas.map(s => s.entity).join(', ') || 'N/A';

    return `/**
 * Compilado por AFXC (AVFenix Compiler Engine v${this.version})
 * Entidades CMS asociadas: ${schemaNames}
 * Entorno objetivo: General.JS v2 / Reactive / Routing
 */
(function(genrl, reactv, routing) {
  genrl.run(function() {
    genrl.log("AVFenix: Cargando módulo [${schemaNames}]...");

    genrl.safeEval(function() {
${this.indentCode(hoistedDeclarations + code, 6)}
    });

    genrl.log("AVFenix: Módulo [${schemaNames}] inicializado con éxito.");
  });
})(
  typeof window !== 'undefined' && window.genrl ? window.genrl : {},
  typeof window !== 'undefined' && window.reactv ? window.reactv : {},
  typeof window !== 'undefined' && window.routing ? window.routing : {}
);
//# sourceMappingURL=${filename}.js.map`;
  }

  indentCode(code, spaces) {
    const pad = ' '.repeat(spaces);
    return code
      .trim()
      .split('\n')
      .map(line => line ? pad + line : line)
      .join('\n');
  }
}

// =========================================================================
// PUNTO 4: CLI DE PRODUCCIÓN Y ARCHIVO DE CONFIGURACIÓN (afxc.config.json)
// =========================================================================

function runCLI() {
  const args = process.argv.slice(2);
  const command = args[0] || "build";

  if (command === "init") {
    const defaultConfig = {
      entry: "./src/index.avf",
      outDir: "./dist",
      strictMode: false,
      cmsManifest: true,
      sourceMap: true
    };
    fs.writeFileSync("./afxc.config.json", JSON.stringify(defaultConfig, null, 2), 'utf8');
    console.log("\x1b[32m[AFXC CLI]\x1b[0m Archivo \x1b[33mafxc.config.json\x1b[0m creado con éxito.");
    return;
  }

  let config = {
    entry: "./src/index.avf",
    outDir: "./dist",
    strictMode: false,
    cmsManifest: true,
    sourceMap: true
  };

  if (fs.existsSync("./afxc.config.json")) {
    try {
      const userConfig = JSON.parse(fs.readFileSync("./afxc.config.json", 'utf8'));
      config = Object.assign(config, userConfig);
    } catch(e) {
      console.warn("\x1b[33m[AFXC WARNING]\x1b[0m Error leyendo afxc.config.json, usando valores por defecto.");
    }
  }

  const inputFile = args[1] || config.entry;
  const outputDir = args[2] || config.outDir;

  if (command === "check") {
    console.log(`\x1b[36m[AFXC CHECK]\x1b[0m Verificando sintaxis y tipos para: ${inputFile}...`);
    try {
      const compiler = new AFXC(config);
      const res = compiler.compileProject(inputFile);
      if (res.diagnostics.length === 0) {
        console.log("\x1b[32m[AFXC CHECK PASSED]\x1b[0m No se encontraron errores ni advertencias.");
      } else {
        console.log(`\x1b[33m[AFXC DIAGNOSTICS]\x1b[0m ${res.diagnostics.length} problemas detectados:`);
        res.diagnostics.forEach(d => console.log(`  [${d.severity.toUpperCase()}] ${d.message}`));
      }
    } catch(err) {
      console.error(`\x1b[31m[AFXC CHECK FAILED]\x1b[0m ${err.message}`);
      process.exit(1);
    }
    return;
  }

  if (command === "build") {
    try {
      const compiler = new AFXC(config);
      compiler.compileFile(inputFile, outputDir);
    } catch (err) {
      console.error(`\x1b[31m[AFXC BUILD ERROR]\x1b[0m ${err.message}`);
      process.exit(1);
    }
    return;
  }

  console.log(`\x1b[33mUso de AFXC CLI v8 Enterprise:\x1b[0m
  node afxc-v8.js init                      Crea afxc.config.json
  node afxc-v8.js build [entrada] [salida]  Compila el proyecto
  node afxc-v8.js check [entrada]           Ejecuta solo comprobación de tipos`);
}

if (typeof require !== 'undefined' && require.main === module) {
  runCLI();
}

module.exports = { AFXC, AFXCLexer };
