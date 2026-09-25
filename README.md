# 🦅 AVFenix Types & AFXC Compiler Engine (`v10.0.0`)

> **Motor de Transpilación Enterprise & Persistencia de Esquema Dual** para el ecosistema **General.JS** (`gnrl.js`, `reactive.general.js`, `routing.general.js`) y arquitecturas de Backend Fuerte con **MariaDB & Alembic**.

---

## 📐 Arquitectura de Salida Dual

**AFXC (AVFenix Compiler Engine)** elimina la pérdida de tipos (*Type Erasure*) mediante un enfoque de **Persistencia de Esquema Dual**. A partir de archivos fuente `.avf`, compila simultáneamente un manifiesto JSON para backend/BBDD y un bundle JavaScript optimizado para el cliente.

```
                  ┌───────────────────────────────┐
                  │      ModuloFuente.avf         │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                     ┌──────────────────────┐
                     │   AFXC Compiler v10  │
                     └───────────┬──────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  .schema.json    │   │      .js         │   │    .js.map       │
│ Manifiesto CMS / │   │ Bundle Cliente   │   │ Source Maps V3   │
│ Backend / MariaDB│   │ (General.JS / VDOM)│  │ (Depuración VLQ) │
└──────────────────┘   └──────────────────┘   └──────────────────┘
```

---

## ⚡ Matriz de Características Principales

| Característica | Descripción |
| :--- | :--- |
| 🛡️ **Type-Checker Estático** | Analiza reglas semánticas, campos requeridos, rangos `@validate` e integridad `@link` en tiempo de compilación. |
| ⚡ **AST Static Hoisting** | Eleva nodos JSX estáticos fuera del ciclo de renderizado (`template`), acelerando las comparaciones `diff()`/`patch()`. |
| 🔗 **Grafo Multi-Archivo & Alias** | Soporta `export schema/component` e importaciones avanzadas (`import { Specifier as Alias } from "./Module.avf"`). |
| 🌐 **Validador HTTP Runtime** | Middleware para **Express.js**, **Fastify** y **Flask** (`avfenix-validator.js`) que valida payloads JSON sin duplicar código. |
| 🗄️ **MariaDB & Alembic ORM** | Genera modelos SQLAlchemy (`avfenix_mariadb.py`) y gestiona migraciones de base de datos automatizadas (`avfenix_alembic-v2.py`). |
| ⚡ **DevServer Live Reload** | Servidor HTTP nativo sin dependencias externas (`dev-server.js`) con auto-compilación y recarga por SSE. |

---

## 🗄️ Integración con MariaDB y Gestión de Migraciones con Alembic

### 1. Arquitectura de Mapeo de Datos

AFXC transforma las definiciones `.avf` en esquemas declarativos de SQLAlchemy orientados a **MariaDB**:

```
Definición .avf  ──►  Manifiesto .schema.json  ──►  SQLAlchemy (MariaDB)  ──►  Alembic Migration
```

#### Tabla de Mapeo de Tipos
| AVFenix Type | Decoradores | Tipo MariaDB | Constraint Generated |
| :--- | :--- | :--- | :--- |
| `string` | `@ui(required: true)` | `VARCHAR(255)` | `NOT NULL` |
| `string` | `@validate(max: 100)` | `VARCHAR(100)` | Límite de caracteres |
| `text` | `@ui(widget: "rich-editor")` | `TEXT` | Texto largo |
| `number` | `@validate(min: 0)` | `BIGINT` / `FLOAT` | Validación en Check / Application Level |
| `boolean` | Predeterminado `false` | `TINYINT(1)` / `BOOLEAN` | Predeterminado `FALSE` |
| `date` | Timestamp ISO | `DATETIME` | Nullable / Not Null |
| `@link` | `relation: "many-to-one"` | `INTEGER` | `FOREIGN KEY (autor_id) REFERENCES users(id)` |

---

### 2. Comportamiento de Alembic con MariaDB

El gestor de migraciones **`avfenix_alembic.py`** sincroniza las entidades `.avf` con la base de datos MariaDB siguiendo un ciclo de vida transparente:

```
                          ┌───────────────────────────┐
                          │   Modificación .avf       │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │  npx afxc build (.json)   │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │ Modelos SQLAlchemy        │
                          │   (models_mariadb.py)     │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                      Alembic Migration Engine (MariaDB)                       │
├───────────────────────────────────────────────────────────────────────────────┤
│ 1. Inspección Schema Vivo ◄──► Comparación MetaData SQLAlchemy                │
│ 2. Detección de Cambios (ADD COLUMN, DROP COLUMN, ALTER TABLE, FOREIGN KEYS)   │
│ 3. Generación Script en alembic/versions/XXXX_migracion.py                    │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
      ┌───────────────────────────┐         ┌───────────────────────────┐
      │     upgrade_db()          │         │    downgrade_db()         │
      │  Aplica cambios a MariaDB │         │ Rollback de migraciones   │
      └─────────────┬─────────────┘         └─────────────┬─────────────┘
                    │                                     │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                          ┌───────────────────────────┐
                          │ Tabla 'alembic_version'   │
                          │   actualizada en MariaDB  │
                          └───────────────────────────┘
```

