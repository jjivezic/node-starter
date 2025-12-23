import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { schemas } from './schema-definition.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get model name from command line
const modelName = process.argv[2];

if (!modelName) {
  console.error('❌ Please provide a model name: node database/schema-generator.js <ModelName>');
  process.exit(1);
}

if (!schemas[modelName]) {
  console.error(`❌ Model "${modelName}" not found in schema-definition.js`);
  console.log('Available models:', Object.keys(schemas).join(', '));
  process.exit(1);
}

const schema = schemas[modelName];
const moduleName = modelName.toLowerCase();

// Check if model already exists
const modelPath = path.join(__dirname, 'models', `${modelName}.js`);
const modulePath = path.join(__dirname, '..', 'src', 'modules', moduleName);

if (fs.existsSync(modelPath) || fs.existsSync(modulePath)) {
  console.error(`❌ ${modelName} already exists! ${modelPath} `);
  //empty  spaces for proper indentation in the generated code 
  console.log(`   Model: ${fs.existsSync(modelPath) ? '✓' : '✗'}`); 
  console.log(`   Module: ${fs.existsSync(modulePath) ? '✓' : '✗'}`);
  console.log('\nTo regenerate, delete the existing files first:');
  console.log(`   rm database/models/${modelName}.js`);
  console.log(`   rm -rf src/modules/${moduleName}`);
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace('T', '');
const fileName = `${timestamp}-create-${schema.tableName}-table.cjs`;
const filePath = path.join(__dirname, 'migrations', fileName);

// Generate field definitions for migration
function generateFields(fields) {
  return Object.entries(fields)
    .map(([fieldName, config]) => {
     //empty  spaces for proper indentation in the generated code 
      const lines = [`      ${fieldName}: {`];
      
      // Add type
      lines.push(`        type: Sequelize.${config.type},`);
      
      // Add other properties
      if (config.primaryKey) lines.push('        primaryKey: true,');
      if (config.autoIncrement) lines.push('        autoIncrement: true,');
      if (config.allowNull !== undefined) lines.push(`        allowNull: ${config.allowNull},`);
      if (config.unique) lines.push('        unique: true,');
      if (config.defaultValue !== undefined) {
        const value = typeof config.defaultValue === 'string' 
          ? `'${config.defaultValue}'` 
          : config.defaultValue;
        lines.push(`        defaultValue: ${value},`);
      }
      if (config.references) {
        lines.push('        references: {');
        lines.push(`          model: '${config.references.model}',`);
        lines.push(`          key: '${config.references.key}'`);
        lines.push('        },');
        if (config.onDelete) lines.push(`        onDelete: '${config.onDelete}',`);
        if (config.onUpdate) lines.push(`        onUpdate: '${config.onUpdate}',`);
      }
      
      lines.push('      }');
      return lines.join('\n');
    })
    .join(',\n');
}

// Generate indexes for migration
function generateIndexes(tableName, indexes) {
  if (!indexes || indexes.length === 0) return '';
  
  return indexes.map((index, i) => {
    const fields = index.fields.map(f => `'${f}'`).join(', ');
    const unique = index.unique ? ', unique: true' : '';
    return `    await queryInterface.addIndex('${tableName}', [${fields}]${unique});`;
  }).join('\n');
}

// Generate migration file content
const migrationContent = `'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('${schema.tableName}', {
${generateFields(schema.fields)}${schema.timestamps ? `,
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }` : ''}
    });
${generateIndexes(schema.tableName, schema.indexes)}
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('${schema.tableName}');
  }
};
`;

