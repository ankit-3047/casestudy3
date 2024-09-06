import swaggerJSDoc from 'swagger-jsdoc';

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Your API Documentation',
    version: '1.0.0',
    description: 'Documentation for your API',
  },
  servers: [
    {
      url: 'http://localhost:8081', // Ensure this matches your server URL
    },
  ],
};

// Options for the swagger docs
const options = {
  swaggerDefinition,
  // Path to the API specs
  apis: ['./models/**/*.js', './server/**/*.js'], // Adjust path to where your JSDoc comments are located
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
