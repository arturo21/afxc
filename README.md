# 🦅 AVFenix Types & AFXC Compiler Engine (`v10.0.0`)

> **Motor de Compilación, Transpilación y Tipado Fuerte para el Ecosistema General.JS**  
> *Soporte para Persistencia de Esquema Dual, AST Static Hoisting, Source Maps V3, Validación HTTP y Grafo Multi-Archivo.*

---

## 🌟 Visión General

**AFXC (AVFenix Compiler Engine)** es el compilador oficial de **AVFenix Types**. Diseñado para proyectos de alto rendimiento construidos sobre **General.JS** (`gnrl.js`, `reactive.general.js` y `routing.general.js`), AFXC rompe con el paradigma tradicional de *Type Erasure* e implementa **Persistencia de Esquema Dual**:

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                            Archivo Fuente (.avf)                            │
 └──────────────────────────────────────┬──────────────────────────────────────┘
                                        │
                                 [ AFXC Engine ]
                                        │
         ┌──────────────────────────────┼──────────────────────────────┐
         ▼                              ▼                              ▼
 ┌───────────────┐              ┌───────────────┐              ┌───────────────┐
 │ Manifiesto CMS│              │ Bundle JS     │              │ Source Map    │
 │ .schema.json  │              │ .js           │              │ .js.map (V3)  │
 └───────┬───────┘              └───────┬───────┘              └───────────────┘
         │                              │
         ▼                              ▼
 ┌───────────────┐              ┌───────────────┐
 │ Validaciones  │              │ Runtime       │
 │ Backend / API │              │ General.JS    │
 └───────────────┘              └───────────────┘
```

1. **Backend / CMS (`.schema.json`)**: Genera manifiestos estructurados con metadatos de UI, tipos, decoradores `@validate`, `@ui`, `@link` y reglas de integridad para bases de datos o validadores HTTP.
2. **Cliente Web (`.js`)**: Genera bundles JavaScript optimizados con **AST Static Hoisting**, ejecutable de forma segura mediante `genrl.safeEval()` en **General.JS**.
3. **Depuración (`.js.map`)**: Mapeo estándar Base64 VLQ para inspección de código nativo sobre archivos `.avf` desde las DevTools.

---

## 🚀 Características Clave (Feature Matrix)

| Característica | Descripción | Beneficio Principal |
| :--- | :--- | :--- |
| **🛡️ Type-Checker Estático** | Analizador semántico previo a la emisin de código. | Captura errores de tipo y rango en tiempo de compilación. |
| **⚡ AST Static Hoisting** | Elevación de subárboles JSX estáticos fuera del `template()`. | Optimización masiva del Virtual DOM en `reactive.general.js`. |
| **🔗 Grafo Multi-Archivo** | `import / export` recursivo con alias (`import { A as B }`). | Modularización completa con prevención de ciclos. |
| **🌐 Validador Runtime HTTP** | Middleware ejecutable para **Express** y **Fastify** (`avfenix-validator.js`). | Validación automática de payloads HTTP basada en esquemas `.avf`. |
| **🎯 Lexer de Alta Precisión** | Mapeo exacto de tokens con punteros visuales de línea y columna. | Diagnóstico claro de errores sintácticos. |
| **🧩 JSX Component Slots** | Instanciación PascalCase e inyección de `props.children`. | Arquitectura de componentes contenedores y reusables. |
| **⚙️ CLI & Configuración** | Herramienta CLI (`npx afxc`) y archivo `afxc.config.json`. | Fácil integración en scripts de construcción y pipelines CI/CD. |

---

## 🛠️ Instalación y Configuración Rápida

### 1. Inicialización en el Proyecto
```bash
# Crear el archivo de configuración afxc.config.json
npx afxc init
```

Esto generará la configuración por defecto del compilador:
```json
{
  "entry": "./src/Main.avf",
  "outDir": "./dist",
  "strictMode": false,
  "cmsManifest": true,
  "sourceMap": true
}
```

### 2. Comprobación Estática de Tipos (Sin Emitir Distribuidos)
```bash
npx afxc check
```

### 3. Compilación de Producción
```bash
npx afxc build
```

---

## 📝 Guía de Sintaxis del Lenguaje `.avf`

### A. Declaración de Esquemas (`schema` / `export schema`)
Define estructuras de datos con tipado fuerte, reglas de validación y componentes visuales para el CMS:

```typescript
export schema User {
  nombre: string @ui(widget: "text-input", label: "Nombre Completo", required: true);
  email: string @validate(type: "email") @ui(widget: "email-input");
  edad: number @validate(min: 18, max: 120);
  rol: string @ui(widget: "select", options: ["admin", "editor", "user"]);
}

