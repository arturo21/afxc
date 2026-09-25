# 🦅 AVFenix Types & AFXC Compiler Engine (`v10.0.0`)

**AFXC (AVFenix Compiler Engine v10.0.0 Enterprise Edition)** es el motor de transpilación oficial para **AVFenix Types**, diseñado específicamente para el ecosistema full-stack de **General.JS** (`gnrl.js`, `reactive.general.js` y `routing.general.js`).

A diferencia de los transpiladores tradicionales que eliminan los tipos (*Type Erasure*), **AFXC** implementa **Persistencia de Esquema Dual**: compila un único archivo `.avf` generando simultáneamente un **Manifiesto de Entidades JSON** (`.schema.json`) para la API backend/CMS y un **Bundle JavaScript de Cliente** (`.js`) optimizado para el navegador.

---

## 🌟 Características Principales

* 🔗 **Grafo de Dependencias Multi-Archivo (`import / export`):** Resuelve recursivamente proyectos estructurados en múltiples archivos `.avf`, previniendo importaciones circulares y fusionando los esquemas en un manifiesto único.
* 🎯 **Lexer AST con Diagnóstico Preciso:** Tokenizador sintáctico que intercepta errores e informa la **línea y columna exacta** del fallo con punteros visuales.
* 🧩 **Soporte JSX Nativo & Slots (`props.children`):** Instanciación automática de componentes personalizados (PascalCase) e inyección de elementos hijos dinámicos para el Virtual DOM.
* ⚡ **AST Static Hoisting:** Identifica nodos JSX estáticos y los eleva fuera del ciclo de renderizado (`template`), acelerando las comparaciones `diff()` y `patch()` de `reactive.general.js`.
* 🛡️ **Type-Checker Estático Semántico:** Verifica la validez de entidades, relaciones `@link`, reglas de rango `@validate` y widgets `@ui` en tiempo de compilación.
* 🎨 **Generación de Formularios Dinámicos UI:** Lectura de decoradores `@ui` para instanciar automáticamente controles de formulario (`text-input`, `select`, `toggle`, `rich-editor`) sin escribir HTML redundante.
* 🗄️ **Integración Backend & MariaDB / Alembic:** Generación automática de modelos ORM para SQLAlchemy, sincronización de bases de datos MariaDB y control de versiones de esquemas con Alembic (`upgrade` / `downgrade`).
* 🗺️ **Source Maps V3 (Base64 VLQ):** Mapeo de código para depuración directa sobre las líneas del archivo `.avf` en las DevTools del navegador.
* ⚙️ **CLI de Producción & Configuration File:** Soporte para `afxc.config.json` y comandos de consola (`init`, `check`, `build`).

---

## 📦 Arquitectura de Salida Dual

Cuando **AFXC** procesa un módulo `.avf`, genera tres artefactos en la carpeta de distribución (`/dist`):

```text
proyecto/
├── src/
│   ├── User.avf
│   └── Article.avf
├── dist/
│   ├── Article.schema.json   <-- Manifiesto Tipado para el CMS y Backend API
│   ├── Article.js            <-- Bundle Cliente enlazado a General.JS
│   └── Article.js.map        <-- Source Map V3 (Depuración)
└── afxc.config.json
```

1. **`[Modulo].schema.json`**: Contiene la definición de datos, tipos, decoradores `@ui` y `@validate`, relaciones relacionales e informe de diagnósticos del Type-Checker.
2. **`[Modulo].js`**: Código ejecutable envuelto en el patrón **Module Revealed**, protegido dentro de `genrl.run()` y `genrl.safeEval()` para evitar fallos globales en producción.
3. **`[Modulo].js.map`**: Mapeo estandarizado Base64 VLQ para inspección de código.

---

## 🚀 Guía de Inicio Rápido

### 1. Instalación y Requisitos
Asegúrate de contar con **Node.js** (v18.0.0 o superior) y las librerías base del ecosistema en el cliente (`gnrl.js`, `reactive.general.js`, `routing.general.js`).

```bash
# Instalación de dependencias del proyecto
npm install
```

### 2. Crear Archivo de Configuración
Inicializa el archivo de configuración en la raíz de tu proyecto:

```bash
npx afxc init
# O ejecutas directamente: node afxc.js init
```

Esto generará un archivo `afxc.config.json`:

```json
{
  "entry": "./src/Main.avf",
  "outDir": "./dist",
  "strictMode": false,
  "cmsManifest": true,
  "sourceMap": true
}
```

### 3. Verificación de Tipos (Sin Emitir Archivos)
Ejecuta el Type-Checker estático para analizar el proyecto:

```bash
npm run check
```

### 4. Compilación de Producción
Genera el bundle cliente, el manifiesto CMS y los Source Maps:

```bash
npm run build
```

---

## 🎨 Formularios Dinámicos Guiados por Metadatos `@ui`

Una de las capacidades más potentes de **AVFenix Types** es la generación automática de interfaces de usuario a partir del manifiesto de esquema `.schema.json`. Al definir un `schema` con decoradores `@ui`, no es necesario escribir código HTML repetitivo para formularios de creación o edición.

