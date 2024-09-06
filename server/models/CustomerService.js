import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';
import User from './User.js'; // Import the User model
import Service from './Service.js'; // Import the Service model

const CustomerService = sequelize.define('CustomerService', {
    customer_id: {
        type: DataTypes.INTEGER,
        references: {
            model: User, // Reference the User model instead of Customers
            key: 'id',
        },
        primaryKey: true,
    },
    service_id: {
        type: DataTypes.INTEGER,
        references: {
            model: Service, // Reference the Service model
            key: 'id',
        },
        primaryKey: true,
    },
    plan_name: {
        type: DataTypes.STRING,
        allowNull: false, // Make this field mandatory
    },
    features: {
        type: DataTypes.STRING,
        allowNull: true, // This can be optional
    }
}, {
    tableName: 'CustomerServices', // Explicitly set the table name
    timestamps: false
});
// Define the relationships
User.hasMany(CustomerService, { foreignKey: 'customer_id' });   
CustomerService.belongsTo(User, { foreignKey: 'customer_id' });

Service.hasMany(CustomerService, { foreignKey: 'service_id' });
CustomerService.belongsTo(Service, { foreignKey: 'service_id' });

export default CustomerService;
