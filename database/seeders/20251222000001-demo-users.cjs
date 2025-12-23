'use strict';
const bcrypt = require('bcrypt');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await queryInterface.bulkInsert('users', [
      {
        email: 'admin@example.com',
        password: hashedPassword,
        name: 'Admin User',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'user@example.com',
        password: hashedPassword,
        name: 'Test User',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('users', null, {});
  }
};