### 1. Definición del Esquema `.avf`
```typescript
schema Producto {
  nombre: string @ui(widget: "text-input", label: "Nombre del Producto", required: true, placeholder: "Ej. Laptop Pro 15");
  precio: number @validate(min: 0, max: 100000) @ui(widget: "number-input", label: "Precio ($USD)");
  categoria: string @ui(widget: "select", label: "Categoría", options: ["Electrónica", "Hogar", "Ropa"]);
  descripcion: text @ui(widget: "rich-editor", label: "Descripción Detallada");
  disponible: boolean @ui(widget: "toggle", label: "Disponible para Venta");
}
```

### 2. Componente de Formulario Automático (`AutoForm`)
Este componente dinámico lee la definición del manifiesto en tiempo de ejecución y renderiza el control correspondiente para cada campo:

```javascript
/**
 * AutoForm: Componente que renderiza dinámicamente formularios basados en metadatos @ui
 */
class AutoForm extends reactv.Componente {
  state = { formData: {}, errors: [] };

  renderWidget(fieldName, fieldInfo) {
    const ui = (fieldInfo.decorators && fieldInfo.decorators.ui) || {};
    const label = ui.label || fieldName;
    const widget = ui.widget || "text-input";
    const required = ui.required ? true : false;
    const value = this.state.formData[fieldName] || "";

    const updateField = (val) => {
      this.setState({
        formData: Object.assign({}, this.state.formData, { [fieldName]: val })
      });
    };

    switch (widget) {
      case "select":
        return (
          <div class="form-group">
            <label>{label} {required ? "*" : ""}</label>
            <select class="form-control" onChange={(e) => updateField(e.target.value)}>
              <option value="">-- Seleccionar --</option>
              {(ui.options || []).map(opt => <option value={opt}>{opt}</option>)}
            </select>
          </div>
        );

      case "toggle":
        return (
          <div class="form-group form-check">
            <input type="checkbox" class="form-check-input" checked={!!value} onChange={(e) => updateField(e.target.checked)} />
            <label class="form-check-label">{label}</label>
          </div>
        );

      case "number-input":
        return (
          <div class="form-group">
            <label>{label} {required ? "*" : ""}</label>
            <input type="number" class="form-control" value={value} onInput={(e) => updateField(Number(e.target.value))} />
          </div>
        );

      case "text-input":
      default:
        return (
          <div class="form-group">
            <label>{label} {required ? "*" : ""}</label>
            <input type="text" class="form-control" placeholder={ui.placeholder || ""} value={value} onInput={(e) => updateField(e.target.value)} />
          </div>
        );
    }
  }

  template(state) {
    const schema = this.props.schemaManifest; // Recibe el .schema.json de AFXC
    const fields = (schema && schema.entities && schema.entities[0] && schema.entities[0].fields) || {};

    return (
      <form onSubmit={(e) => { e.preventDefault(); this.props.onSubmit(state.formData); }}>
        {Object.keys(fields).map(fName => this.renderWidget(fName, fields[fName]))}
        <button type="submit" class="btn btn-primary">Guardar Registro</button>
      </form>
    );
  }
}
```

---

## 🗄️ Persistencia en Backend: MariaDB y Alembic

**AVFenix Types** permite sincronizar los esquemas de datos con la base de datos **MariaDB** y gestionar el historial de versiones con **Alembic**:

### 1. Modelos ORM para SQLAlchemy (`avfenix_mariadb.py`)
```python
from avfenix_mariadb import generate_sqlalchemy_file, AVFenixMariaDBSync

# Genera la capa declarativa de SQLAlchemy mapeada a MariaDB
generate_sqlalchemy_file("dist/Producto.schema.json", "models_mariadb.py")

# Sincroniza directamente las tablas en MariaDB
syncer = AVFenixMariaDBSync("dist/Producto.schema.json")
syncer.sync_db("mysql+pymysql://usuario:password@localhost:3306/mi_db")
```

### 2. Control de Migraciones con Alembic (`avfenix_alembic-v2.py`)
```python
from avfenix_alembic import AVFenixAlembicManager

manager = AVFenixAlembicManager("mysql+pymysql://usuario:password@localhost:3306/mi_db")

# Inicializa la estructura de Alembic
manager.init_alembic()

# Autogenera la migración comparando los modelos .avf con MariaDB
manager.create_migration("agregar_campo_disponible")

# Aplica las migraciones pendientes a MariaDB
manager.upgrade_db()

# Revertir / Rollback de la última migración
manager.downgrade_db(target="-1")
```

---

## 🧪 Pruebas Automatizadas y CI/CD

El repositorio includes una suite completa de pruebas unitarias (`afxc.test.js`) y una plantilla de integración continua (`ci-pipeline.yml`):

```bash
# Ejecución de tests automatizados de AFXC v10.0.0
npm test
```

---

## 📜 Licencia y Autoría

Desarrollado para el ecosistema **General.JS** / **AVFenix**. Distribuido bajo la licencia MIT.
