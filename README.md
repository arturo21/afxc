# 🦅 AVFenix Types & AFXC Compiler Engine (`v9.0.0`)

**AFXC (AVFenix Compiler Engine)** es el motor de transpilación y compilación oficial para **AVFenix Types**, diseñado específicamente para el ecosistema de **General.JS** (`gnrl.js`, `reactive.general.js` y `routing.general.js`).

A diferencia de los transpiladores tradicionales que eliminan los tipos (*Type Erasure*), **AFXC** implementa **Persistencia de Esquema Dual**: compila un proyecto `.avf` generando simultáneamente un **Manifiesto de Entidades JSON** para el backend del CMS y un **Bundle JavaScript de Cliente** optimizado para el navegador.

---

## 🌟 Características Principales (v9.0.0 Enterprise)

* 🔗 **Grafo de Dependencias Multi-Archivo (`import / export`):** Resuelve recursivamente proyectos divididos en múltiples archivos `.avf`, gestionando alias de importación (`import { Specifier as Alias }`) y previniendo dependencias circulares.
* 📦 **Soporte Nativo de Exportación:** Admite cláusulas `export` en esquemas, componentes, extensiones y plugins (`export schema`, `export component`, etc.), limpiándolas en el bundle cliente para su ejecución segura dentro del contexto `genrl.safeEval()`.
* 🎯 **Lexer AST con Diagnóstico Preciso:** Tokenizador sintáctico que intercepta errores e informa la **línea y columna exacta** del fallo con punteros visuales en la consola.
* 🧩 **Soporte JSX Nativo & Slots (`props.children`):** Instanciación de componentes personalizados (PascalCase) e inyección de elementos hijos dinámicos dentro del Virtual DOM de **reactive.general.js**.
* ⚡ **AST Static Hoisting:** Identifica subárboles JSX estáticos y los eleva fuera del ciclo de renderizado (`template`), reduciendo el trabajo del algoritmo `diff()` y `patch()`.
* 🛡️ **Type-Checker Estático Semántico:** Verifica entidades, relaciones `@link`, reglas de rango `@validate` y widgets `@ui` en tiempo de compilación.
* 🗺️ **Source Maps V3 (Base64 VLQ):** Mapeo de código estandarizado para depuración directa sobre las líneas del archivo `.avf` en las DevTools del navegador.
* ⚙️ **CLI Oficial & `afxc.config.json`:** Comandos de consola integrados (`npx afxc init`, `npx afxc check`, `npx afxc build`) para flujos de desarrollo local y CI/CD.

---

## 📦 Arquitectura de Salida Dual

Cuando **AFXC** procesa un módulo `.avf`, genera tres artefactos en la carpeta de distribución (`/dist`):

```
proyecto/
├── src/
│   ├── User.avf
│   └── MainApp.avf
├── dist/
│   ├── MainApp.schema.json   <-- Manifiesto Tipado Consolidado para el CMS
│   ├── MainApp.js            <-- Bundle Cliente enlazado a General.JS
│   └── MainApp.js.map        <-- Source Map V3 (Depuración)
└── afxc.config.json
```

1. **`[Modulo].schema.json`**: Contiene la definición consolidada de datos, tipos, decoradores `@ui` y `@validate`, relaciones relacionales e informe de diagnósticos del Type-Checker.
2. **`[Modulo].js`**: Código ejecutable envuelto en el patrón **Module Revealed**, protegido dentro de `genrl.run()` y `genrl.safeEval()` para evitar fallos globales en producción.
3. **`[Modulo].js.map`**: Mapeo estandarizado Base64 VLQ para inspección de código fuente original.

---

## 🚀 Guía de Inicio Rápido

### 1. Instalación
Puedes instalar **AFXC** en tu proyecto mediante NPM:

```bash
npm install -D afxc gnrl.js
```

### 2. Inicializar Configuración (`afxc.config.json`)
Crea el archivo de configuración en la raíz de tu proyecto:

```bash
npx afxc init
```

Esto generará un archivo `afxc.config.json`:

```json
{
  "entry": "./src/MainApp.avf",
  "outDir": "./dist",
  "strictMode": false,
  "cmsManifest": true,
  "sourceMap": true
}
```

### 3. Verificación Estática de Tipos
Ejecuta el Type-Checker semántico sin emitir archivos:

```bash
npx afxc check
```

### 4. Compilación de Producción
Compila el proyecto y genera los artefactos en `/dist`:

```bash
npx afxc build
```

---

## 📝 Guía de Sintaxis `.avf`

### 1. Declaración de Esquema CMS (`export schema`)
Define entidades de base de datos e interfaz administrativa con decoradores:

```typescript
export schema User {
  nombre: string @ui(widget: "text-input", label: "Nombre Completo", required: true);
  email: string @validate(type: "email") @ui(widget: "email-input");
  rol: string @ui(widget: "select", options: ["admin", "editor", "user"]);
}
```

### 2. Componentes Reactivos e Importaciones (`import / export component`)
Componentes visuales con estado, ciclo de vida (`onMount`, `onDestroy`), alias e instanciación JSX:

```typescript
import { User as UserModel } from "./User.avf";

export component UserCard {
  state = { expanded: false };

  template(state) {
    return (
      <div class="user-card">
        <h3>{this.props.user ? this.props.user.nombre : "Invitado"}</h3>
        <button onClick={() => this.setState({ expanded: !state.expanded })}>
          {state.expanded ? "Ocultar Detalle" : "Ver Detalle"}
        </button>
        {state.expanded ? (
          <p>Email: {this.props.user ? this.props.user.email : "N/A"}</p>
        ) : null}
      </div>
    );
  }
}
```

### 3. Extensiones y Plugins (`extension` / `plugin`)
Integración con el sistema de extensión modular de **General.JS**:

```typescript
export extension UserUtils {
  formatTag(user) {
    return user ? "@" + user.nombre.toLowerCase().replace(/\s+/g, '_') : "Anonimo";
  }
}

export plugin SecurityPlugin {
  General.log("Plugin de seguridad inicializado");
}
```

### 4. Rutas SPA (`routing.map`)
Mapeo de navegación sin recargar la página mediante `routing.general.js`:

```typescript
routing.map("/user/:id").to((params) => {
  new UserCard({ id: params.id }, "#app-root");
});
```

---

## 🧪 Pruebas Automatizadas y CI/CD

El paquete incluye una suite completa de pruebas de integración (`afxc.test.js`) y configuración para **GitHub Actions** (`ci-pipeline.yml`):

```bash
# Ejecutar la suite de pruebas unitarias
npm test
```

El pipeline de CI/CD ejecuta las pruebas en Node.js 18, 20 y 22, asegurando la calidad del código en cada `push` o `pull_request`.

---

## 📜 Licencia y Autoría

Desarrollado para el ecosistema **General.JS** / **AVFenix**. Distribuido bajo la licencia MIT.