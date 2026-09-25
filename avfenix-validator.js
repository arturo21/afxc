/**
 * AVFenix Schema Validator Middleware (Express & Fastify)
 * Consume el manifiesto .schema.json generado por AFXC para validar
 * payloads de peticiones HTTP en runtime sin duplicar código.
 */

const fs = require('fs');
const path = require('path');

class AVFenixValidator {
  /**
   * @param {Object|string} manifest - Objeto de manifiesto JSON o ruta al archivo .schema.json
   */
  constructor(manifest) {
    if (typeof manifest === 'string') {
      const absPath = path.resolve(manifest);
      if (!fs.existsSync(absPath)) {
        throw new Error(`[AVFenixValidator] No se encontró el manifiesto schema.json en: ${absPath}`);
      }
      this.manifest = JSON.parse(fs.readFileSync(absPath, 'utf8'));
    } else {
      this.manifest = manifest;
    }

    this.entities = new Map();
    if (this.manifest && Array.isArray(this.manifest.entities)) {
      this.manifest.entities.forEach(ent => {
        this.entities.set(ent.entity, ent);
      });
    }
  }

  /**
   * Valida un objeto de datos contra una entidad definida en el manifiesto.
   * @param {string} entityName - Nombre de la entidad (ej. 'User')
   * @param {Object} data - Payload de datos a validar (req.body)
   * @returns {{ valid: boolean, issues: Array<{field: string, message: string}> }}
   */
  validate(entityName, data) {
    const entity = this.entities.get(entityName);
    if (!entity) {
      return {
        valid: false,
        issues: [{ field: '_entity', message: `Entidad '${entityName}' no definida en el manifiesto schema.json.` }]
      };
    }

    const issues = [];
    const payload = data || {};

    for (const [fieldName, fieldDef] of Object.entries(entity.fields || {})) {
      const value = payload[fieldName];
      const { type, decorators } = fieldDef;

      // 1. Validar presencia y requeridos
      const isRequired = decorators.validate && decorators.validate.required === true;
      if (value === undefined || value === null || value === '') {
        if (isRequired) {
          issues.push({ field: fieldName, message: `El campo '${fieldName}' es obligatorio.` });
        }
        continue;
      }

      // 2. Validar tipo primario
      if (!this.checkType(type, value)) {
        issues.push({ field: fieldName, message: `El campo '${fieldName}' debe ser de tipo '${type}'.` });
        continue;
      }

      // 3. Validar decorador @validate
      if (decorators.validate) {
        const rules = decorators.validate;

        if (rules.type === 'email' && typeof value === 'string') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            issues.push({ field: fieldName, message: `El campo '${fieldName}' debe ser un correo electrónico válido.` });
          }
        }

        if (typeof value === 'number') {
          if (rules.min !== undefined && value < rules.min) {
            issues.push({ field: fieldName, message: `El campo '${fieldName}' debe ser mayor o igual a ${rules.min}.` });
          }
          if (rules.max !== undefined && value > rules.max) {
            issues.push({ field: fieldName, message: `El campo '${fieldName}' debe ser menor o igual a ${rules.max}.` });
          }
        }

        if (typeof value === 'string') {
          if (rules.minLength !== undefined && value.length < rules.minLength) {
            issues.push({ field: fieldName, message: `El campo '${fieldName}' debe tener al menos ${rules.minLength} caracteres.` });
          }
          if (rules.maxLength !== undefined && value.length > rules.maxLength) {
            issues.push({ field: fieldName, message: `El campo '${fieldName}' no debe exceder ${rules.maxLength} caracteres.` });
          }
          if (rules.pattern) {
            const regex = new RegExp(rules.pattern);
            if (!regex.test(value)) {
              issues.push({ field: fieldName, message: `El campo '${fieldName}' no cumple con el formato requerido.` });
            }
          }
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  checkType(expectedType, value) {
    switch (expectedType.toLowerCase()) {
      case 'string':
      case 'text':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'date':
        return !isNaN(Date.parse(value));
      default:
        return typeof value === 'string' || typeof value === 'object';
    }
  }

  /**
   * Middleware Express.js
   */
  expressBody(entityName) {
    return (req, res, next) => {
      const { valid, issues } = this.validate(entityName, req.body);
      if (!valid) {
        return res.status(400).json({
          error: 'ValidationError',
          message: `Falló la validación del payload para la entidad '${entityName}'.`,
          entity: entityName,
          issues
        });
      }
      next();
    };
  }

  /**
   * Hook Fastify
   */
  fastifyBody(entityName) {
    return async (request, reply) => {
      const { valid, issues } = this.validate(entityName, request.body);
      if (!valid) {
        reply.code(400).send({
          error: 'ValidationError',
          message: `Falló la validación del payload para la entidad '${entityName}'.`,
          entity: entityName,
          issues
        });
      }
    };
  }
}

module.exports = AVFenixValidator;
