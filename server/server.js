import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import User from "./models/User.js";
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { sequelize, Service, Plan,CustomerService,Archive } from "./models/index.js";
const saltRounds = 10;
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Your API',
      version: '1.0.0',
      description: 'API for your service',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./server.js'], // files containing annotations as above
};


const app = express();
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:3000"],
    methods: ["POST", "GET", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(cookieParser());
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Middleware to verify if the user is authenticated
const verifyUser = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.json({ Error: "You are not authenticated" });
  } else {
    jwt.verify(token, "jwt-secret-key", (err, decoded) => {
      if (err) {
        return res.json({ Error: "Token is not okay" });
      } else {
        console.log("Decoded token:", decoded); // Add this line
        req.userId = decoded.id;
        req.name = decoded.name;
        next();
      }
    });
  }
};

// Middleware to verify if the user is an admin
const verifyAdmin = async (req, res, next) => {
  try {
    console.log("User ID from token:", req.userId); // Add this line
    const user = await User.findByPk(req.userId);
    console.log("Fetched User:", user); // Add this line
    if (user && user.role === "admin") {
      next();
    } else {
      console.log("Access denied: User role is not admin");
      return res.status(403).json({ Error: "Access denied, admin only." });
    }
  } catch (err) {
    console.error("Error verifying admin:", err);
    return res.status(500).json({ Error: "Server error" });
  }
};

// app.get("/", verifyUser, (req, res) => {
//   return res.json({ Status: "Success", name: req.name });
// });

app.get("/", verifyUser, (req, res) => {
    return res.json({ 
      Status: "Success", 
      name: req.name
    });
  });
  
  app.get("/customers", verifyUser, verifyAdmin, async (req, res) => {
    try {
      const customers = await User.findAll({
        where: { role: "customer" },
        attributes: ["id", "name", "email"], // Specify the attributes you want to return
      });
  
      if (customers.length > 0) {
        return res.json(customers);
      } else {
        return res.status(404).json({ Error: "No customers found" });
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
      return res.status(500).json({ Error: "Server error" });
    }
  });
app.post("/register", async (req, res) => {
  try {
    const hash = await bcrypt.hash(req.body.password, saltRounds);
    await User.create({
      name: req.body.name,
      email: req.body.email,
      password: hash,
      role: "customer", // Automatically assign 'customer' role
    });
    return res.json({ Status: "Success" });
  } catch (err) {
    console.error("Error inserting data in server:", err);
    return res.json({ Error: "Error inserting data in server" });
  }
});
app.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ where: { email: req.body.email } });
    if (user) {
      const isPasswordValid = await bcrypt.compare(
        req.body.password,
        user.password
      );
      if (isPasswordValid) {
        const token = jwt.sign(
          { id: user.id, name: user.name, role: user.role },
          "jwt-secret-key",
          { expiresIn: "1d" }
        );
        res.cookie("token", token);
        console.log(user.id)
        return res.json({ Status: "Success", role: user.role,id:user.id });
      } else {
        return res.status(401).json({ Error: "Incorrect Password" });
      }
    } else {
      return res.json({ Error: "Unregistered user" });
    }
  } catch (err) {
    return res.json({ Error: "Login error in server" });
  }
});

// Route to fetch customer data by ID
// app.get("/customer/:id", async (req, res) => {
//   try {
//     const customer = await Customer.findOne({
//       where: { customer_id: req.params.id },
//       include: [
//         {
//           model: Service,
//           through: { attributes: [] },
//         },
//       ],
//     });

//     if (customer) {
//       const customerDetails = {
//         customer_id: customer.id,
//         name: customer.name,
//         services_enrolled: customer.Services.map((service) => ({
//           service_name: service.service_name,
//           plan: service.plan,
//           features: service.features,
//         })),
//       };
//       return res.json(customerDetails);
//     } else {
//       return res.status(404).json({ error: "Customer not found" });
//     }
//   } catch (err) {
//     console.error("Error fetching customer data:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