export schema Post {
  titulo: string @ui(widget: "text-input");
  cuerpo: text @ui(widget: "rich-editor");
  vistas: number @validate(min: 0);
  autor: User @link(relation: "many-to-one");
}
```

### B. Componentes Reactivos (`component`)
Componentes visuales con ciclo de vida, JSX declarativo, renderizado de componentes hijos y estado reactivo:

```typescript
import { User } from "./User.avf";

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
          <div class="details">
            <p>Email: {this.props.user.email}</p>
          </div>
        ) : null}
      </div>
    );
  }
}
```

### C. Extensiones, Plugins y Rutas SPA
```typescript
// Extensión de utilidades
export extension StringHelpers {
  slugify(text) {
    return text.toLowerCase().replace(/\s+/g, '-');
  }
}

// Plugin de auditoría
export plugin LoggerPlugin {
  General.log("Módulo inicializado correctamente.");
}

// Enrutamiento SPA
routing.map("/usuario/:id").to((params) => {
  new UserCard({ userId: params.id }, "#app-root");
});
```

---

## 🌐 Middleware de Validación HTTP Backend (`avfenix-validator.js`)

Puedes reutilizar las reglas de tipado de tus archivos `.avf` en tu servidor **Node.js** para validar entradas de peticiones HTTP en tiempo de ejecución.

```javascript
const express = require('express');
const AVFenixValidator = require('./avfenix-validator.js');

const app = express();
app.use(express.json());

// Cargar el manifiesto CMS compilado
const validator = new AVFenixValidator('./dist/Main.schema.json');

// Validar automáticamente el payload contra la entidad 'User'
app.post('/api/usuarios', validator.expressBody('User'), (req, res) => {
  res.json({ status: "success", data: req.body });
});
```

Si el cliente envía datos inválidos, el middleware responde automáticamente con `HTTP 400 Bad Request`:
```json
{
  "error": "ValidationError",
  "entity": "User",
  "issues": [
    { "field": "email", "message": "El campo 'email' debe ser un correo electrónico válido." },
    { "field": "edad", "message": "El campo 'edad' debe ser mayor o igual a 18." }
  ]
}
```

---

## 🧪 Pruebas Automatizadas & CI/CD Pipeline

El proyecto cuenta con una batería de pruebas de integración completa (`afxc.test.js`) y un workflow listo para **GitHub Actions** (`ci-pipeline.yml`):

```bash
# Ejecutar la suite de pruebas unitarias e integración
npm test
```

El pipeline de CI/CD automatiza los siguientes pasos en Node.js 18, 20 y 22:
1. `npm run check`: Verificación estática de tipos.
2. `npm test`: Batería de pruebas.
3. `npm run build`: Generación de distribuidos.
4. `npm pack --dry-run`: Validación de paquete distribuible.

---

## 📚 Recursos Descargables Incluidos

El repositorio incluye documentación y herramientas listas para descargar:

* 📄 **`Guia_Desarrollo_Componentes_AVFenix-v2.pdf`**: Guía técnica completa sobre arquitectura de componentes, Compound Components, SSR e Hidratación.
* 📄 **`Guia_Tipado_Fuerte_AVFenix.pdf`**: Guía especializada en el uso exclusivo de esquemas y tipado fuerte para backend/APIs.
* 📦 **`avfenix-starter-kit.zip`**: Kit de inicio rápido con proyecto preconfigurado.
* ⚙️ **`avfenix-validator.js`**: Middleware para Express/Fastify.

---

## 📜 Licencia y Ecosistema

Desarrollado para el ecosistema **General.JS** / **AVFenix**. Distribuido bajo la Licencia **MIT**.