#### Operaciones Soportadas en MariaDB
* **Adición/Eliminación de Campos:** Detecta nuevos atributos o campos eliminados en archivos `.avf` e interactúa con `ALTER TABLE`.
* **Modificación de Tipos y Tamaños:** Ajusta el tipo de columna en MariaDB (ej. amplía `VARCHAR(50)` a `VARCHAR(255)`).
* **Restricciones de Clave Foránea (`@link`):** Crea y destruye relaciones referenciales relacionales (`FOREIGN KEY`).
* **Seguridad de Reversión:** Todas las migraciones implementan funciones pareadas `upgrade()` y `downgrade()` automáticas.

---

### 3. Guía de Uso del Gestor de Migraciones (`avfenix_alembic-v2.py`)

#### Inicialización del Entorno
Configura la cadena de conexión de MariaDB e inicializa la estructura de Alembic:

```python
from avfenix_alembic import AVFenixAlembicManager

MARIADB_URL = "mysql+pymysql://usuario:password@localhost:3306/mi_base_datos"

manager = AVFenixAlembicManager(db_url=MARIADB_URL)
manager.init_alembic()
```

#### Generación de Migraciones Automáticas (`autogenerate`)
Compara el esquema activo en MariaDB contra los modelos generados por AFXC:

```python
manager.create_migration(message="agregar_campo_telefono_usuario")
```

#### Aplicación de Migraciones (`upgrade`)
Actualiza MariaDB a la revisión más reciente (`head`):

```python
manager.upgrade_db()
```

#### Reversión / Rollback (`downgrade`)
Revierte cambios de forma segura en caso de incidencias en producción:

```python
# Revertir la última migración (1 nivel hacia atrás)
manager.downgrade_db(target="-1")

# Revertir 2 migraciones hacia atrás
manager.downgrade_db(target="-2")

# Volver al estado inicial limpio (base)
manager.downgrade_db(target="base")

# Volver a un ID de revisión específico
manager.downgrade_db(target="4f8a2c1b9e0d")
```

---

## 📝 Guía de Sintaxis `.avf`

### 1. Declaración de Esquema (`schema` / `export schema`)

```typescript
export schema User {
  nombre: string @ui(widget: "text-input", label: "Nombre Completo", required: true);
  email: string @validate(type: "email");
  edad: number @validate(min: 18, max: 120);
  bio: text @ui(widget: "rich-editor");
  activo: boolean;
}

export schema Article {
  titulo: string @ui(label: "Título Principal", required: true);
  contenido: text;
  autor: User @link(relation: "many-to-one");
}
```

### 2. Componentes Reactivos & JSX (`component` / `export component`)

```typescript
import { UserBadge } from "./User.avf";

export component ArticleCard {
  state = { likes: 0 };

  onMount() {
    this.setState({ likes: this.props.initialLikes || 0 });
  }

  template(state) {
    return (
      <article class="card">
        <h2>{this.props.titulo}</h2>
        <UserBadge name={this.props.authorName} />
        <button onClick={() => this.setState({ likes: state.likes + 1 })}>
          Me gusta ({state.likes})
        </button>
      </article>
    );
  }
}
```

---

## 🌐 Validador Runtime HTTP Backend (`avfenix-validator.js`)

Middleware para **Express.js** y **Fastify** que valida solicitudes contra el manifiesto `.schema.json`:

```javascript
const express = require('express');
const AVFenixValidator = require('./avfenix-validator.js');

const app = express();
app.use(express.json());

const validator = new AVFenixValidator('./dist/App.schema.json');

// Validación automática de payload HTTP contra la entidad 'User'
app.post('/api/usuarios', validator.expressBody('User'), (req, res) => {
  res.json({ success: true, data: req.body });
});
```

---

## 🚀 Guía de Inicio Rápido & CLI

### Comandos Disponibles (`npx afxc`)

```bash
# Inicializar archivo de configuración afxc.config.json
npx afxc init

# Verificación estática de tipos sin emitir archivos
npx afxc check

# Compilación completa de producción (dist/)
npx afxc build

# Iniciar servidor de desarrollo con Live Reload
node dev-server.js
```

---

## 🧪 Pruebas Automatizadas & CI/CD

El proyecto incluye una suite de pruebas automatizadas en **`afxc.test.js`** y configuración para **GitHub Actions** en **`ci-pipeline.yml`**:

```bash
# Ejecución de la batería completa de pruebas
npm test
```

---

## 📦 Recursos y Descargables Disponibles

* 📘 **`Guia_Desarrollo_Componentes_AVFenix-v2.pdf`**: Guía ilustrada de desarrollo UI/JSX.
* 📕 **`Guia_Tipado_Fuerte_AVFenix.pdf`**: Documentación técnica para backend y esquemas.
* 📦 **`avfenix-starter-kit.zip`**: Plantilla de proyecto preconfigurada con AFXC v10.0.0.
* ⚡ **`dev-server.js`**: Servidor de desarrollo nativo con Live Reload.
* 🛡️ **`avfenix-validator.js`**: Middleware de validación HTTP.
* 🗄️ **`avfenix_mariadb.py`** / **`avfenix_alembic-v2.py`**: Integración con MariaDB y Alembic.

---

## 📜 Licencia y Autoría

Desarrollado para el ecosistema **General.JS** / **AVFenix**. Distribuido bajo la licencia MIT.
