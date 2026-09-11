/**
 * AFXC Compiler Engine v9.0.0 - Test Suite Automatizada
 * Suite de pruebas unitarias e integración para CI/CD
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { AFXC } = require('./afxc-v9.js');

describe('AFXC v9.0.0 Compiler Engine Suite', () => {
  let compiler;
  const tmpDir = path.join(__dirname, 'tmp_test_out_v9');

  before(() => {
    compiler = new AFXC({ verbose: false, strictMode: false, rootDir: tmpDir });
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  after(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('1. Debe realizar Tokenización y Lexer con ubicación precisa de errores (Línea y Columna)', () => {
    const invalidAVF = `
schema User {
  nombre: string;
  badString: "cadena sin cerrar
}
`;
    let errorCaught = false;
    try {
      compiler.compileCode(invalidAVF, "TestLexer");
    } catch (e) {
      errorCaught = true;
      assert(e.message.includes('Línea') || e.line !== undefined, 'El mensaje de error debe reportar la línea');
      assert(e.message.includes('Columna') || e.col !== undefined, 'El mensaje de error debe reportar la columna');
    }
    assert.strictEqual(errorCaught, true, 'Debe lanzar SyntaxError al detectar token inválido');
  });

  it('2. Debe soportar declaraciones export (export schema, export component, export extension, export plugin)', () => {
    const codeWithExport = `
export schema Producto {
  nombre: string;
  precio: number;
}

export component ProductoCard {
  template(state) {
    return <div class="card">{this.props.nombre}</div>;
  }
}

export extension ProductoUtils {
  formatPrice(p) { return "$" + p; }
}

export plugin ProductoPlugin {
  General.log("Plugin activo");
}
`;
    const res = compiler.compileCode(codeWithExport, "TestExport");
    assert.strictEqual(res.success, true, 'La compilación con cláusulas export debe ser exitosa');
    assert.strictEqual(res.cmsManifest.entities.length, 1, 'Debe registrar la entidad Producto');
    assert(!res.clientJS.includes('export class'), 'No debe dejar palabras export huérfanas en el JS cliente');
    assert(!res.clientJS.includes('export schema'), 'No debe dejar bloques schema en el JS cliente');
    assert(res.clientJS.includes('class ProductoCard extends reactv.Componente'), 'Debe emitir la clase del componente correctamente');
  });

  it('3. Debe compilar proyectos multi-archivo resolviendo dependencias e importaciones con alias', () => {
    const userAvf = `
export schema User {
  nombre: string;
  email: string @validate(type: "email");
}

export component UserBadge {
  template(state) {
    return <span class="badge">{this.props.nombre}</span>;
  }
}
`;
    const mainAvf = `
import { User as UsuarioModel, UserBadge } from "./User.avf";

export schema Post {
  titulo: string;
  autor: UsuarioModel @link(relation: "many-to-one");
}

export component PostCard {
  template(state) {
    return (
      <div class="card">
        <h1>{this.props.titulo}</h1>
        <UserBadge nombre="Arturo" />
      </div>
    );
  }
}
`;

    const userPath = path.join(tmpDir, 'User.avf');
    const mainPath = path.join(tmpDir, 'Main.avf');
    fs.writeFileSync(userPath, userAvf, 'utf8');
    fs.writeFileSync(mainPath, mainAvf, 'utf8');

    const result = compiler.compileProject(mainPath);
    assert.strictEqual(result.success, true, 'La compilación multi-archivo debe ser exitosa');
    assert.strictEqual(result.cmsManifest.entities.length, 2, 'Debe fusionar ambas entidades (User y Post)');
    assert(result.clientJS.includes('class UserBadge extends reactv.Componente'), 'Debe incluir el componente UserBadge');
    assert(result.clientJS.includes('class PostCard extends reactv.Componente'), 'Debe incluir el componente PostCard');
  });

  it('4. Debe transpilar componentes personalizados JSX e inyectar props.children (Slots)', () => {
    const code = `
schema LayoutSchema { id: string; }

component CustomButton {
  template(state) {
    return <button class="btn">{this.props.children}</button>;
  }
}

component App {
  template(state) {
    return (
      <CustomButton onClick={() => console.log('ok')}>
        <span>Guardar</span>
      </CustomButton>
    );
  }
}
`;
    const res = compiler.compileCode(code, "TestJSXProps");
    assert.strictEqual(res.success, true);
    assert(res.clientJS.includes('reactv.h(CustomButton'), 'Debe referenciar la clase CustomButton directamente');
    assert(res.clientJS.includes('children:'), 'Debe inyectar la propiedad children para slots');
  });

  it('5. Debe realizar Type-Checking e informar diagnósticos', () => {
    const codeWithWarning = `
schema BadEntity {
  campo: TipoInexistente;
  rango: number @validate(min: 50, max: 10);
}
`;
    const res = compiler.compileCode(codeWithWarning, "TestTypeCheck");
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.cmsManifest.typeCheck.passed, false);
    assert(res.diagnostics.some(d => d.severity === 'error'), 'Debe detectar error cuando min > max');
    assert(res.diagnostics.some(d => d.severity === 'warning'), 'Debe detectar advertencia de tipo desconocido');
  });

  it('6. Debe generar Source Map V3 conforme a la especificación', () => {
    const code = `
schema Entity { name: string; }
`;
    const res = compiler.compileCode(code, "TestSourceMap");
    assert.strictEqual(res.sourceMap.version, 3);
    assert.strictEqual(res.sourceMap.file, "TestSourceMap.js");
    assert(Array.isArray(res.sourceMap.sources));
    assert(typeof res.sourceMap.mappings === 'string');
  });
});