// Generate Sequelize model file
const modelContent = `import { DataTypes } from 'sequelize';
import sequelize from '../connection.js';

const ${modelName} = sequelize.define('${modelName}', {
${Object.entries(schema.fields)
  .map(([fieldName, config]) => {
    const lines = [`  ${fieldName}: {`];
     //empty  spaces for proper indentation in the generated code 
    lines.push(`    type: DataTypes.${config.type},`);
    if (config.primaryKey) lines.push('    primaryKey: true,');
    if (config.autoIncrement) lines.push('    autoIncrement: true,');
    if (config.allowNull !== undefined) lines.push(`    allowNull: ${config.allowNull},`);
    if (config.unique) lines.push('    unique: true,');
    if (config.defaultValue !== undefined) {
      const value = typeof config.defaultValue === 'string' 
        ? `'${config.defaultValue}'` 
        : config.defaultValue;
      lines.push(`    defaultValue: ${value},`); 
    }
    if (config.validate) {
      lines.push('    validate: {');
      Object.entries(config.validate).forEach(([key, value]) => {
        lines.push(`      ${key}: ${JSON.stringify(value)}`);
      });
      lines.push('    },');
    }
    if (config.references) {
      lines.push('    references: {');
      lines.push(`      model: '${config.references.model}',`);
      lines.push(`      key: '${config.references.key}'`);
      lines.push('    },');
      if (config.onDelete) lines.push(`    onDelete: '${config.onDelete}',`);
      if (config.onUpdate) lines.push(`    onUpdate: '${config.onUpdate}',`);
    }
    lines.push('  }');
    return lines.join('\n');
  })
  .join(',\n')}
}, {
  tableName: '${schema.tableName}',
  timestamps: ${schema.timestamps || false},${schema.timestamps ? `
  createdAt: 'created_at',
  updatedAt: 'updated_at',` : ''}${schema.indexes && schema.indexes.length > 0 ? `
  indexes: [
${schema.indexes.map(index => {
  const fields = index.fields.map(f => `'${f}'`).join(', ');
  const unique = index.unique ? ', unique: true' : '';
  return `    { fields: [${fields}]${unique} }`;
}).join(',\n')}
  ]` : ''}
});

export default ${modelName};
`;

// Write migration file
fs.writeFileSync(filePath, migrationContent);
console.log(`✅ Migration created: ${fileName}`);

// Write model file
fs.writeFileSync(modelPath, modelContent);
console.log(`✅ Model created: ${modelName}.js`);

// Create module directory
if (!fs.existsSync(modulePath)) {
  fs.mkdirSync(modulePath, { recursive: true });
}

// Generate Manager
const managerContent = `import db from '../../../database/models/index.js';
import { AppError, COMMON_ERRORS } from '../../middleware/errorHandler.js';

const { ${modelName} } = db;

class ${modelName}Manager {
  async getAll() {
    const items = await ${modelName}.findAll();
    return items;
  }

  async getById(id) {
    const item = await ${modelName}.findByPk(id);

    if (!item) {
      throw new AppError(COMMON_ERRORS.NOT_FOUND);
    }

    return item;
  }

  async create(data) {
    const item = await ${modelName}.create(data);
    return item;
  }

  async update(id, data) {
    const item = await ${modelName}.findByPk(id);
    
    if (!item) {
      throw new AppError(COMMON_ERRORS.NOT_FOUND);
    }

    await item.update(data);
    return this.getById(id);
  }

  async delete(id) {
    const item = await ${modelName}.findByPk(id);

    if (!item) {
      throw new AppError(COMMON_ERRORS.NOT_FOUND);
    }

    await item.destroy();
    return { success: true };
  }
}

export default new ${modelName}Manager();
`;

// Generate Controller
const controllerContent = `import ${moduleName}Manager from './manager.js';
import { catchAsync } from '../../middleware/errorHandler.js';
import logger from '../../config/logger.js';

class ${modelName}Controller {
  getAll = catchAsync(async (req, res) => {
    const items = await ${moduleName}Manager.getAll();

    res.status(200).json({
      success: true,
      data: items
    });
  });

  getById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const item = await ${moduleName}Manager.getById(id);

    res.status(200).json({
      success: true,
      data: item
    });
  });

  create = catchAsync(async (req, res) => {
    const item = await ${moduleName}Manager.create(req.body);
    logger.info(\`${modelName} created: \${item.id}\`);

    res.status(201).json({
      success: true,
      message: '${modelName} created successfully',
      data: item
    });
  });

  update = catchAsync(async (req, res) => {
    const { id } = req.params;
    const item = await ${moduleName}Manager.update(id, req.body);
    logger.info(\`${modelName} updated: \${id}\`);

    res.status(200).json({
      success: true,
      message: '${modelName} updated successfully',
      data: item
    });
  });

  delete = catchAsync(async (req, res) => {
    const { id } = req.params;
    await ${moduleName}Manager.delete(id);
    logger.info(\`${modelName} deleted: \${id}\`);

    res.status(200).json({
      success: true,
      message: '${modelName} deleted successfully'
    });
  });
}

export default new ${modelName}Controller();
`;

// Generate Routes
const routesContent = `import express from 'express';
import ${moduleName}Controller from './controller.js';
import authMiddleware from '../../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/${moduleName}s:
 *   get:
 *     tags: [${modelName}s]
 *     summary: Get all ${moduleName}s
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of ${moduleName}s
 */
router.get('/', ${moduleName}Controller.getAll);

/**
 * @swagger
 * /api/${moduleName}s/{id}:
 *   get:
 *     tags: [${modelName}s]
 *     summary: Get ${moduleName} by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: ${modelName} details
 *       404:
 *         description: ${modelName} not found
 */
router.get('/:id', ${moduleName}Controller.getById);

/**
 * @swagger
 * /api/${moduleName}s:
 *   post:
 *     tags: [${modelName}s]
 *     summary: Create a new ${moduleName}
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/${modelName}'
 *     responses:
 *       201:
 *         description: ${modelName} created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', ${moduleName}Controller.create);

/**
 * @swagger
 * /api/${moduleName}s/{id}:
 *   put:
 *     tags: [${modelName}s]
 *     summary: Update a ${moduleName}
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/${modelName}'
 *     responses:
 *       200:
 *         description: ${modelName} updated successfully
 *       404:
 *         description: ${modelName} not found
 */
router.put('/:id', ${moduleName}Controller.update);

/**
 * @swagger
 * /api/${moduleName}s/{id}:
 *   delete:
 *     tags: [${modelName}s]
 *     summary: Delete a ${moduleName}
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: ${modelName} deleted successfully
 *       404:
 *         description: ${modelName} not found
 */
router.delete('/:id', ${moduleName}Controller.delete);

export default router;
`;

// Write module files
fs.writeFileSync(path.join(modulePath, 'manager.js'), managerContent);
console.log(`✅ Manager created: src/modules/${moduleName}/manager.js`);

fs.writeFileSync(path.join(modulePath, 'controller.js'), controllerContent);
console.log(`✅ Controller created: src/modules/${moduleName}/controller.js`);

fs.writeFileSync(path.join(modulePath, 'routes.js'), routesContent);
console.log(`✅ Routes created: src/modules/${moduleName}/routes.js`);

// Update models/index.js
const modelsIndexPath = path.join(__dirname, 'models', 'index.js');
const modelsIndexContent = fs.readFileSync(modelsIndexPath, 'utf8');

if (!modelsIndexContent.includes(`import ${modelName}`)) {
  const importLine = `import ${modelName} from './${modelName}.js';`;
  const updatedContent = modelsIndexContent
    .replace(/(import User from '\.\/User\.js';)/, `$1\n${importLine}`)
    .replace(/(const db = {[\s\S]*?User)/m, `$1,\n  ${modelName}`);
  
  fs.writeFileSync(modelsIndexPath, updatedContent);
  console.log(`✅ Updated: database/models/index.js`);
}

// Update routes/index.js
const routesIndexPath = path.join(__dirname, '..', 'src', 'routes', 'index.js');
const routesIndexContent = fs.readFileSync(routesIndexPath, 'utf8');

if (!routesIndexContent.includes(`import ${moduleName}Routes`)) {
  const importLine = `import ${moduleName}Routes from '../modules/${moduleName}/routes.js';`;
  const routeLine = `router.use('/${moduleName}s', ${moduleName}Routes);`;
  
  const updatedRoutesContent = routesIndexContent
    .replace(/(import authRoutes from '\.\.\/modules\/auth\/routes\.js';)/, `$1\n${importLine}`)
    .replace(/(router\.use\('\/auth', authRoutes\);)/, `$1\n${routeLine}`);
  
  fs.writeFileSync(routesIndexPath, updatedRoutesContent);
  console.log(`✅ Updated: src/routes/index.js`);
}

console.log('\n📝 Next steps:');
console.log('1. Run: npm run db:migrate');
console.log('2. Start server: npm run dev');

