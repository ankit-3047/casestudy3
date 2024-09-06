import request from 'supertest'; // Supertest to test HTTP requests
import app from './server.js'; // Your Express app
import { sequelize, User, Service, Plan, CustomerService, Archive } from './models/index.js'; // Adjust the path to your models
import bcrypt from 'bcrypt';

const saltRounds = 10; // Or use your configured salt rounds

describe('Sequelize Models & API Test', () => {
  let adminToken = ''; // Variable to store the admin authentication token
  let customerToken = ''; // Variable to store the customer authentication token

  beforeAll(async () => {
    try {
      await sequelize.authenticate();
      console.log('Database connection established.');
      const [results] = await sequelize.query('SHOW TABLES');
      const tables = results.map(result => Object.values(result)[0]);
  
      if (tables.length === 0) {
        console.log('No tables found. Creating tables...');
        await sequelize.sync({ force: true });
        console.log('Tables have been created.');
      } else {
        console.log('Tables already exist:', tables);
      }
      // Force sync the database - this drops and recreates all tables
      await sequelize.sync({ force: true });
      console.log('Database tables created.');

      // Insert hardcoded data
      await insertTestData();
    } catch (error) {
      console.error('Error setting up the database:', error);
    }
  });

  const insertTestData = async () => {
    try {
      const adminPassword = await bcrypt.hash('admin123', saltRounds); // Hash the password for consistency
      const customerPassword = await bcrypt.hash('password123', saltRounds); // Hash the password for consistency

      const admin = await User.create({
        name: 'Admin User',
        email: 'admin@example.com',
        password: adminPassword,
        role: 'admin',
      });

      const customer = await User.create({
        name: 'John Doe',
        email: 'john@example.com',
        password: customerPassword,
        role: 'customer',
      });

      const service = await Service.create({
        service_name: 'Premium Service',
      });

      const plan = await Plan.create({
        service_id: service.id,
        plan_name: 'basic', // Ensure this matches the ENUM values
        features: 'Feature 1, Feature 2',
      });

      await CustomerService.create({
        customer_id: customer.id,
        service_id: service.id,
        plan_name: 'basic',
        features: 'Feature 1, Feature 2'
      });
    } catch (error) {
      console.error('Error inserting test data:', error);
    }
  };

  // Admin-related tests
  it('POST /login - admin should return a token upon successful login', async () => {
    const loginResponse = await request(app)
      .post('/login')
      .send({ email: 'admin@example.com', password: 'admin123' });

    console.log('Admin Login Response Status Code:', loginResponse.statusCode);
    console.log('Admin Login Response Body:', loginResponse.body);

    const cookieHeader = loginResponse.headers['set-cookie'];
    console.log('Admin Set-Cookie Header:', cookieHeader);

    if (cookieHeader) {
      const tokenCookie = cookieHeader.find(cookie => cookie.startsWith('token='));
      if (tokenCookie) {
        adminToken = tokenCookie.split(';')[0].split('=')[1];
      }
    }

    console.log('Admin Token:', adminToken);

    expect(loginResponse.statusCode).toBe(200);
    expect(adminToken).toBeDefined();
  });
  it('POST /login - Admin should show incorrect password error', async () => {
    const loginResponse = await request(app)
      .post('/login')
      .send({ email: 'admin@example.com', password: 'wrongpassword' }); // Incorrect password for admin

    console.log('Admin Login Response Status Code:', loginResponse.statusCode);
    console.log('Admin Login Response Body:', loginResponse.body);

    // Expecting a 401 Unauthorized response due to incorrect password
    expect(loginResponse.statusCode).toBe(401);
    expect(loginResponse.body.Error).toBe('Incorrect Password');
  });
  it('GET /customers - admin should fetch all customers', async () => {
    const response = await request(app)
      .get('/customers')
      .set('Cookie', `token=${adminToken}`);

    console.log('Admin Get Customers Response Body:', response.body);

    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('POST /createservice - admin should create a new service', async () => {
    const response = await request(app)
      .post('/createservice')
      .send({
        service_name: 'New Service',
        plans: [{ plan_name: 'premium', features: 'Advanced features' }]
      })
      .set('Cookie', `token=${adminToken}`);

    console.log('Admin Create Service Response Body:', response.body);

    expect(response.statusCode).toBe(200);
    expect(response.body.Status).toBe('Service created successfully');
  });

  it('GET /checkservice - admin should check if a service exists', async () => {
    const response = await request(app)
      .get('/checkservice')
      .query({ service_name: 'Premium Service' })
      .set('Cookie', `token=${adminToken}`);

    console.log('Admin Check Service Response Body:', response.body);

    expect(response.statusCode).toBe(200);
    expect(response.body.exists).toBe(true);
  });

  it('GET /getservices - admin should fetch all services and their plans', async () => {
    const response = await request(app)
      .get('/getservices')
      .set('Cookie', `token=${adminToken}`);

    console.log('Admin Get Services Response Body:', response.body);

    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('PUT /updateservice/:id - admin should update existing service plans', async () => {
    const service = await Service.findOne({ where: { service_name: 'Premium Service' } });

    const updatedPlans = [
      {
        plan_name: 'pro',
        features: 'Feature X, Feature Y'
      }
    ];

    const response = await request(app)
      .put(`/updateservice/${service.id}`)
      .send({ plans: updatedPlans })
      .set('Cookie', `token=${adminToken}`);

    console.log('Admin Update Service Response Body:', response.body);

    expect(response.statusCode).toBe(200);
    expect(response.body.Status).toBe('Service plans updated successfully');
  });

  it('DELETE /deleteservice/:id - admin should delete a service', async () => {
    const service = await Service.findOne({ where: { service_name: 'New Service' } });

    const response = await request(app)
      .delete(`/deleteservice/${service.id}`)
      .set('Cookie', `token=${adminToken}`);

    console.log('Admin Delete Service Response Body:', response.body);

    expect(response.statusCode).toBe(200);
    expect(response.body.Status).toBe('Service deleted successfully');
  });

  it('GET /logout - admin should clear the authentication token', async () => {
    const response = await request(app)
      .get('/logout')
      .set('Cookie', `token=${adminToken}`);

    console.log('Admin Logout Response Body:', response.body);

    expect(response.statusCode).toBe(200);
    expect(response.body.Status).toBe('Success');
  });

  // Customer-related tests
  it('POST /login - customer should return a token upon successful login', async () => {
    const loginResponse = await request(app)
      .post('/login')
      .send({ email: 'john@example.com', password: 'password123' });

    console.log('Customer Login Response Status Code:', loginResponse.statusCode);
    console.log('Customer Login Response Body:', loginResponse.body);

    const cookieHeader = loginResponse.headers['set-cookie'];
    console.log('Customer Set-Cookie Header:', cookieHeader);

    if (cookieHeader) {
      const tokenCookie = cookieHeader.find(cookie => cookie.startsWith('token='));
      if (tokenCookie) {
        customerToken = tokenCookie.split(';')[0].split('=')[1];
      }
    }

    console.log('Customer Token:', customerToken);

    expect(loginResponse.statusCode).toBe(200);
    expect(customerToken).toBeDefined();
  });
  it('POST /login - should show incorrect password error', async () => {
    const loginResponse = await request(app)
      .post('/login')
      .send({ email: 'john@example.com', password: 'password124' }); // Incorrect password
  
    console.log('Login Response Status Code:', loginResponse.statusCode);
    console.log('Login Response Body:', loginResponse.body);
  
    // Expecting a 401 Unauthorized response due to incorrect password
    expect(loginResponse.statusCode).toBe(401);
    expect(loginResponse.body.Error).toBe('Incorrect Password');
  });
  
  it('GET /services - customer should fetch all services', async () => {
    const response = await request(app)
      .get('/services')
      .set('Cookie', `token=${customerToken}`);

    console.log('Customer Get Services Response Body:', response.body);

    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
  });

  // it('POST /customer-service/enroll - customer should enroll in a service', async () => {
  //   const service = await Service.findOne({ where: { service_name: 'Premium Service' } });

  //   const response = await request(app)
  //     .post('/customer-service/enroll')
  //     .send({
  //       customer_id: (await User.findOne({ where: { email: 'john@example.com' } })).id,
  //       service_id: service.id,
  //       plan: 'basic'
  //     })
  //     .set('Cookie', `token=${customerToken}`);

  //   console.log('Customer Enroll Service Response Body:', response.body);

  //   expect(response.statusCode).toBe(200);
  //   expect(response.body.Status).toBe('Success');
  // });

  it('GET /customer/:customer_id - customer should fetch their details', async () => {
    const customer = await User.findOne({ where: { email: 'john@example.com' } });

    const response = await request(app)
      .get(`/customer/${customer.id}`)
      .set('Cookie', `token=${customerToken}`);

    console.log('Customer Get Details Response Body:', response.body);

    expect(response.statusCode).toBe(200);
  });

  it('PUT /customer-service/update - customer should update their service', async () => {
    const response = await request(app)
      .put('/customer-service/update')
      .send({
        customer_id: (await User.findOne({ where: { email: 'john@example.com' } })).id,
        service_id: (await Service.findOne({ where: { service_name: 'Premium Service' } })).id,
        new_plan: 'pro',
        features: 'Feature X, Feature Y'
      })
      .set('Cookie', `token=${customerToken}`);

    console.log('Customer Update Service Response Body:', response.body);

    expect(response.statusCode).toBe(200);
    expect(response.body.Status).toBe('Success');
  });

  it('GET /archives - admin should fetch archived services', async () => {
    const response = await request(app)
      .get('/archives')
      .set('Cookie', `token=${adminToken}`);

    console.log('Admin Get Archives Response Body:', response.body);

    expect(response.statusCode).toBe(200);
  });



  afterAll(async () => {
    try {
      await sequelize.close();
      console.log('Database connection closed.');
    } catch (error) {
      console.error('Error closing the database connection:', error);
    }
  });
});
