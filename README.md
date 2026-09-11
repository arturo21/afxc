# 🦅 AVFenix Types & AFXC Compiler Engine (`v8.0.0`)

**AFXC (AVFenix Compiler Engine)** es el motor de transpilación oficial para **AVFenix Types**, diseñado específicamente para el ecosistema de **General.JS** (`gnrl.js`, `reactive.general.js` y `routing.general.js`).

A diferencia de los transpiladores tradicionales que eliminan los tipos (*Type Erasure*), **AFXC** implementa **Persistencia de Esquema Dual**: compila un único archivo `.avf` generando simultáneamente un **Manifiesto de Entidades JSON** para el backend del CMS y un **Bundle JavaScript de Cliente** optimizado para el navegador.

---

## 🌟 Características Principales

* 🔗 **Grafo de Dependencias Multi-Archivo (`import / export`):** Resuelve recursivamente proyectos estructurados en múltiples archivos `.avf`, previniendo importaciones circulares y fusionando los esquemas en un manifiesto único.
* 🎯 **Lexer AST con Diagnóstico Preciso:** Tokenizador sintáctico que intercepta errores e informa la **línea y columna exacta** del fallo con punteros visuales.
* 🧩 **Soporte JSX Nativo & Slots (`props.children`):** Instanciación automática de componentes personalizados (PascalCase) e inyección de elementos hijos dinámicos para el Virtual DOM.
* ⚡ **AST Static Hoisting:** Identifica nodos JSX estáticos y los eleva fuera del ciclo de renderizado (`template`), acelerando las comparaciones `diff()` y `patch()` de `reactive.general.js`.
* 🛡️ **Type-Checker Estático Semántico:** Verifica la validez de entidades, relaciones `@link`, reglas de rango `@validate` y widgets `@ui` en tiempo de compilación.
* 🗺️ **Source Maps V3 (Base64 VLQ):** Mapeo de código para depuración directa sobre las líneas del archivo `.avf` en las DevTools del navegador.
* ⚙️ **CLI de Producción & Configuration File:** Soporte para `afxc.config.json` y comandos de consola (`init`, `check`, `build`).

---

## 📦 Arquitectura de Salida Dual

Cuando **AFXC** procesa un módulo `.avf`, genera tres artefactos en la carpeta de distribución (`/dist`):

```
proyecto/
├── src/
│   ├── User.avf
│   └── Article.avf
├── dist/
│   ├── Article.schema.json   <-- Manifiesto Tipado para el CMS (Backend / DB / UI)
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
# Instalación del núcleo General.JS vía NPM
npm install gnrl.js
```

### 2. Crear Archivo de Configuración
Inicializa el archivo de configuración en la raíz de tu proyecto:

```bash
node afxc-v8.js init
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
node afxc-v8.js check
```

### 4. Compilación de Producción
Genera el bundle cliente y el manifiesto CMS:

```bash
node afxc-v8.js build
```

---

## 📝 Guía de Sintaxis `.avf`

### 1. Declaración de Esquema CMS (`schema`)
Define entidades de base de datos e interfaz administrativa con decoradores:

```typescript
schema Article {
  title: string @ui(widget: "text-input", label: "Título Principal", required: true);
  content: text @ui(widget: "rich-editor");
  views: number @validate(min: 0);
  status: string @ui(widget: "select", options: ["draft", "published"]);
  author: User @link(relation: "many-to-one");
}
```

### 2. Componentes Reactivos (`component`)
Componentes visuales con estado, ciclo de vida (`onMount`, `onDestroy`) y JSX declarativo:

```typescript
import { UserBadge } from "./User.avf";

component ArticleCard {
  state = { likes: 0 };

  onMount() {
    this.setState({ likes: this.props.initialLikes || 0 });
  }

  template(state) {
    return (
      <article class="card">
        <h2>{this.props.title}</h2>
        <UserBadge name={this.props.authorName} />
        <button onClick={() => this.setState({ likes: state.likes + 1 })}>
          Me gusta ({state.likes})
        </button>
      </article>
    );
  }
}
```

### 3. Extensiones y Plugins (`extension` / `plugin`)
Integración directa con las capacidades de extensión de **General.JS**:

```typescript
// Extiende las utilidades de General.JS (genrl.extend)
extension ArticleUtils {
  formatSlug(title) {
    return title.toLowerCase().replace(/\s+/g, '-');
  }
}

// Registra un plugin seguro (genrl.use)
plugin AuditPlugin {
  General.log("Plugin de auditoría inicializado");
}
```

### 4. Rutas SPA (`routing.map`)
Mapeo de navegación sin recargar la página mediante `routing.general.js`:

```typescript
routing.map("/article/:id").to((params) => {
  new ArticleCard({ id: params.id }, "#app-root");
});
```

---

## 🧪 Pruebas Automatizadas y CI/CD

El repositorio incluye una suite completa de pruebas unitarias (`afxc.test.js`) y una plantilla de integración continua (`ci-pipeline.yml`):

```bash
# Ejecución de tests automatizados
npm test
```

El pipeline de **GitHub Actions** ejecuta la matriz de pruebas en Node.js 18, 20 y 22, validando la construcción de distribuidos y verificando que no existan regresiones en el parser AST ni en el grafo de módulos.

---

## 📜 Licencia y Autoría

Desarrollado para el ecosistema **General.JS** / **AVFenix**. Distribuido bajo la licencia MIT.