app.post("/createservice", verifyUser, verifyAdmin, async (req, res) => {
  try {
    const { service_name, plans } = req.body;

    // Check if the plans array exists and has at least one element
    if (
      !service_name ||
      !plans ||
      !Array.isArray(plans) ||
      plans.length === 0
    ) {
      return res.status(400).json({ Error: "Invalid data provided" });
    }

    // Log the received plans to debug
    console.log("Received plans:", plans);

    // Create the service
    const service = await Service.create({
      service_name,
    });

    // Create the plans associated with the service
    const servicePlans = plans.map((plan) => ({
      service_id: service.id,
      plan_name: plan.plan_name, // Ensure this matches the frontend data structure
      features: plan.features,
    }));

    await Plan.bulkCreate(servicePlans);

    return res.json({ Status: "Service created successfully" });
  } catch (err) {
    console.error("Error creating service:", err);
    return res.status(500).json({ Error: "Error creating service" });
  }
});

// Middleware to verify if the user is an admin

app.get("/checkservice", async (req, res) => {
  try {
    const { service_name } = req.query;
    const existingService = await Service.findOne({ where: { service_name } });
    if (existingService) {
      return res.json({ exists: true });
    }
    return res.json({ exists: false });
  } catch (err) {
    console.error("Error checking service name:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Route to fetch all services and their plans
app.get("/getservices", async (req, res) => {
  try {
    const services = await Service.findAll({
      include: {
        model: Plan,
        attributes: ["plan_name", "features"],
      },
    });

    // Format services and their plans
    const formattedServices = services.map((service) => ({
      service_name: service.service_name,
      id: service.id,
      plans: service.Plans.reduce(
        (acc, plan) => ({
          ...acc,
          [plan.plan_name]: plan.features,
        }),
        {}
      ),
    }));

    res.json(formattedServices);
  } catch (err) {
    console.error("Error fetching services:", err);
    res.status(500).json({ Error: "Server error" });
  }
});

app.get("/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ Status: "Success" });
});

// done hai
// Route to update an existing service

app.put("/updateservice/:id",  async (req, res) => {
  try {
    const { id } = req.params;
    const { plans } = req.body;
    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ Error: "Service not found" });
    }

    if (plans && Array.isArray(plans)) {
      await Plan.destroy({ where: { service_id: id } });
      console.log("Existing plans removed");

      // Create new plans
      const servicePlans = plans.map((plan) => ({
        service_id: id,
        plan_name: plan.plan_name,
        features: plan.features,
      }));

      console.log("New Plans:", servicePlans);
      await Plan.bulkCreate(servicePlans);
      console.log("New plans created");
    }

    return res.json({ Status: "Service plans updated successfully" });
  } catch (err) {
    console.error("Error updating service plans:", err);
    return res.status(500).json({ Error: "Error updating service plans" });
  }
});

app.delete("/deleteservice/:id", verifyUser, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id);
    // Check if the service exists
    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ Error: "Service not found" });
    }

    
    await Plan.destroy({ where: { service_id: id } });
    await service.destroy();

    return res.json({ Status: "Service deleted successfully" });
  } catch (err) {
    console.error("Error deleting service:", err);
    return res.status(500).json({ Error: "Error deleting service" });
  }
});

//For customer enrollment
app.get('/services', async (req, res) => {
    try {
      const services = await Service.findAll();
      res.json(services);
    } catch (err) {
      console.error('Error fetching services:', err);
      res.status(500).json({ Error: 'Failed to fetch services' });
    }
  });


  app.get('/plans', async (req, res) => {
    try {
      const plans = await Plan.findAll();
      res.json(plans);
    } catch (err) {
      console.error('Error fetching plans:', err);
      res.status(500).json({ Error: 'Failed to fetch plans' });
    }
  });


