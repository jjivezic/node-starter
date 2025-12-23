/**
 * Database Schema Definition
 * 
 * Define your database schema here and use this to generate migrations
 * Run: node database/schema-generator.js <model-name>
 */

export const schemas = {
  // User model
  User: {
    tableName: 'users',
    fields: {
      id: {
        type: 'INTEGER',
        primaryKey: true,
        autoIncrement: true
      },
      email: {
        type: 'STRING(255)',
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
          notEmpty: true
        }
      },
      password: {
        type: 'STRING(255)',
        allowNull: false,
        validate: {
          notEmpty: true
        }
      },
      name: {
        type: 'STRING(255)',
        allowNull: false,
        validate: {
          notEmpty: true
        }
      }
    },
    indexes: [
      { fields: ['email'], unique: true }
    ],
    timestamps: true
  },

  // Product model
  Product: {
    tableName: 'products',
    fields: {
      id: {
        type: 'INTEGER',
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: 'STRING(255)',
        allowNull: false,
        validate: {
          notEmpty: true
        }
      },
      description: {
        type: 'TEXT',
        allowNull: true
      },
      price: {
        type: 'DECIMAL(10, 2)',
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0
        }
      },
      stock: {
        type: 'INTEGER',
        defaultValue: 0,
        validate: {
          min: 0
        }
      },
      user_id: {
        type: 'INTEGER',
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      }
    },
    indexes: [
      { fields: ['user_id'] },
      { fields: ['name'] }
    ],
    timestamps: true
  },

  // Category model
  Category: {
    tableName: 'categories',
    fields: {
      id: {
        type: 'INTEGER',
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: 'STRING(100)',
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true
        }
      },
      slug: {
        type: 'STRING(100)',
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true
        }
      },
      description: {
        type: 'TEXT',
        allowNull: true
      }
    },
    timestamps: true
  },
  // Test model
  Test: {
    tableName: 'tests',
    fields: {
      id: {
        type: 'INTEGER',
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: 'STRING(100)',
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true
        }
      },
      slug: {
        type: 'STRING(100)',
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true
        }
      },
      description: {
        type: 'TEXT',
        allowNull: true
      }
    },
    timestamps: true
  }
};

export default schemas;