// In your existing Express server
app.post('/customer-service/enroll', verifyUser, async (req, res) => {
    try {
      const { customer_id, service_id, plan } = req.body;
  
      // Find the selected service and plan
      const service = await Service.findByPk(service_id);
      const selectedPlan = await Plan.findOne({
        where: {
          service_id: service_id,
          plan_name: plan, // Use plan_name instead of plan
        },
      });
  console.log(selectedPlan);
      if (!service || !selectedPlan) {
        return res.status(404).json({ Error: 'Service or Plan not found' });
      }
  
      await CustomerService.create({
        customer_id: customer_id,
        service_id: service_id,
        plan_name: plan, // Include the plan_name in the creation
        features: selectedPlan.features, // Assuming you want to store the features from the plan
      });
  
      return res.json({ Status: 'Success', Message: 'Service enrolled successfully' });
    } catch (err) {
      console.error('Error enrolling service:', err);
      return res.status(500).json({ Error: 'Error enrolling service' });
    }
  });
  app.delete("/customer/:id", verifyUser, verifyAdmin, async (req, res) => {
    try {
      const { id } = req.params;
  
      // Move customer's services to archive
      const customerServices = await CustomerService.findAll({ where: { customer_id: id } });
      await Promise.all(customerServices.map(service =>
        Archive.create({
          customer_id: service.customer_id,
          service_id: service.service_id,
          plan_name: service.plan_name,
          features: service.features
        })
      ));
  
      // Remove customer from User table
      await User.destroy({ where: { id } });
  
      // Remove customer services
      await CustomerService.destroy({ where: { customer_id: id } });
  
      res.json({ Status: "Customer removed successfully" });
    } catch (err) {
      console.error("Error removing customer:", err);
      res.status(500).json({ Error: "Server error" });
    }
  });
  
  app.get("/customers", verifyUser, verifyAdmin, async (req, res) => {
    try {
      const customers = await User.findAll({
        where: { role: "customer" },
        attributes: ["id", "name", "email"], // Specify the attributes you want to return
      });
  
  
      if (customers.length > 0) {
        return res.json(customers);
      } else {
        return res.status(404).json({ Error: "No customers found" });
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
      return res.status(500).json({ Error: "Server error" });
    }
  });
  
  //Customer services fetch:
  app.get('/customer/:customer_id', async (req, res) => {
    try {
        const { customer_id } = req.params;

        const customer = await User.findOne({
            where: { id: customer_id, role: 'customer' },
            attributes: ['id', 'name', 'email'] // Include fields as needed
        });

        if (!customer) {
            return res.status(404).json({ Error: 'Customer not found' });
        }

        const services = await CustomerService.findAll({
            where: { customer_id: customer_id },
            include: [{
                model: Service,
                attributes: ['service_name'], // Include service name from the Service table
            }],
            attributes: ['plan_name', 'features','service_id'] // Include plan and features from CustomerService table
        });

        const responseData = {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            services_enrolled: services.map(service => ({
              service_id:service.service_id,
                service_name: service.Service.service_name,
                plan: service.plan_name,
                features: service.features,
            }))
        };

        return res.json(responseData);
    } catch (err) {
        console.error('Error fetching customer details:', err);
        return res.status(500).json({ Error: 'Error fetching customer details' });
    }
});


app.get('/customer-service/:customer_id/service/:service_id', async (req, res) => {
  const { customer_id, service_id } = req.params;
  try {
    const customerService = await CustomerService.findOne({
      where: { customer_id, service_id }
    });
    if (customerService) {
      res.json({ plan_name: customerService.plan_name });
    } else {
      res.status(404).json({ Error: 'Service not found for this customer' });
    }
  } catch (error) {
    console.error('Error fetching current plan:', error);
    res.status(500).json({ Error: 'Failed to fetch current plan' });
  }
});


app.put('/customer-service/update', async (req, res) => {
  const { customer_id, service_id, new_plan, features } = req.body;
  try {
    const [updated] = await CustomerService.update(
      { features:features,plan_name: new_plan},
      { where: { customer_id, service_id } }
    );

    if (updated === 1) {
      res.json({ Status: 'Success' });
    } else {  
      res.status(400).json({ Status: 'Failed', Error: 'Update failed' });
    }
  } catch (error) {
    console.error('Error updating service plan:', error);
    res.status(500).json({ Error: 'Failed to update service plan' });
  }
});

  
app.get('/plans/:planId/service/:serviceId', async (req, res) => {
  try {
    const { planId, serviceId } = req.params;

    // Find the plan with the given planId
    const plan = await Plan.findOne({ 
      where: { plan_name: planId, service_id: serviceId }
    });

    console.log('Fetched Plan:', plan); // Log the fetched plan

    if (!plan) {
      return res.status(404).json({ message: 'Plan not found for the specified service' });
    }

    // Return the features of the plan
    res.json({ features: plan.features });
  } catch (err) {
    console.error('Error fetching plan features:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


//Termiate
// Route to archive a service
app.post('/archive', verifyUser, async (req, res) => {
  try {
    const { customer_id, service_id } = req.body;

    // Find the service to archive
    const service = await CustomerService.findOne({ where: { customer_id, service_id } });
const name=await User.findOne({ where: { id:customer_id } });
    if (!service) {
      return res.status(404).json({ Error: 'Service not found for this customer' });
    }  if (!name) {
      return res.status(404).json({ Error: 'Id not found for this customer' });
    }
//2181
//8083
    // Archive the service
    await Archive.create({
      customer_id: customer_id,
      customer_name:name.name,
      service_id: service_id,
      plan_name: service.plan_name,
      features: service.features,
    });

    return res.json({ Status: 'Service archived successfully' });
  } catch (err) {
    console.error('Error archiving service:', err);
    return res.status(500).json({ Error: 'Error archiving service' });
  }
});

// Route to delete a service from CustomerService table
app.delete('/customer-services/:service_id', verifyUser, async (req, res) => {
  try {
    const { service_id } = req.params;

    // Delete the service from CustomerService table
    const deleted = await CustomerService.destroy({ where: { service_id:service_id } });

    if (deleted) {
      return res.json({ Status: 'Service deleted successfully' });
    } else {
      return res.status(404).json({ Error: 'Service not found' });
    }
  } catch (err) {
    console.error('Error deleting service:', err);
    return res.status(500).json({ Error: 'Error deleting service' });
  }
});

app.get('/archives', async (req, res) => {
  try {
      const archives = await Archive.findAll();
      res.json(archives);
  } catch (err) {
      res.status(500).json({ error: 'Failed to fetch archive data' });
  }
});


app.listen(8081, () => {
  console.log("Running... at port 8081");

  // Sync the database
  sequelize
    .sync({ force: false })
    .then(() => {
      console.log("Database & tables created!");
    })
    .catch((err) => console.error("Error creating tables:", err));
});
export default app ;
/**
 * @swagger
 * /:
 *   get:
 *     summary: Get the status of the server
 *     tags: [Server]
 *     responses:
 *       200:
 *         description: Server status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 Status:
 *                   type: string
 *                 name:
 *                   type: string
 */

/**
 * @swagger
 * /customers:
 *   get:
 *     summary: Get a list of customers
 *     tags: [Customers]
 *     security:
 *       - Bearer: []
 *     responses:
 *       200:
 *         description: List of customers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *       403:
 *         description: Access denied
 */

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 Status:
 *                   type: string
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 Status:
 *                   type: string
 *                 role:
 *                   type: string
 *                 id:
 *                   type: integer
 *       401:
 *         description: Incorrect credentials
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /createservice:
 *   post:
 *     summary: Create a new service
 *     tags: [Services]
 *     security:
 *       - Bearer: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               service_name:
 *                 type: string
 *               plans:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     plan_name:
 *                       type: string
 *                     features:
 *                       type: array
 *                       items:
 *                         type: string
 *     responses:
 *       200:
 *         description: Service created successfully
 *       400:
 *         description: Invalid data provided
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /checkservice:
 *   get:
 *     summary: Check if a service exists
 *     tags: [Services]
 *     parameters:
 *       - name: service_name
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service existence check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /getservices:
 *   get:
 *     summary: Get all services and their plans
 *     tags: [Services]
 *     responses:
 *       200:
 *         description: List of services and their plans
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   service_name:
 *                     type: string
 *                   id:
 *                     type: integer
 *                   plans:
 *                     type: object
 *                     additionalProperties:
 *                       type: array
 *                       items:
 *                         type: string
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /updateservice/{id}:
 *   put:
 *     summary: Update an existing service
 *     tags: [Services]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plans:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     plan_name:
 *                       type: string
 *                     features:
 *                       type: array
 *                       items:
 *                         type: string
 *     responses:
 *       200:
 *         description: Service plans updated successfully
 *       404:
 *         description: Service not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /deleteservice/{id}:
 *   delete:
 *     summary: Delete a service
 *     tags: [Services]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Service deleted successfully
 *       404:
 *         description: Service not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /services:
 *   get:
 *     summary: Get all services
 *     tags: [Customer Services]
 *     responses:
 *       200:
 *         description: List of services
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   service_name:
 *                     type: string
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /plans:
 *   get:
 *     summary: Get all plans
 *     tags: [Plans]
 *     responses:
 *       200:
 *         description: List of plans
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   plan_name:
 *                     type: string
 *                   features:
 *                     type: array
 *                     items:
 *                       type: string
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /customer-service/enroll:
 *   post:
 *     summary: Enroll a customer in a service
 *     tags: [Customer Services]
 *     security:
 *       - Bearer: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customer_id:
 *                 type: integer
 *               service_id:
 *                 type: integer
 *               plan:
 *                 type: string
 *     responses:
 *       200:
 *         description: Service enrolled successfully
 *       404:
 *         description: Service or Plan not found
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /customer-service/enroll:
 *   post:
 *     summary: Enroll a customer in a service
 *     tags: [Customer Service]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_id
 *               - service_id
 *               - plan
 *             properties:
 *               customer_id:
 *                 type: integer
 *               service_id:
 *                 type: integer
 *               plan:
 *                 type: string
 *     responses:
 *       200:
 *         description: Service enrolled successfully
 *       404:
 *         description: Service or Plan not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /customer/{id}:
 *   delete:
 *     summary: Remove a customer
 *     tags: [Customer]
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
 *         description: Customer removed successfully
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /customers:
 *   get:
 *     summary: Get all customers
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of customers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *       404:
 *         description: No customers found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /customer/{customer_id}:
 *   get:
 *     summary: Get customer details and enrolled services
 *     tags: [Customer]
 *     parameters:
 *       - in: path
 *         name: customer_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Customer details and enrolled services
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 services_enrolled:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       service_id:
 *                         type: integer
 *                       service_name:
 *                         type: string
 *                       plan:
 *                         type: string
 *                       features:
 *                         type: object
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /customer-service/{customer_id}/service/{service_id}:
 *   get:
 *     summary: Get customer's current plan for a service
 *     tags: [Customer Service]
 *     parameters:
 *       - in: path
 *         name: customer_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: service_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Current plan name
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 plan_name:
 *                   type: string
 *       404:
 *         description: Service not found for this customer
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /customer-service/update:
 *   put:
 *     summary: Update customer's service plan
 *     tags: [Customer Service]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_id
 *               - service_id
 *               - new_plan
 *               - features
 *             properties:
 *               customer_id:
 *                 type: integer
 *               service_id:
 *                 type: integer
 *               new_plan:
 *                 type: string
 *               features:
 *                 type: object
 *     responses:
 *       200:
 *         description: Service plan updated successfully
 *       400:
 *         description: Update failed
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /plans/{planId}/service/{serviceId}:
 *   get:
 *     summary: Get plan features for a specific service
 *     tags: [Plans]
 *     parameters:
 *       - in: path
 *         name: planName
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Plan features
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 features:
 *                   type: object
 *       404:
 *         description: Plan not found for the specified service
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /archive:
 *   post:
 *     summary: Archive a customer's service
 *     tags: [Archive]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_id
 *               - service_id
 *             properties:
 *               customer_id:
 *                 type: integer
 *               service_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Service archived successfully
 *       404:
 *         description: Service or customer not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /customer-services/{service_id}:
 *   delete:
 *     summary: Delete a service from CustomerService table
 *     tags: [Customer Service]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: service_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Service deleted successfully
 *       404:
 *         description: Service not found
 *       500:
 *         description: Server error
 */
